import { describe, expect, it } from 'vitest';
import { sheetTemplateSchema } from './schema';
import { CARD_REGISTRY } from './registry';
import { SHEET_PANEL_KEYS } from '../panelOrder';

/**
 * Contract tests over every bundled `sheet.json`.
 *
 * @remarks
 * Deliberately a test rather than a Zod `superRefine` on the card key. The
 * renderer supports community components supplied through `componentRegistry`
 * at render time, and those are legitimately not `CARD_REGISTRY` keys — a
 * schema that rejected unknown keys would reject them too. Bundled templates
 * ship no component registry, so for *those* the key set is closed, and this is
 * where that can be said without constraining community authors.
 *
 * What this catches is the failure mode both surfaces are built to swallow: an
 * unrenderable key disappears quietly (`CardRenderer` returns null, the sheet's
 * availability filter drops it), so a typo in a bundled template looks exactly
 * like a panel a system chose not to show.
 */

const BUNDLED = import.meta.glob('../../../systems/*/sheet.json', { eager: true }) as Record<
  string,
  { default: unknown }
>;

/** Flattens a surface's regions to the card/panel keys it references. */
function keysOf(surface: { regions: unknown[] } | undefined): string[] {
  if (!surface) return [];
  return (surface.regions as Array<unknown>)
    .flatMap(region =>
      Array.isArray(region) ? region : ((region as { cells: unknown[][] }).cells ?? []).flat(),
    )
    .map(entry => (typeof entry === 'string' ? entry : (entry as { card: string }).card));
}

const templates = Object.entries(BUNDLED).map(([path, mod]) => ({
  systemId: path.match(/systems\/([^/]+)\/sheet\.json$/)?.[1] ?? path,
  raw: mod.default,
}));

describe('bundled sheet templates', () => {
  it('finds at least one bundled template', () => {
    // Guards the glob itself: a path change would otherwise make every test
    // below vacuously pass over an empty list.
    expect(templates.length).toBeGreaterThan(0);
  });

  describe.each(templates)('$systemId', ({ raw }) => {
    it('parses against the template schema', () => {
      const result = sheetTemplateSchema.safeParse(raw);
      expect(result.success ? null : result.error.message).toBeNull();
    });

    it('references only card keys the registry can render', () => {
      const parsed = sheetTemplateSchema.parse(raw);
      const unknown = keysOf(parsed.play).filter(key => !(key in CARD_REGISTRY));
      expect(unknown).toEqual([]);
    });

    it('references only panel keys the sheet can render', () => {
      const parsed = sheetTemplateSchema.parse(raw);
      const unknown = keysOf(parsed.sheet).filter(
        key => !(SHEET_PANEL_KEYS as readonly string[]).includes(key),
      );
      expect(unknown).toEqual([]);
    });
  });
});
