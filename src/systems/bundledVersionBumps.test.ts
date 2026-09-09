import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

/**
 * Every bundled `system.json` / `sheet.json` edit must come with a `version`
 * bump, and this is what enforces it.
 *
 * @remarks
 * `CLAUDE.md` states this convention in bold and, until this file existed,
 * nothing checked it. Both gates are strictly-greater-than comparisons against
 * an IndexedDB cache — `useSystemDefinition.ts` for `system.json`,
 * `useSheetTemplate.ts` for `sheet.json` — and the two counters are unrelated.
 * Edit both files, bump one, and half the change ships.
 *
 * The failure is worse than silent: it is invisible **to the author locally**,
 * because the IndexedDB cache survives HMR and reload. It presents as "my edit
 * didn't work", which sends the next reader looking at the renderer rather than
 * at a version number.
 *
 * This follows `storage/db/releasedSchemaVersions.test.ts`: hash the content,
 * record the hash by hand, and make a content change with no recorded bump a
 * failing test rather than a silent no-op.
 *
 * **When this test fails after you edited a bundled JSON file:** bump that
 * file's own `version`, then update its entry below to the new version and the
 * new hash reported in the failure message. Unlike the released-schema
 * fingerprints, these entries are *meant* to change — every content edit
 * changes one. What must not happen is updating the hash while leaving the
 * version where it was, which is exactly the mistake being guarded.
 */

const SYSTEMS_DIR = join(process.cwd(), 'src/systems');

/** The two independently-versioned JSON files each bundled system ships. */
const VERSIONED_FILES = ['system.json', 'sheet.json'] as const;

interface Fingerprint {
  /** The `version` field as it stands in the file. */
  version: number;
  /** Hash of everything in the file *except* `version`. */
  hash: string;
}

/**
 * Recorded `{version, hash}` for every bundled JSON file, keyed
 * `<systemId>/<file>`.
 *
 * @remarks
 * Adding a bundled system means adding both of its entries here in the same
 * commit; the parity tests below fail in both directions if this map and the
 * `src/systems` tree disagree.
 */
const FINGERPRINTS: Record<string, Fingerprint> = {
  'classic-fantasy/system.json': { version: 3, hash: '753df20550b1d64a' },
  'classic-fantasy/sheet.json': { version: 7, hash: '56dcaa0ca7bd67e7' },
  'savage-worlds/system.json': { version: 7, hash: 'a3be2b7150842d78' },
  'savage-worlds/sheet.json': { version: 4, hash: 'f0f0310965793924' },
  'traveller/system.json': { version: 24, hash: '9f35a813067bc656' },
  'traveller/sheet.json': { version: 8, hash: '27c4b001cf2aebaf' },
};

/**
 * Canonical serialisation: object keys sorted recursively, array order kept.
 *
 * @remarks
 * So that reindenting or reordering sibling keys — neither of which changes
 * what the app loads — does not read as a content edit, while any change to a
 * value, or to the order of an array where order is meaningful (region layout,
 * skill lists), does.
 */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Short, stable digest — matching `releasedSchemaVersions.test.ts`. */
function hashOf(content: unknown): string {
  return createHash('sha256').update(canonical(content)).digest('hex').slice(0, 16);
}

interface BundledFile {
  key: string;
  version: unknown;
  /** Hash of the parsed document with `version` removed. */
  hash: string;
}

/** Reads every `<systemId>/{system,sheet}.json` under `src/systems`. */
function bundledFiles(): BundledFile[] {
  const systemIds = readdirSync(SYSTEMS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  const found: BundledFile[] = [];
  for (const systemId of systemIds) {
    for (const file of VERSIONED_FILES) {
      let raw: string;
      try {
        raw = readFileSync(join(SYSTEMS_DIR, systemId, file), 'utf8');
      } catch {
        continue; // a system need not ship both files
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const { version, ...rest } = parsed;
      found.push({ key: `${systemId}/${file}`, version, hash: hashOf(rest) });
    }
  }
  return found;
}

describe('bundled system/sheet version bumps', () => {
  const files = bundledFiles();

  it('finds the bundled JSON files', () => {
    // Guards the walk itself: if this glob ever stops matching, every
    // assertion below passes vacuously.
    expect(files.length).toBeGreaterThanOrEqual(VERSIONED_FILES.length);
  });

  it('has a fingerprint recorded for every bundled JSON file', () => {
    const unpinned = files.map(f => f.key).filter(key => !(key in FINGERPRINTS));
    expect(
      unpinned,
      `${unpinned.join(', ')} has no entry in FINGERPRINTS. A bundled system's ` +
      'system.json and sheet.json are each version-gated against an IndexedDB ' +
      'cache; record both here so an edit without a bump fails.',
    ).toEqual([]);
  });

  it('has a bundled JSON file for every recorded fingerprint', () => {
    const present = new Set(files.map(f => f.key));
    const missing = Object.keys(FINGERPRINTS).filter(key => !present.has(key));
    expect(
      missing,
      `${missing.join(', ')} is recorded here but no longer exists under src/systems. ` +
      'Remove its entry in the same commit that removes the file.',
    ).toEqual([]);
  });

  it.each(files.map(f => f.key))('%s declares a usable version', key => {
    const version = files.find(f => f.key === key)!.version;
    expect(typeof version, `${key} has no numeric "version" field`).toBe('number');
    expect(Number.isInteger(version as number)).toBe(true);
    expect(version as number).toBeGreaterThan(0);
  });

  it.each(files.map(f => f.key))('%s content matches its recorded version', key => {
    const recorded = FINGERPRINTS[key];
    if (!recorded) return; // reported by the parity test above
    const actual = files.find(f => f.key === key)!;

    const message =
      `${key} has changed since version ${recorded.version} was recorded.\n\n` +
      `  Bump "version" in ${key} (it is currently ${String(actual.version)}), then set\n` +
      `  FINGERPRINTS['${key}'] = { version: <the new number>, hash: '${actual.hash}' }\n\n` +
      'Both counters are independent and gated strictly-greater-than against an ' +
      'IndexedDB cache, so an unbumped edit is invisible to every existing ' +
      'install — including yours locally, because the cache survives reload.';

    // Content and version are asserted together: a content change with the
    // recorded version still in place is the exact mistake being caught, and a
    // version bump with no recorded content change means the map went stale.
    expect({ version: actual.version, hash: actual.hash }, message).toEqual({
      version: recorded.version,
      hash: recorded.hash,
    });
  });
});
