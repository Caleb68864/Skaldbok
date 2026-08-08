/**
 * Every panel key the sheet surface knows how to render, in canonical order.
 *
 * @remarks
 * The single source of truth for "is this a real panel key". `SheetScreen` uses
 * it as its fallback sequence, and `sheetTemplates.test.ts` checks every bundled
 * `sheet.json` against it — a template key that is not in this list is a typo
 * that would otherwise vanish silently.
 *
 * A key here is *knowable*, not necessarily *available*: availability is decided
 * per system by the engine (see {@link SheetPanelAvailability}).
 */
export const SHEET_PANEL_KEYS = [
  'identity',
  'attributes',
  'characteristics',
  'resources',
  'derived',
  'finances',
  'careers',
  'augments',
  'ships',
  'edges',
  'hindrances',
  'rest',
  'storyBank',
] as const;

/** One of the sheet panel keys this build knows how to render. */
export type SheetPanelKey = (typeof SHEET_PANEL_KEYS)[number];

/**
 * Whether each known panel applies to the active character.
 *
 * @remarks
 * `Record<SheetPanelKey, …>` rather than `Record<string, …>` on purpose: it is
 * what ties the three lists together. Adding a key to {@link SHEET_PANEL_KEYS}
 * without giving it an availability rule, or an availability rule for a key that
 * is not in the list, is now a type error rather than a panel that quietly never
 * renders. `SheetScreen`'s panel *map* is keyed the same way, so all three move
 * together or the build fails.
 */
export type SheetPanelAvailability = Record<SheetPanelKey, boolean>;

/** Result of {@link resolveSheetPanelOrder}. */
export interface PanelOrderResult {
  /** Canonical default order for the current system (used by "reset to default"). */
  defaultOrder: string[];
  /** The order to render: persisted drag order reconciled with availability. */
  panelOrder: string[];
}

/**
 * Resolves which sheet panels render and in what order — the one piece of
 * template logic with real branching, extracted from SheetScreen so it can be
 * unit-tested (a bug here silently blanks or misorders a user's sheet).
 *
 * Layers:
 * 1. Sequence = the template's panel keys when it declares any, else the
 *    canonical fallback sequence.
 * 2. `defaultOrder` = that sequence filtered to available panels — but if the
 *    template's keys are ALL unavailable (a community sheet listing card keys or
 *    typos → empty), fall back to the canonical sequence so the sheet is never
 *    blank (not even Identity).
 * 3. `panelOrder` reconciles three inputs: the persisted drag order first (a
 *    user's arrangement survives), dropping any key no longer available, then
 *    appending newly-available panels in canonical order so they surface.
 */
export function resolveSheetPanelOrder(
  templatePanelKeys: string[],
  fallbackSequence: string[],
  panelAvailability: Record<string, boolean>,
  storedOrder: string[] | undefined,
): PanelOrderResult {
  // Dedupe: a template that lists the same panel key in two regions must not
  // render the panel twice (and trigger React duplicate-key warnings).
  const sequence = [...new Set(templatePanelKeys.length > 0 ? templatePanelKeys : fallbackSequence)];
  const orderedFromSequence = sequence.filter(key => panelAvailability[key]);
  const defaultOrder = orderedFromSequence.length > 0
    ? orderedFromSequence
    : fallbackSequence.filter(key => panelAvailability[key]);

  const stored = storedOrder ?? defaultOrder;
  const panelOrder = [
    ...stored.filter(key => defaultOrder.includes(key)),
    ...defaultOrder.filter(key => !stored.includes(key)),
  ];
  return { defaultOrder, panelOrder };
}

/**
 * Which sheet panels a system can show, from its engine alone.
 *
 * @remarks
 * Extracted from `SheetScreen` so the bundled-template test can ask the same
 * question the screen answers. Without that, a `sheet.json` could list a panel
 * its own engine never makes available and the screen would simply skip it —
 * silently, behind a DEV-only info log. Traveller's template listed two:
 * `attributes` (its engine declares `characteristics`) and `rest` (its engine's
 * `rest` model is `null`), so an author reading the file saw a Rest panel the
 * app had never rendered.
 *
 * `ships` depends on runtime data rather than the engine — a character shows it
 * only while owning a ship — so it comes in as a flag with a permissive default,
 * letting a template legitimately list it.
 */
export function sheetPanelAvailability(
  engine: {
    panels: readonly string[];
    rest: unknown;
    derivedFields: readonly { overridable?: boolean; surfaces?: readonly string[] }[];
  },
  runtime: { ownsShip?: boolean } = {},
): SheetPanelAvailability {
  const declares = (key: string) => engine.panels.includes(key);
  return {
    // Always present: every ruleset has a name, and the story bank is app-level.
    identity: true,
    storyBank: true,
    attributes: declares('attributes'),
    characteristics: declares('characteristics'),
    resources: declares('resources'),
    finances: declares('finances'),
    careers: declares('careers'),
    augments: declares('augments'),
    edges: declares('edges'),
    hindrances: declares('hindrances'),
    // The Derived Values panel exists to override; a system whose sheet-surfaced
    // fields are all computed-only gets no panel rather than a read-only list.
    derived: engine.derivedFields.some(
      f => f.overridable && (!f.surfaces || f.surfaces.includes('sheet')),
    ),
    // `null` means the ruleset has no rest procedure, which is how the panel hides.
    rest: engine.rest !== null,
    ships: runtime.ownsShip ?? false,
  } as SheetPanelAvailability;
}
