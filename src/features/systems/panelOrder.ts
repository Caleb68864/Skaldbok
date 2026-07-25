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
  const sequence = templatePanelKeys.length > 0 ? templatePanelKeys : fallbackSequence;
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
