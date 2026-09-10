import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A screen that autosaves has to say when the save failed.
 *
 * @remarks
 * `useAutosave` returns `error` for exactly this, and shows one 8-second toast
 * per failure streak — `erroredRef` deliberately suppresses the rest, so a
 * disk that is full produces one toast, eight seconds, and then silence while
 * the interface goes on showing every edit as applied. The returned `error` is
 * the persistent half of that signal.
 *
 * Two of the seven character screens read it (`SheetScreen`,
 * `PlayDashboardScreen`). The other five — Skills, Gear, Magic, Profile and the
 * character half of Settings — called `useAutosave(...)` and discarded the
 * return value entirely. Nothing typed wrong, nothing crashed; the edits just
 * stopped being saved and the screen kept showing them.
 *
 * This is the same shape as `useSystemDefinition.error`, and as the sheet
 * template error before it: a hook computes a message and its consumers drop
 * it. So the check is structural rather than per-screen — a new autosaving
 * screen is on no list and must comply.
 *
 * The banner is a shared component so that "shows the error" cannot drift into
 * five different renderings, one of which forgets `role="alert"`. Both existing
 * banners were plain `<div>`s, so a screen reader was told nothing at all.
 *
 * ### Rendering the tag is not the property
 *
 * This file used to test `/<AutosaveErrorBanner\b/` and stop there. The other
 * half — that the banner is handed the *live* error — rested on the compiler,
 * and only incidentally: dropping the destructure gives TS2304, and passing a
 * constant while leaving `saveError` unused gives TS6133. Both vanish the moment
 * the screen touches `saveError` anywhere else, and a `console.warn` is enough:
 *
 * ```tsx
 * const { error: saveError } = useAutosave(character, characterRepository.save, 1000);
 * if (saveError) console.warn('autosave failed', saveError);   // TS6133 gone
 * …
 * <AutosaveErrorBanner error={null} />                         // announces nothing
 * ```
 *
 * That was green here and clean under `tsc -b`. It is the original bug — a
 * screen that declares the capability and half-wires it — displaced one level,
 * into the guard written to catch it. So the binding is resolved and the prop is
 * checked against it.
 *
 * **A screen whose binding cannot be resolved fails.** There is no "looks fine"
 * verdict for a file this guard cannot read: not finding the destructure is the
 * same evidence as not finding the banner, and gets the same answer.
 */

const SRC = join(process.cwd(), 'src');

/** Every `.ts`/`.tsx` file under `src`, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));

/** Files that call the hook, other than the hook itself. */
const consumers = files.filter(
  (f) => /\buseAutosave\s*\(/.test(f.source) && f.path !== 'hooks/useAutosave.ts',
);

/**
 * The local name a screen binds `useAutosave`'s `error` to, or `null` if this
 * file cannot tell.
 *
 * @remarks
 * Covers `const { error } = useAutosave(…)` and `const { error: saveError } =
 * useAutosave(…)`, with or without other members alongside. `null` means
 * unresolvable, which is a failure and not a pass — see the file's remarks.
 */
function autosaveErrorBinding(source: string): string | null {
  for (const call of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*useAutosave\s*\(/g)) {
    const member = /(?:^|,)\s*error\s*(?::\s*([A-Za-z0-9_$]+))?\s*(?=,|$)/.exec(call[1]!);
    if (member) return member[1] ?? 'error';
  }
  return null;
}

/** True if the banner is rendered with `error={<name>}` — that name, nothing else. */
function bannerReceives(source: string, name: string): boolean {
  return new RegExp(String.raw`<AutosaveErrorBanner\b[^>]*\berror=\{\s*${name}\s*\}`).test(source);
}

describe('every autosaving screen surfaces a failed save', () => {
  it('finds the consumers', () => {
    // Without this, a rename makes every case below vacuous.
    expect(consumers.length).toBeGreaterThanOrEqual(7);
  });

  it.each(consumers.map((f) => f.path))('%s renders the autosave error', (path) => {
    const source = consumers.find((f) => f.path === path)!.source;
    expect(
      /<AutosaveErrorBanner\b/.test(source),
      `${path} calls useAutosave and never renders <AutosaveErrorBanner>. The hook `
      + 'shows one toast per failure streak and then goes quiet, so without the '
      + 'banner a full disk looks exactly like a working save: the screen keeps '
      + 'showing edits that are not being written anywhere.',
    ).toBe(true);
  });

  it.each(consumers.map((f) => f.path))('%s wires the banner to that error', (path) => {
    const source = consumers.find((f) => f.path === path)!.source;
    const bound = autosaveErrorBinding(source);
    expect(
      bound,
      `${path} calls useAutosave but this guard cannot find where its \`error\` is `
      + 'bound, so it cannot tell whether the banner is wired to anything. That is a '
      + 'failure, not a pass: if the screen destructures the error some way this file '
      + 'does not recognise, widen `autosaveErrorBinding` in the same commit rather '
      + 'than letting an unreadable screen through. Expected `const { error } = '
      + 'useAutosave(…)` or `const { error: someName } = useAutosave(…)`.',
    ).not.toBeNull();
    expect(
      bannerReceives(source, bound!),
      `${path} renders <AutosaveErrorBanner> but does not pass it \`${bound}\`, the `
      + 'error useAutosave actually returns. A banner fed a constant renders and '
      + 'announces nothing, which is the bug this file exists to catch wearing the '
      + 'shape of the fix. The compiler does not cover this: once the screen reads '
      + `\`${bound}\` anywhere at all — one console.warn is enough — TS6133 goes away `
      + 'and a hardcoded `error={null}` type-checks.',
    ).toBe(true);
  });

  it('gives the banner an assertive live region', () => {
    const banner = files.find((f) => f.path === 'components/persistence/AutosaveErrorBanner.tsx');
    expect(banner, 'the shared banner component is missing').toBeDefined();
    expect(
      banner!.source,
      'the banner is the one place this message is rendered, so it is the one place '
      + 'that has to announce it. Both hand-written predecessors were plain <div>s.',
    ).toContain('role="alert"');
  });
});
