import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A comment that names a test file must name one that exists.
 *
 * @remarks
 * This codebase's conventions are enforced by source-scanning tests, and the
 * comments pointing at them are how the next reader finds the guard for a rule
 * they are about to change. That makes a wrong citation actively harmful: it
 * stops the search rather than starting it.
 *
 * The live case was `engine/index.ts`, whose `SYSTEM_ADAPTERS` comment credited
 * an `engineRegistryParity` test with keeping the map in lockstep with
 * `BUNDLED_SYSTEMS`. No such file has ever existed. The real guard,
 * `fallbackAdapter.test.ts`, enforced only one of the two directions — which is
 * exactly the sort of gap a reader would have found had the pointer sent them
 * to the right place.
 *
 * Cheap to hold, and it covers the whole class rather than the one instance.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match.test(entry.name)) out.push(full);
  }
  return out;
}

/** Basenames of every test file in the project. */
const testFileNames = new Set(
  walk(SRC, /\.test\.tsx?$/).map(path => path.split(/[/\\]/).pop()!),
);

/** Every `<something>.test.ts(x)` named anywhere in `src`, with where it is named. */
function citations(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of walk(SRC, /\.tsx?$/)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    for (const match of readFileSync(file, 'utf8').matchAll(/\b([A-Za-z0-9_.-]+\.test\.tsx?)\b/g)) {
      const name = match[1];
      // A file citing itself is trivially fine and would be noise here.
      if (rel.endsWith(name)) continue;
      const at = found.get(name) ?? [];
      if (!at.includes(rel)) at.push(rel);
      found.set(name, at);
    }
  }
  return found;
}

describe('cited test files exist', () => {
  const cited = citations();

  it('finds citations to check', () => {
    // Meta-tests are cited heavily here; a count near zero means the scan broke.
    expect(cited.size).toBeGreaterThan(5);
    expect(testFileNames.size).toBeGreaterThan(80);
  });

  it.each([...cited.keys()].sort())('%s exists', name => {
    expect(
      testFileNames.has(name),
      `${name} is cited by ${cited.get(name)!.join(', ')} and does not exist. ` +
      'A comment pointing at a test that is not there is worse than no comment: ' +
      'it stops the next reader looking for the guard that actually holds the ' +
      'rule. Name the real file, or delete the claim.',
    ).toBe(true);
  });
});
