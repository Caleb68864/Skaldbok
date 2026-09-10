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
