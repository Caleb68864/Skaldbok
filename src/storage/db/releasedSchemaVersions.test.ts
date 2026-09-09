import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Already-released `version(n)` blocks are frozen, and this is what enforces it.
 *
 * @remarks
 * Dexie runs an upgrade exactly once, on the way past that version. A database
 * already above `n` never runs `version(n).upgrade(...)` again, so editing a
 * released block changes what *new* installs get and nothing else — the two
 * populations diverge permanently and nothing reports it.
 *
 * This has already happened here, twice over the same edit. The v7 `notes`
 * backfill (`campaignId`/`body`/`status`/`pinned` on rows promoted out of
 * `referenceNotes`) was added to the **v7** block in `1b5e70a`, when the schema
 * was already at v14. Every existing database skipped it and kept notes missing
 * those fields; `version(19)` exists solely to re-run it. Until now the only
 * thing standing between that and a third occurrence was a comment at the top
 * of `client.ts`, and a comment enforces nothing — which is the same failure
 * mode as the ten inert `eslint-disable` lines.
 *
 * The fingerprint covers each block's `.stores(...)` **and** its inline
 * `.upgrade(...)` body, because the v7 incident was an edit to an upgrade body,
 * not to a schema string.
 *
 * ### Extracted upgrades are frozen too
 *
 * Two upgrades live in exported functions rather than inline arrows
 * (`upgradeReferenceGroupsToV14`, `upgradeNotesAndClearBackupsToV19`), and that
 * is the pattern this file recommends going forward — an exported function can
 * be called directly by a behavioural test, which an inline arrow cannot. They
 * were originally left outside the hash for that reason.
 *
 * That reasoning does not survive contact with what a freeze is for. A
 * behavioural test catches the changes it happens to cover; a hash catches
 * *every* change, and "every change" is the whole property, because a released
 * upgrade should not be edited at all. Leaving the extracted ones out meant the
 * guarantee shrank each time the recommended pattern was used — v14 and v19
 * today, and everything after them.
 *
 * So both are fingerprinted here as well, and so is
 * `writePreEncounterReworkBackup`, which the frozen v8 block calls out to. The
 * behavioural tests stay: they say what the upgrade *does*, this says it has
 * not moved. A named `.upgrade(fn)` with no fingerprint fails, so the next
 * extracted upgrade cannot join silently.
 *
 * **Where the freeze still stops**, stated rather than left to be discovered: a
 * shared utility called from inside an upgrade is not fingerprinted.
 * `generateId` is called by the v6, v8 and v9 upgrades and is a general helper
 * with its own reasons to change; freezing it would freeze the codebase. If a
 * released upgrade's behaviour depends on a helper's exact output, inline the
 * helper's logic into the upgrade rather than relying on this file to notice.
 */

const CLIENT_PATH = join(process.cwd(), 'src/storage/db/client.ts');

/**
 * Fingerprints of every released `version(n)` block.
 *
 * @remarks
 * **Adding a schema version:** add its entry here, in the same commit as the
 * `version(n)` block. That is the only change this map should ever receive.
 *
 * **A hash mismatch on an existing entry is not a stale snapshot to refresh.**
 * It means a released migration was edited. Revert the edit and express the
 * change as a new `version(n + 1)` block instead — the databases already past
 * that version will never see it otherwise.
 */
const RELEASED_BLOCK_FINGERPRINTS: Record<number, string> = {
  1: 'bd8964e3220cd34b',
  2: '0645ad749b923052',
  3: '1c781ea4f5c7a499',
  4: '7e5de6a3bb495efc',
  5: '946e725a28b59c86',
  6: '9d2425e0675d55d2',
  7: 'd44d7bc1e006dfe5',
  8: '4b19a87944ce5a74',
  9: '57060ef19cca1a3a',
  10: '300d5156e2d93c22',
  11: 'b35f527d37894b76',
  12: '630c19fa78e5e485',
  13: '99e6fdd19f68347a',
  14: '4ff04ff379057fd6',
  15: '5f023cd827013ab2',
  16: '63b3303ecbc2f7f6',
  17: '3ae85bb91b275b4b',
  18: '7eb47cdf5113bd9c',
  19: 'ab1013fd0c758f97',
  20: '7927278fc58b6a9d',
};

/** The body of `SkaldbokDatabase`'s constructor, where every version block lives. */
function constructorBody(source: string): string {
  const start = source.indexOf('constructor() {');
  expect(start, 'SkaldbokDatabase constructor not found').toBeGreaterThan(-1);
  const end = source.indexOf('\n  }\n}', start);
  expect(end, 'end of SkaldbokDatabase constructor not found').toBeGreaterThan(start);
  return source.slice(start, end);
}

/**
 * Strips comments and collapses whitespace.
 *
 * @remarks
 * So that reflowing a comment, or reindenting, does not read as a schema
 * change — only the code itself is fingerprinted.
 */
function normalise(block: string): string {
  return block
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every `this.version(n)…` block in the constructor, keyed by version number. */
function releasedBlocks(): Map<number, string> {
  const body = constructorBody(readFileSync(CLIENT_PATH, 'utf8'));
  const blocks = new Map<number, string>();
  // Split at each `this.version(` so a block runs to the start of the next one,
  // which captures the whole chain — `.stores(...)`, `.upgrade(...)` and all.
  const parts = body.split(/\n(?=\s*this\.version\()/);
  for (const part of parts) {
    const match = /this\.version\((\d+)\)/.exec(part);
    if (!match) continue;
    blocks.set(Number(match[1]), normalise(part));
  }
  return blocks;
}

/** Short, stable digest — long enough to be collision-free for this purpose. */
function fingerprint(block: string): string {
  return createHash('sha256').update(block).digest('hex').slice(0, 16);
}

/**
 * Fingerprints of released upgrade steps that live in a named function rather
 * than an inline arrow.
 *
 * @remarks
 * Same rules as {@link RELEASED_BLOCK_FINGERPRINTS}: add an entry when the
 * upgrade ships, and **never refresh one to make the test pass**. A mismatch
 * means a released migration was edited, and every database already past that
 * version ran the old body.
 */
const EXTRACTED_UPGRADE_FINGERPRINTS: Record<string, string> = {
  upgradeReferenceGroupsToV14: '53928b7dec68f5b8',
  upgradeNotesAndClearBackupsToV19: '94976af6bf647af5',
  // Not passed to `.upgrade()` — called from inside the frozen v8 block, which
  // means the block's own hash covers the *call* and nothing covers what it
  // calls. It writes the pre-encounter-rework backup, which is the one piece of
  // user data that migration preserves.
  writePreEncounterReworkBackup: '0639bb34b4e89893',
};

/** Modules that may declare a released upgrade step, searched in order. */
const UPGRADE_SOURCE_FILES = [
  CLIENT_PATH,
  join(process.cwd(), 'src/storage/db/migrations/pre-encounter-rework-backup.ts'),
];

/** Every identifier passed by name to `.upgrade(...)` in the constructor. */
function namedUpgrades(): string[] {
  const body = constructorBody(readFileSync(CLIENT_PATH, 'utf8'));
  return [...body.matchAll(/\.upgrade\(\s*([A-Za-z_$][\w$]*)\s*\)/g)].map((m) => m[1]!);
}

/**
 * Source text of `export async function <name>(…) { … }`, matched by balancing
 * braces so a nested block cannot end it early.
 */
function upgradeFunctionSource(name: string): string {
  for (const file of UPGRADE_SOURCE_FILES) {
    const source = readFileSync(file, 'utf8');
    const declaration = new RegExp(`export\\s+async\\s+function\\s+${name}\\s*\\(`);
    const match = declaration.exec(source);
    if (!match) continue;
    const open = source.indexOf('{', match.index + match[0].length);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(match.index, i + 1);
      }
    }
  }
  throw new Error(
    `could not find the declaration of ${name}. If a released upgrade moved file, `
    + 'add its new home to UPGRADE_SOURCE_FILES rather than dropping the fingerprint.',
  );
}

describe('released schema versions', () => {
  const blocks = releasedBlocks();

  it('finds every version block in the constructor', () => {
    const found = [...blocks.keys()].sort((a, b) => a - b);
    expect(found.length).toBeGreaterThan(0);
    // Contiguous from 1, and in ascending source order: a gap or a
    // re-ordering means a block was removed or moved, either of which changes
    // the upgrade path for a database partway up the ladder.
    expect(found).toEqual(Array.from({ length: found.length }, (_, i) => i + 1));
    expect([...blocks.keys()]).toEqual(found);
  });

  it('has a fingerprint recorded for every version block', () => {
    const unpinned = [...blocks.keys()].filter(v => !(v in RELEASED_BLOCK_FINGERPRINTS));
    expect(
      unpinned,
      `version(${unpinned.join(', ')}) has no fingerprint. If you have just added a ` +
      'schema version, add its entry to RELEASED_BLOCK_FINGERPRINTS in this file, in ' +
      'the same commit.',
    ).toEqual([]);
  });

  it('has a version block for every recorded fingerprint', () => {
    const missing = Object.keys(RELEASED_BLOCK_FINGERPRINTS)
      .map(Number)
      .filter(v => !blocks.has(v));
    expect(
      missing,
      `version(${missing.join(', ')}) was recorded as released but is no longer in ` +
      'client.ts. A released version block cannot be deleted: a database sitting ' +
      'below it upgrades through it.',
    ).toEqual([]);
  });

  it('records a fingerprint for every named upgrade function', () => {
    // The widening blind spot, closed. `.upgrade(someFunction)` is the pattern
    // this file recommends, so without this check the freeze would cover a
    // smaller share of the ladder with every version that used it.
    const named = namedUpgrades();
    expect(named.length, 'no `.upgrade(name)` calls found — has the pattern changed?')
      .toBeGreaterThan(0);
    const unpinned = named.filter(name => !(name in EXTRACTED_UPGRADE_FINGERPRINTS));
    expect(
      unpinned,
      `${unpinned.join(', ')} is passed to .upgrade() but has no fingerprint. An `
      + 'extracted upgrade is still a released migration — add its entry to '
      + 'EXTRACTED_UPGRADE_FINGERPRINTS in the same commit as the version block.',
    ).toEqual([]);
  });

  it.each(Object.keys(EXTRACTED_UPGRADE_FINGERPRINTS))(
    '%s is unchanged since it shipped',
    name => {
      expect(
        fingerprint(normalise(upgradeFunctionSource(name))),
        `${name} has been edited. It runs exactly once per database, on the way past `
        + 'its version, so every database already above that version has run the old '
        + 'body and will never run this one — the two populations diverge permanently. '
        + 'Being in an exported function rather than an inline arrow changes nothing '
        + 'about that. Revert the edit and express the change as a new version(n + 1) '
        + 'block. This hash is not a snapshot to refresh.',
      ).toBe(EXTRACTED_UPGRADE_FINGERPRINTS[name]);
    },
  );

  it.each([...blocks.keys()])('version(%i) is unchanged since it shipped', version => {
    const expected = RELEASED_BLOCK_FINGERPRINTS[version];
    if (expected === undefined) return; // reported by the test above
    expect(
      fingerprint(blocks.get(version)!),
      `version(${version}) has been edited. Dexie runs an upgrade once, on the way ` +
      `past that version, so this changes what a fresh install gets and nothing ` +
      `else — every existing database is already past it. This is exactly how the ` +
      `v7 note backfill shipped to nobody and had to be re-run as version(19). ` +
      `Revert the edit and add a new version(n + 1) block instead.`,
    ).toBe(expected);
  });
});
