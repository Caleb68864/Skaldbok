import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { THEME_LIST } from './themes';

/**
 * The app's theme is an attribute, so Tailwind's `dark:` variant is not the
 * app's theme.
 *
 * @remarks
 * `ThemeProvider` sets `data-theme` on `<html>`, and there are ten themes —
 * several of them dark. Tailwind v4's `dark:` variant, with no
 * `@custom-variant` declared in `styles/tailwind.css`, falls back to the
 * browser's `prefers-color-scheme`. The two are unrelated: a `dark:` class
 * follows the *operating system* while everything around it follows the theme
 * the user picked in Settings.
 *
 * Mismatched, that is not cosmetic. `EndSessionModal` warned "An active
 * encounter will be ended automatically" in `text-amber-700
 * dark:text-amber-300`, with no background of its own — so it inherited
 * `--color-surface`. On the OS-dark / app-light pairing that resolved to
 * amber-300 on `#F7F1E2`: about **1.3:1**, against a required 4.5. The warning
 * that says an encounter is about to end was invisible, in one of four
 * combinations, and nothing said so.
 *
 * The fix is not to re-point `dark:` at `[data-theme="dark"]` — that would be
 * right for one theme out of ten and wrong for the other dark ones. It is to use
 * the tokens every theme defines: `--color-warning`, `--color-danger`,
 * `--color-text`, `--color-surface`. They are the mechanism that already exists
 * for exactly this, and a theme cannot ship without them.
 *
 * Chips that carry their own background were legible either way, but flipped on
 * the OS scheme while the card beneath them followed the theme. They now have
 * one pairing on every theme.
 */

const SRC = join(process.cwd(), 'src');

/** Every `.ts`/`.tsx` under `src`, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('theming goes through the tokens, not the OS colour scheme', () => {
  const files = sourceFiles(SRC);

  it('reads the source tree', () => {
    // Without this a broken walk makes the assertion below vacuous.
    expect(files.length).toBeGreaterThan(100);
  });

  it('has more themes than a light/dark pair, which is why the variant cannot work', () => {
    // The premise, asserted rather than assumed. If the app ever collapsed to
    // two themes, re-pointing `dark:` at `[data-theme="dark"]` would become a
    // reasonable answer and this guard would be arguing against nothing.
    expect(THEME_LIST.length).toBeGreaterThan(2);
  });

  it('uses no Tailwind dark: variant anywhere in src', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // `dark:` as a Tailwind variant prefix — preceded by a quote, a space or a
      // brace. Not `dark: 'Torchlight in the Barrow'`, which is a theme's own
      // display name in an object literal and is followed by a space.
      for (const match of source.matchAll(/(?:^|[\s"'`{])(dark:[a-z[])/gm)) {
        offenders.push(`${relative(SRC, file).split('\\').join('/')}: ${match[1]}…`);
      }
    }
    expect(
      offenders,
      `${offenders.join('; ')} uses Tailwind's \`dark:\` variant. It follows the `
      + "browser's prefers-color-scheme, not the app's `data-theme`, so it changes "
      + 'independently of the theme the user chose — and a colour with no background '
      + 'of its own then lands on a surface from a different palette. Use '
      + '`var(--color-warning)`, `var(--color-danger)`, `var(--color-text)` or '
      + '`var(--color-surface)`, which every theme defines.',
    ).toEqual([]);
  });

  it('gives every theme the tokens those replacements depend on', () => {
    // The other half: telling people to use the tokens is only honest if the
    // tokens exist in every theme. A theme missing one would resolve the
    // variable to nothing and render the text transparent.
    const css = readFileSync(join(SRC, 'theme/theme.css'), 'utf8');
    for (const theme of THEME_LIST) {
      const block = new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
      expect(block, `theme "${theme}" has no block in theme.css`).not.toBeNull();
      for (const token of ['--color-warning', '--color-danger', '--color-text', '--color-surface']) {
        expect(block![1], `theme "${theme}" does not define ${token}`).toContain(token);
      }
    }
  });
});
