import type { Ship, ShipCounter } from '../../types/ship';
import type { VehicleModel } from '../../types/system';

/** A missing counter reads as 0/0 rather than as an error. */
const EMPTY: ShipCounter = { current: 0, max: 0 };

/** Reads one counter off a vehicle, defaulted. */
export function readCounter(ship: Ship, counterId: string): ShipCounter {
  return ship.counters?.[counterId] ?? EMPTY;
}

/** Reads one spec off a vehicle as a display string; absent reads as `''`. */
export function readSpec(ship: Ship, specId: string): string {
  const value = ship.specs?.[specId];
  return value === undefined || value === null ? '' : String(value);
}

/**
 * The one-line stat summary shown wherever a vehicle is listed rather than
 * edited — the campaign's vehicle list and the character sheet's pointer card.
 *
 * @remarks
 * Shared so those two surfaces cannot disagree. They previously held two copies
 * of the same hardcoded `Hull x/y · Cargo x/yt · Fuel x/y` string, in different
 * orders, and a ruleset that tracked anything else got Traveller's three
 * regardless.
 *
 * Which counters appear comes from `vehicles.summaryCounterIds` when declared,
 * else every declared counter in order. A ruleset declaring none summarises to
 * an empty string, and callers render nothing rather than an empty separator.
 */
export function summariseCounters(ship: Ship, model: VehicleModel | null | undefined): string {
  const counters = model?.counters ?? [];
  const ids = model?.summaryCounterIds ?? counters.map(c => c.id);
  return ids
    .map(id => counters.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(c => {
      const { current, max } = readCounter(ship, c.id);
      return `${c.label} ${current}/${max}${c.unit ?? ''}`;
    })
    .join(' · ');
}

/**
 * The subtitle printed after a vehicle's name — Traveller's ship class.
 *
 * @remarks
 * Empty when the ruleset declares no `subtitleSpecId`, or when the vehicle has
 * nothing recorded under it, so the separator is never printed on its own.
 */
export function vehicleSubtitle(ship: Ship, model: VehicleModel | null | undefined): string {
  return model?.subtitleSpecId ? readSpec(ship, model.subtitleSpecId) : '';
}
