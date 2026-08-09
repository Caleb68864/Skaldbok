import type { RouteStop } from '../types/routeStop';

/**
 * Pure ordering and measurement for a campaign's jump route.
 *
 * @remarks
 * Free of Dexie and React. Route stops store every declared field as a string
 * regardless of its declared `type`, so this module owns the **single** place
 * where any of them is read as a number.
 */

/**
 * Reads a declared field as a number, tolerating everything a text input can
 * hold.
 *
 * @remarks
 * The one parse boundary in the route feature. Returns `0` for missing, blank
 * or unparseable input and never returns `NaN` — a half-filled route is the
 * normal state during play, and a total that reads `NaN` because one leg has
 * not been measured yet is worse than useless.
 *
 * @param values - A stop's `values` bag.
 * @param id - The declared field id to read.
 */
export function readNumericField(values: Record<string, string>, id: string): number {
  const raw = values[id];
  if (raw === undefined || raw === null) return 0;
  const trimmed = String(raw).trim();
  if (trimmed === '') return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Sums the declared distance field across a route.
 *
 * @param stops - The route, in any order (distance is order-independent).
 * @param distanceFieldId - `routePlanner.distanceFieldId`; when a system
 * declares none, there is nothing to total and the result is 0.
 */
export function totalDistance(stops: RouteStop[], distanceFieldId?: string): number {
  if (!distanceFieldId) return 0;
  return stops.reduce((sum, stop) => sum + readNumericField(stop.values, distanceFieldId), 0);
}

/**
 * Moves one stop and returns the whole route densely renumbered.
 *
 * @remarks
 * Dense renumbering rather than sparse or fractional ordering: these routes run
 * to a few dozen stops, and dense is the variant that cannot drift into
 * float-collision territory over a campaign. The caller persists the result in
 * a single transaction so an interrupted write cannot leave two stops sharing
 * an index.
 *
 * Out-of-range indices are clamped, and a list of one or none is returned
 * renumbered but otherwise untouched.
 *
 * @param stops - The route in its current order.
 * @param fromIndex - Position of the stop being moved.
 * @param toIndex - Position it should end up at.
 */
export function reorder(stops: RouteStop[], fromIndex: number, toIndex: number): RouteStop[] {
  const next = [...stops];
  if (next.length > 1) {
    const clamp = (i: number) => Math.max(0, Math.min(next.length - 1, Math.trunc(i)));
    const from = clamp(fromIndex);
    const to = clamp(toIndex);
    if (from !== to) {
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
    }
  }
  return next.map((stop, index) => (stop.order === index ? stop : { ...stop, order: index }));
}
