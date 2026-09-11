import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A ruleset that failed to load must not be served as one that is still loading.
 *
 * @remarks
 * `useSystemDefinition` returned `{ system, isLoading, error }` and **all
 * eighteen call sites destructured `{ system }` and nothing else.** The error is
 * the only thing that separates "this ruleset failed to load" from "this ruleset
 * has not finished loading" — both reach a consumer as `system === null` — so
 * without it the app quietly served classic-fantasy's derived stats, rest, death
 * and encumbrance rules for a ruleset that had gone missing.
 *
 * That is exactly what `engine.fallbackRulesFor` and the on-screen notice exist
 * to prevent, and they could not fire: `getEngine(null)` set no flag, and
 * `fallbackAdapter.test.ts` asserted that absence in two lines — a test
 * defending the gap, for the right reason. `getEngine` alone genuinely cannot
 * tell the two cases apart. Only the hook can, so the hook now says, through
 * `getEngine`'s `unresolvedSystemId`.
 *
 * `isLoading` got the opposite answer and was removed: no consumer ever showed a
 * spinner, and `system === null` already expresses readiness.
 *
 * ### Why this guard is structural rather than a list of screens
 *
 * Sixteen other files call `useSystemDefinition` directly, for labels, terms and
 * identity fields. Making each render its own notice would be sixteen chances to
 * render one fed a constant — the defect wearing the shape of the fix, which is
 * what `autosaveErrorReaders.test.ts` was rewritten to catch. So the rule is
 * narrow and checkable instead: **the two engine hooks, which every ruleset-
 * derived number in the app passes through, must bind the error and pass it on.**
 * A hook whose binding this file cannot resolve fails; not finding the
 * destructure is the same evidence as not finding the pass-through.
 */

const SRC = join(process.cwd(), 'src');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).map(path => ({
  path: relative(SRC, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));

const HOOK_FILE = 'features/systems/useSystemDefinition.ts';

/** Files that call the hook, other than the hook itself. */
const consumers = files.filter(
  f => /\buseSystemDefinition\s*\(/.test(f.source) && f.path !== HOOK_FILE,
);

/** The engine hooks: the funnel every ruleset-derived number goes through. */
const ENGINE_FILE = 'features/systems/engine/index.ts';

describe('a ruleset that failed to load says so', () => {
  it('finds the consumers', () => {
    // Without this, a rename makes every case below vacuous — the failure mode
    // that a source-scanning guard shares with every other source-scanning guard
    // in this repo.
    expect(consumers.length).toBeGreaterThanOrEqual(15);
  });

  it('the hook no longer returns a member nothing reads', () => {
    const hook = files.find(f => f.path === HOOK_FILE);
    expect(hook, 'useSystemDefinition.ts is missing').toBeDefined();
    // Prose about `isLoading` is allowed and wanted — the reason it went is
    // worth keeping. A *returned* `isLoading` is not.
    expect(
      /return\s*\{[^}]*\bisLoading\b/.test(hook!.source),
      'useSystemDefinition returns `isLoading` again. It had no reader at any of '
      + 'the eighteen call sites; wire a consumer in the same change or leave it out.',
    ).toBe(false);
  });

  it('both engine hooks bind the error and hand it to getEngine', () => {
    const engine = files.find(f => f.path === ENGINE_FILE);
    expect(engine, 'engine/index.ts is missing').toBeDefined();
    const source = engine!.source;

    for (const hook of ['useSystemEngine', 'useSystemEngineFor']) {
      // Take the hook's body up to the next top-level `export`, so the two are
      // checked separately rather than one covering for the other.
      const start = source.indexOf(`export function ${hook}(`);
      expect(start, `${hook} is not declared in ${ENGINE_FILE}`).toBeGreaterThan(-1);
      const rest = source.slice(start + 1);
      const end = rest.indexOf('\nexport ');
      const body = end === -1 ? rest : rest.slice(0, end);

      const bound = /const\s*\{[^}]*\berror\b[^}]*\}\s*=\s*useSystemDefinition\s*\(/.exec(body);
      expect(
        bound,
        `${hook} calls useSystemDefinition and this guard cannot find where its `
        + '`error` is bound, so it cannot tell whether anything is wired to it. That '
        + 'is a failure, not a pass: widen this pattern in the same commit rather '
        + 'than letting an unreadable hook through.',
      ).not.toBeNull();

      expect(
        /getEngine\(\s*system\s*,\s*error\s*\?/.test(body),
        `${hook} binds the error and does not pass it to getEngine. A bound-and-`
        + 'dropped error is the original bug exactly: the compiler does not object, '
        + 'because the variable is "used" by the destructure, and a campaign whose '
        + 'ruleset has gone missing goes on being served another system\'s maths.',
      ).toBe(true);
    }
  });

  it('the notice is rendered, and by the shared component', () => {
    // Two hand-written copies drift, and the one that drifts forgets the live
    // region. Both existing banners in this codebase's history were plain divs.
    const notice = files.find(f => f.path === 'components/systems/SystemRulesNotice.tsx');
    expect(notice, 'the shared notice component is missing').toBeDefined();
    // `toContain('role="status"')` was the first version of this line and it
    // passed on `data-role="status"`, which announces nothing — a substring
    // match with no left boundary, the same shape as the `\b`-before-a-hyphen
    // false positive `declaredCapabilities` was rewritten to stop making.
    // Measured: the mutation was green before this became a regex.
    expect(
      /(?:^|[\s{])role="status"/.test(notice!.source),
      'the notice is the one place this message is rendered, so it is the one place '
      + 'that has to announce it',
    ).toBe(true);

    const renderers = files.filter(f => /<SystemRulesNotice\b/.test(f.source));
    expect(
      renderers.map(f => f.path).sort(),
      'the character sub-nav covers every character screen; the session sub-nav '
      + 'covers the session, ledger and route screens, which resolve the campaign\'s '
      + 'ruleset and had no surface for this at all',
    ).toEqual(['components/shell/CharacterSubNav.tsx', 'components/shell/SessionSubNav.tsx']);
  });
});
