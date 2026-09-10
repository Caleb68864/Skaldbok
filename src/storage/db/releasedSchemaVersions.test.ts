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
 * not moved. An upgrade reached by `.upgrade(...)` with no fingerprint fails,
 * so the next extracted upgrade cannot join silently.
 *
 * **How the syntax used to defeat it.** The check matched
 * `/\.upgrade\(\s*([A-Za-z_$][\w$]*)\s*\)/` — a bare identifier and nothing
 * else. `.upgrade((tx) => fn(tx))` matched nothing at all, and neither did
 * `.upgrade(ns.fn)` or `.upgrade(fn as UpgradeFn)`. For an *existing* released
 * block that was harmless, because the block's own hash covers the call text;
 * for a *new* block it meant a released extracted upgrade could ship entirely
 * unfrozen while every test passed. The argument is now read whole and every
 * identifier in it checked, with a second assertion that needs no parsing at
 * all: a binding called `upgrade*` in one of these modules — a `function`
 * declaration or a `const` — must be fingerprinted however it is referenced.
 *
 * **Where the freeze still stops**, stated rather than left to be discovered: a
 * shared utility called from inside an upgrade is not fingerprinted.
 * `generateId` is called by the v6, v8 and v9 upgrades and is a general helper
 * with its own reasons to change; freezing it would freeze the codebase. If a
 * released upgrade's behaviour depends on a helper's exact output, inline the
 * helper's logic into the upgrade rather than relying on this file to notice.
 *
 * ### An upgrade body has exactly two legal homes
 *
 * Everything above assumes an upgrade's code is somewhere a hash can reach it,
 * and until now nothing checked that assumption. There are two places a hash
 * reaches: **inline in the version block**, covered by the block fingerprint,
 * and **a function declaration in an upgrade module**, covered by
 * {@link EXTRACTED_UPGRADE_FINGERPRINTS}. An upgrade body that lives anywhere
 * else is frozen by nothing:
 *
 * ```ts
 * const UPGRADES = { 21: async (tx) => { … } };   // an anonymous body in a map
 * this.version(21).stores({}).upgrade(UPGRADES[21]);
 * ```
 *
 * The v21 *block* fingerprint was correctly demanded and correctly recorded —
 * it covers the text `.upgrade(UPGRADES[21])` and stops there. The body was
 * covered by nothing, and editing it after release left this file at 29 of 29
 * green. {@link declaredUpgradeFunctions} did not catch it either: it matched
 * `function upgrade*(…)`, so it covered routes to a *named declaration*, never
 * an anonymous body, which is narrower than its own docstring used to claim.
 *
 * So {@link upgradeCalls} now classifies every `.upgrade(...)` argument, and an
 * argument that neither carries its body inline nor names a function an upgrade
 * module declares is a **failure**. Not a warning, and not a pass: this file
 * protects released migrations, and "I could not tell what this upgrade runs" is
 * the one answer that must never read as "fine".
 *
 * That leaves one documented boundary, which is the shared-helper stop above
 * seen from the other side: a call *out of* an inline block body —
 * `async (tx) => { await UPGRADES[21](tx); }` — is a helper call, and helper
 * calls are not followed. An upgrade whose body is a delegation should be
 * written as the delegation (`.upgrade(upgradeFooToV21)`), where it is frozen.
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

/**
 * A declaration of `name` in an upgrade module — `function name(`, or `const
 * name = (…) =>` / `= function`. Returns its offset in the file, or `-1`.
 */
function declarationOffset(source: string, name: string): number {
  const declaration = new RegExp(
    `(?:export\\s+)?(?:(?:async\\s+)?function\\s+${name}\\s*\\(`
    + `|(?:const|let|var)\\s+${name}\\s*(?::[^=;]+?)?=\\s*(?:async\\s*)?(?:\\(|function\\b|[A-Za-z_$][\\w$]*\\s*=>))`,
  );
  return declaration.exec(source)?.index ?? -1;
}

/** True if one of the upgrade modules declares a binding of this name. */
function declaresUpgradeFunction(name: string): boolean {
  return UPGRADE_SOURCE_FILES.some(file => declarationOffset(readFileSync(file, 'utf8'), name) >= 0);
}

/**
 * Every upgrade function reachable from a `.upgrade(...)` call in the
 * constructor, however it is referenced.
 *
 * @remarks
 * This used to be `/\.upgrade\(\s*([A-Za-z_$][\w$]*)\s*\)/g` — a **bare
 * identifier only**. `.upgrade((tx) => fn(tx))` matched nothing, and so did
 * `.upgrade(ns.fn)` and `.upgrade(fn as UpgradeFn)`. For an already-released
 * version that did no harm, because the block's own hash covers the
 * `.upgrade(...)` call text. For a **new** version block it was a hole you could
 * drive a migration through: add `this.version(21).stores({}).upgrade((tx) =>
 * probeUpgradeV21(tx))`, add the v21 *block* fingerprint the test correctly
 * demands, and the released upgrade itself is entirely unfrozen — its body can
 * then be edited with the whole suite green.
 *
 * An arrow-wrapped upgrade is not exotic. It is what you write the moment the
 * upgrade takes a second argument, and what a formatter produces when the call
 * wraps.
 *
 * So the whole argument is read by balancing parentheses and every identifier in
 * it is extracted. Identifiers that are not upgrade functions — `tx`, a type
 * name, a keyword — are dropped by asking whether an upgrade module declares
 * them.
 */
function namedUpgrades(): string[] {
  return [...new Set(upgradeCalls().flatMap(call => call.targets))];
}

/** One `.upgrade(...)` call in the constructor, and where its body lives. */
interface UpgradeCall {
  /** The `this.version(n)` the call hangs off. */
  version: number;
  /** The argument text, for the failure message. */
  argument: string;
  /** True when the argument itself carries the body, so the block hash covers it. */
  inline: boolean;
  /** Upgrade functions the argument names, which the extracted hashes cover. */
  targets: string[];
}

/**
 * True when the argument's own text carries the upgrade body — an arrow or
 * function expression with a `{ … }` block, written inside the version block
 * and therefore inside its fingerprint.
 *
 * @remarks
 * An *expression*-bodied arrow is deliberately not inline: `(tx) => fn(tx)`
 * carries no body, it forwards to one, and where it forwards has to resolve.
 * That is the shape the arrow-wrapper fix already handles by extracting `fn`;
 * this is the same judgement applied to `(tx) => UPGRADES[21](tx)`, which
 * forwards somewhere no hash reaches.
 */
function hasInlineBody(argument: string): boolean {
  const code = argument
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .trim();
  return /^(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]*)?=>\s*\{/.test(code)
    || /^(?:async\s+)?function\b[^{]*\{/.test(code);
}

/** Every `.upgrade(...)` call in the constructor, classified. */
function upgradeCalls(): UpgradeCall[] {
  const body = constructorBody(readFileSync(CLIENT_PATH, 'utf8'));
  const calls: UpgradeCall[] = [];
  for (const call of body.matchAll(/\.upgrade\s*\(/g)) {
    const open = call.index + call[0].length - 1;
    let depth = 0;
    let close = body.length;
    for (let i = open; i < body.length; i++) {
      if (body[i] === '(') depth++;
      else if (body[i] === ')') {
        depth--;
        if (depth === 0) { close = i; break; }
      }
    }
    const argument = body.slice(open + 1, close);
    const targets = new Set<string>();
    for (const id of argument.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (declaresUpgradeFunction(id[0])) targets.add(id[0]);
    }
    // The version this call hangs off: the last `this.version(n)` before it.
    const preceding = [...body.slice(0, open).matchAll(/this\.version\((\d+)\)/g)].pop();
    calls.push({
      version: preceding ? Number(preceding[1]) : -1,
      argument,
      inline: hasInlineBody(argument),
      targets: [...targets],
    });
  }
  return calls;
}

/**
 * Matches a declaration of an upgrade-named binding: `function upgradeX(`, or
 * `const upgradeX = (…) =>` / `= function`. Group 1 is the name.
 */
const UPGRADE_DECLARATION =
  /(?:export\s+)?(?:(?:async\s+)?function\s+(upgrade[A-Za-z0-9_$]*)\s*\(|(?:const|let|var)\s+(upgrade[A-Za-z0-9_$]*)\s*(?::[^=;]+?)?=\s*(?:async\s*)?(?:\(|function\b|[A-Za-z_$][\w$]*\s*=>))/g;

/**
 * Every binding an upgrade module declares whose name says it is an upgrade.
 *
 * @remarks
 * The backstop to {@link namedUpgrades}, which can only see what it can parse.
 * A released upgrade that reaches `.upgrade()` by some route this file does not
 * recognise is still frozen, because it is still declared here under a name
 * that says what it is.
 *
 * It used to match `function upgrade*(…)` and nothing else, which made it a
 * backstop for routes to a **named function declaration** rather than for
 * routes generally — narrower than the sentence above claimed. An arrow bound
 * to a `const` is the same released migration, so it counts here too.
 */
function declaredUpgradeFunctions(): string[] {
  const found = new Set<string>();
  for (const file of UPGRADE_SOURCE_FILES) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(UPGRADE_DECLARATION)) found.add((m[1] ?? m[2])!);
  }
  return [...found];
}

/**
 * Source text of a released upgrade's declaration, whole.
 *
 * @remarks
 * `function <name>(…) { … }` ends at the brace that balances its body, so a
 * nested block cannot end it early. `const <name> = …;` ends at the first `;`
 * outside any bracket, which covers an arrow with a block body and an
 * expression-bodied one alike.
 *
 * `export` and `async` are both optional: extracting a released upgrade into a
 * module-private helper does not unfreeze it.
 */
function upgradeFunctionSource(name: string): string {
  for (const file of UPGRADE_SOURCE_FILES) {
    const source = readFileSync(file, 'utf8');
    const start = declarationOffset(source, name);
    if (start < 0) continue;
    if (/^(?:export\s+)?(?:async\s+)?function\b/.test(source.slice(start, start + 40))) {
      const open = source.indexOf('{', start);
      let depth = 0;
      for (let i = open; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
          depth--;
          if (depth === 0) return source.slice(start, i + 1);
        }
      }
    } else {
      let depth = 0;
      for (let i = start; i < source.length; i++) {
        const ch = source[i]!;
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === ';' && depth === 0) return source.slice(start, i + 1);
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

  it('records a fingerprint for every upgrade function a version block reaches', () => {
    // The widening blind spot, closed. `.upgrade(someFunction)` is the pattern
    // this file recommends, so without this check the freeze would cover a
    // smaller share of the ladder with every version that used it — and until
    // now `.upgrade((tx) => someFunction(tx))`, the same thing with an argument,
    // was invisible to it.
    const named = namedUpgrades();
    expect(named.length, 'no `.upgrade(...)` calls found — has the pattern changed?')
      .toBeGreaterThan(0);
    const unpinned = named.filter(name => !(name in EXTRACTED_UPGRADE_FINGERPRINTS));
    expect(
      unpinned,
      `${unpinned.join(', ')} is reached by .upgrade() but has no fingerprint. An `
      + 'extracted upgrade is still a released migration — add its entry to '
      + 'EXTRACTED_UPGRADE_FINGERPRINTS in the same commit as the version block.',
    ).toEqual([]);
  });

  it('leaves no .upgrade() whose body it cannot account for', () => {
    // An upgrade body has two homes a hash reaches: inline in the version block,
    // or a declaration in an upgrade module. Nothing checked that it was in one
    // of them. Proven: `this.version(21).stores({}).upgrade(UPGRADES[21])`, body
    // an anonymous arrow in a module-level map — the v21 *block* fingerprint was
    // demanded and recorded (it covers `.upgrade(UPGRADES[21])` and stops), the
    // body was covered by nothing, and editing it after release left this file
    // at 29 of 29 green.
    //
    // Silence is the wrong answer for a released migration, so an argument this
    // file cannot place fails and says which version it is.
    const calls = upgradeCalls();
    expect(calls.length, 'no `.upgrade(...)` calls found — has the pattern changed?')
      .toBeGreaterThan(0);
    const unaccounted = calls
      .filter(call => !call.inline && call.targets.length === 0)
      .map(call => `version(${call.version}).upgrade(${call.argument.trim()})`);
    expect(
      unaccounted,
      `${unaccounted.join('; ')} — this upgrade's body is neither written inline in `
      + 'the version block (where the block fingerprint covers it) nor a function an '
      + 'upgrade module declares (where EXTRACTED_UPGRADE_FINGERPRINTS covers it), so '
      + 'nothing freezes it and it can be edited after release with this file green. '
      + 'Give the body a declaration in client.ts or an UPGRADE_SOURCE_FILES module, '
      + 'name it `upgrade*`, pass it directly, and record its fingerprint.',
    ).toEqual([]);
  });

  it('records a fingerprint for every function named as an upgrade', () => {
    // The backstop. `namedUpgrades()` can only see what it can parse, and its
    // predecessor's confident-looking regex saw one syntax out of four. This
    // asks a question that needs no parsing: a function in an upgrade module
    // called `upgradeSomething` is a released migration whatever route it takes
    // to `.upgrade()`.
    const declared = declaredUpgradeFunctions();
    expect(declared.length, 'no upgrade* functions found — has the pattern changed?')
      .toBeGreaterThan(0);
    const unpinned = declared.filter(name => !(name in EXTRACTED_UPGRADE_FINGERPRINTS));
    expect(
      unpinned,
      `${unpinned.join(', ')} is declared as an upgrade but has no fingerprint.`,
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
