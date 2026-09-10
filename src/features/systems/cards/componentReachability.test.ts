import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { sheetTemplateSchema } from './schema';
import { componentRegistryOf, resolveComponent } from './resolveComponent';
import type { SheetTemplate } from './types';

/**
 * The `$prop` component subsystem is reachable from a `sheet.json`.
 *
 * @remarks
 * `resolveComponent` is 156 lines of careful, hardened code — own-property
 * lookups against prototype pollution, a recursion stack, a depth cap and a
 * separate breadth budget — with a full test file of its own. None of it could
 * run. `sheetTemplateSchema` had no `components` key, so there was nowhere in a
 * template to declare a component; and `PlayDashboardScreen` never passed
 * `CardRenderer` a registry, so `componentRegistry` defaulted to `{}` on every
 * render. Tested and unreachable is the worst of the three states: the coverage
 * says the feature works, and the feature is not connected to anything.
 *
 * `resolveComponent.test.ts` covers the expansion rules. This covers the two
 * links that were missing, which is the part its own tests could never fail on.
 */

const SRC = join(process.cwd(), 'src');

describe('a sheet.json can declare components', () => {
  it('accepts a components block in the template schema', () => {
    const parsed = sheetTemplateSchema.safeParse({
      version: 1,
      components: [
        {
          name: 'statTile',
          props: ['label', 'path'],
          body: [{ card: 'tile', props: { title: { $prop: 'label' }, source: { $prop: 'path' } } }],
        },
      ],
      play: {
        regions: [[{ card: 'statTile', props: { label: 'Pace', path: 'derived:pace' } }]],
      },
    });

    expect(
      parsed.success,
      'sheetTemplateSchema rejected a `components` block — the declaration half of '
      + 'the $prop subsystem is missing again, which makes resolveComponent unreachable.',
    ).toBe(true);
  });

  it('still accepts a template that declares none', () => {
    // Every bundled template. The feature is additive; nothing about them moves.
    expect(sheetTemplateSchema.safeParse({ version: 1, play: { regions: [['vitals']] } }).success)
      .toBe(true);
  });

  it('strips a components block that is not a valid definition', () => {
    const parsed = sheetTemplateSchema.safeParse({
      version: 1,
      components: [{ name: '', body: [] }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('componentRegistryOf', () => {
  it('keys a template’s declared components by name', () => {
    const template = {
      version: 1,
      components: [
        { name: 'statTile', props: ['label'], body: [{ card: 'tile', props: { title: { $prop: 'label' } } }] },
      ],
    } as SheetTemplate;

    const registry = componentRegistryOf(template);
    expect(Object.keys(registry)).toEqual(['statTile']);

    // And the registry it produces is one `resolveComponent` can expand — the
    // join that did not exist.
    expect(resolveComponent(registry.statTile!, { label: 'Pace' })).toEqual([
      { card: 'tile', props: { title: 'Pace' } },
    ]);
  });

  it('returns the same empty registry for a template with no components', () => {
    // A fresh object each render would be a new identity for every consumer
    // downstream, which is the shape of the memoisation bug this repo has
    // already fixed once in its providers.
    expect(componentRegistryOf({ version: 1 } as SheetTemplate))
      .toBe(componentRegistryOf(undefined));
    expect(componentRegistryOf(null)).toEqual({});
  });
});

/**
 * Every `<CardRenderer …/>` tag in a file, sliced whole.
 *
 * @remarks
 * The predecessor was `/<CardRenderer\b[^>]*?\/>/gs`, which cannot cross a `>`.
 * An arrow function in a prop — `onReady={() => undefined}`, ordinary JSX —
 * ends the match early, and the tag then simply is not in the match set. With
 * two tags in a file, giving one of them an arrow prop and dropping its
 * registry left the guard green: the sibling kept the "found some" assertion
 * satisfied and the modified tag was invisible.
 *
 * So the scan walks to a balanced `/>` instead, tracking nesting depth through
 * braces so a `>` inside a prop expression cannot end the tag.
 */
function cardRendererTags(source: string): string[] {
  const tags: string[] = [];
  for (const open of source.matchAll(/<CardRenderer\b/g)) {
    let depth = 0;
    for (let i = open.index; i < source.length; i++) {
      const ch = source[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (depth === 0 && ch === '/' && source[i + 1] === '>') {
        tags.push(source.slice(open.index, i + 2));
        break;
      }
      else if (depth === 0 && ch === '>' && source[i - 1] !== '=') {
        // An opening tag with children rather than a self-closing one. The
        // registry prop, if any, is in the part scanned so far.
        tags.push(source.slice(open.index, i + 1));
        break;
      }
    }
  }
  return tags;
}

/** Every `.tsx` file under `src`, so no call site is out of scope. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tsxFiles(full, out);
    else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) out.push(full);
  }
  return out;
}

describe('every CardRenderer passes the registry on', () => {
  const sites = tsxFiles(SRC)
    .flatMap((file) =>
      cardRendererTags(readFileSync(file, 'utf8')).map((tag) => ({
        path: relative(SRC, file).split('\\').join('/'),
        tag,
      })),
    );

  it('finds the call sites', () => {
    // Three of them: two on the play dashboard and — the one that matters —
    // `CardRenderer`'s own recursive render of an expanded component's body.
    expect(sites.length).toBeGreaterThanOrEqual(3);
    expect(sites.map((s) => s.path)).toContain('features/systems/cards/CardRenderer.tsx');
    expect(sites.map((s) => s.path)).toContain('screens/PlayDashboardScreen.tsx');
  });

  it.each(sites.map((s, i) => [`${s.path} #${i}`, s.tag]))(
    '%s receives componentRegistry',
    (_label, tag) => {
      // `componentRegistry` defaults to `{}`, so a forgotten prop is not a type
      // error and not a runtime error — the component simply never expands,
      // which is exactly how this went unnoticed. Checked in the source because
      // that silence is the failure mode.
      expect(
        tag.includes('componentRegistry='),
        'This <CardRenderer> does not receive componentRegistry. The prop is '
        + 'optional and defaults to {}, so this fails silently: a template that '
        + 'declares components renders nothing where they were used. On the '
        + 'recursive site inside CardRenderer itself, it means a component whose '
        + 'body references another component stops expanding one level down.',
      ).toBe(true);
    },
  );
});
