import { describe, expect, it } from 'vitest';
import { sheetTemplateSchema } from './schema';
import { CARD_REGISTRY } from './registry';
import { SHEET_PANEL_KEYS, sheetPanelAvailability, type SheetPanelKey } from '../panelOrder';
import { BUNDLED_SYSTEMS } from '../../../systems/registry';
import { getEngine } from '../engine';

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

/**
 * A `sheet.json` may only list panels its own engine can make available.
 *
 * @remarks
 * The key-validity test above asks "is this a real panel key?". It cannot ask
 * "can *this system* ever show it?", and the screen answers that question by
 * silently dropping the panel behind a DEV-only info log — so a template could
 * promise a section the app had never once rendered.
 *
 * Traveller's listed two: `attributes` (its engine declares `characteristics`,
 * the same panel under the ruleset's own noun) and `rest` (its `rest` model is
 * `null`, which is exactly how a ruleset with no rest procedure hides it).
 *
 * `ships` is exempt because it is gated on the character owning one at runtime,
 * not on the engine, so a template may legitimately list it.
 */
describe('bundled sheet templates list only panels their engine provides', () => {
  const RUNTIME_GATED = new Set(['ships']);

  it.each(BUNDLED_SYSTEMS.map(s => [s.id, s] as const))('%s', (systemId, system) => {
    const template = templates.find(t => t.systemId === systemId);
    expect(template, `no bundled sheet.json for ${systemId}`).toBeDefined();

    const parsed = sheetTemplateSchema.parse(template!.raw);
    const available = sheetPanelAvailability(getEngine(system), { ownsShip: true });
    const dead = keysOf(parsed.sheet).filter(
      key => !RUNTIME_GATED.has(key) && !available[key as SheetPanelKey],
    );

    expect(
      dead,
      `${systemId}/sheet.json lists [${dead.join(', ')}] — its engine never makes ` +
        `those available, so the screen skips them and the file promises sections ` +
        `the app does not render`,
    ).toEqual([]);
  });
});

describe('the advancement panel is gated on the engine model', () => {
  /**
   * @remarks
   * `advancement` follows `rest`: a `null` model means the ruleset has no such
   * procedure and the panel must not appear. Dragonbane declares one; Traveller
   * and Savage Worlds do not, and their templates must not list it.
   */
  it.each(BUNDLED_SYSTEMS.map(s => [s.id, s] as const))('%s', (systemId, system) => {
    const engine = getEngine(system);
    const available = sheetPanelAvailability(engine, { ownsShip: true });
    expect(available.advancement).toBe(engine.advancement !== null);

    const template = templates.find(t => t.systemId === systemId);
    const listed = keysOf(sheetTemplateSchema.parse(template!.raw).sheet).includes('advancement');
    expect(
      listed,
      `${systemId}/sheet.json ${listed ? 'lists' : 'omits'} the advancement panel but its ` +
        `engine ${engine.advancement ? 'has' : 'has no'} advancement model`,
    ).toBe(engine.advancement !== null);
  });
});
