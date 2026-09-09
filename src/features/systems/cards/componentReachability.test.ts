import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

const DASHBOARD = join(process.cwd(), 'src/screens/PlayDashboardScreen.tsx');

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

describe('the play dashboard passes the registry', () => {
  const source = readFileSync(DASHBOARD, 'utf8');

  it('renders no CardRenderer without a componentRegistry prop', () => {
    // `componentRegistry` defaults to `{}`, so a forgotten prop is not a type
    // error and not a runtime error — the component simply never expands, which
    // is exactly how this went unnoticed. Checked in the source because that
    // silence is the failure mode.
    const renders = [...source.matchAll(/<CardRenderer\b[^>]*?\/>/gs)];
    expect(renders.length, 'no <CardRenderer> found — has the dashboard changed shape?')
      .toBeGreaterThan(0);

    const missing = renders
      .map((m) => m[0])
      .filter((tag) => !tag.includes('componentRegistry='));

    expect(
      missing,
      'A <CardRenderer> in PlayDashboardScreen does not receive componentRegistry. '
      + 'The prop is optional and defaults to {}, so this fails silently: a template '
      + 'that declares components renders nothing where they were used.',
    ).toEqual([]);
  });
});
