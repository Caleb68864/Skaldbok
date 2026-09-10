import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The DOM is opted into per file, and this is what holds that boundary.
 *
 * @remarks
 * Two conventions meet here, and both were perfect and entirely unenforced —
 * conspicuous in a codebase with fourteen source-scanning meta-tests.
 *
 * 1. **A file that renders needs the pragma.** `environment` is `'node'` for
 *    the whole suite (see `vite.config.ts`), so a file importing
 *    `@testing-library/react` without `// @vitest-environment jsdom` on its
 *    first line fails on a missing `document` — noisily, at least.
 * 2. **A file that renders needs its own `cleanup()`.** This is the quiet one.
 *    Testing Library registers its automatic cleanup only when Vitest globals
 *    are on, and they are deliberately off, so without an explicit
 *    `afterEach(cleanup)` every render in a file accumulates in one document.
 *    Nothing fails; queries just start matching an element left over from a
 *    previous test, and the failure surfaces later, somewhere else, as
 *    "found multiple elements".
 *
 * The pragma must be on line 1: Vitest reads it from the first line of the
 * file, so a leading import or comment silently disables it.
 *
 * See `hooks/useAutosave.test.tsx` for the pattern.
 */

const SRC = join(process.cwd(), 'src');

/** Every test file under `src`. */
function testFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) testFiles(full, out);
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = testFiles(SRC).map(path => ({
  path: relative(SRC, path).split('\\').join('/'),
  source: readFileSync(path, 'utf8'),
}));

// An actual import, not a mention: this file names the package in its own doc
// comment, and matching a bare substring made it its own first offender.
const domFiles = files.filter(f => /from\s+['"]@testing-library\/react['"]/.test(f.source));

/**
 * Files that drive the DOM without rendering a component.
 *
 * @remarks
 * Rendering is not the only reason to need a document. `utils/export/delivery.ts`
 * creates an anchor, attaches it and dispatches a click, and its test has to
 * observe exactly that — no component involved. Such a file needs the pragma
 * and does **not** need `cleanup()`, so it is exempt from the stray-pragma
 * check below rather than added to {@link domFiles}.
 */
const domApiFiles = files.filter(
  f => !domFiles.includes(f) && /\b(?:document|navigator|window)\s*\./.test(f.source),
);

describe('the jsdom boundary', () => {
  it('finds the test files and the DOM ones among them', () => {
    // Both counts guard the walk: a broken glob would make every case vacuous.
    expect(files.length).toBeGreaterThan(80);
    expect(domFiles.length).toBeGreaterThan(0);
  });

  it.each(domFiles.map(f => f.path))('%s declares the jsdom environment on line 1', path => {
    const source = domFiles.find(f => f.path === path)!.source;
    expect(
      source.split('\n')[0].trim(),
      `${path} renders with Testing Library but does not open with the pragma. ` +
      'Vitest reads it from the first line only, so a comment or import above ' +
      'it disables it silently.',
    ).toBe('// @vitest-environment jsdom');
  });

  it.each(domFiles.map(f => f.path))('%s cleans up after each test', path => {
    const source = domFiles.find(f => f.path === path)!.source;
    // Either form: `afterEach(cleanup)` or an afterEach body that calls it.
    const cleansUp = /afterEach\s*\(\s*(?:cleanup\s*\)|(?:async\s*)?\(\s*\)\s*=>[\s\S]{0,400}?cleanup\s*\()/.test(
      source,
    );
    expect(
      cleansUp,
      `${path} renders with Testing Library and never calls cleanup() in an ` +
      'afterEach. Auto-cleanup only runs with Vitest globals on, and they are ' +
      'off, so every render in this file stacks up in one document — queries ' +
      'start matching leftovers and the failure surfaces somewhere else.',
    ).toBe(true);
  });

  it('has no pragma on a file that does not need one', () => {
    // A stray pragma is not harmless: it moves a pure file into jsdom, which is
    // slower and hides an accidental dependency on `document` in the code under
    // test.
    const strays = files
      .filter(f => f.source.startsWith('// @vitest-environment jsdom'))
      .filter(f => !domFiles.some(d => d.path === f.path))
      .filter(f => !domApiFiles.some(d => d.path === f.path))
      .map(f => f.path);
    expect(strays).toEqual([]);
  });
});
