import { z } from 'zod';

/** One crew position and who is assigned to it. */
export const shipCrewSlotSchema = z.object({
  role: z.string(),
  /** Free text — a character name, "hired", or blank. */
  assignee: z.string().default(''),
});
export type ShipCrewSlot = z.infer<typeof shipCrewSlotSchema>;

/** A live counter: a current value the table moves, against a built maximum. */
export const shipCounterSchema = z.object({
  current: z.number().default(0),
  max: z.number().default(0),
});
export type ShipCounter = z.infer<typeof shipCounterSchema>;

/**
 * A vehicle belonging to a campaign — a starship, a rig, a longship.
 *
 * @remarks
 * Scoped to a campaign and optionally owned by a character, so a crew can share
 * one vessel (owner unset) or characters can each own their own.
 *
 * **Which counters and specs exist is the ruleset's business, not this type's.**
 * The record holds two open bags keyed by the ids the active system declares in
 * `SystemDefinition.vehicles`, rather than the fixed hull/fuel/cargo/jump/thrust
 * columns it used to carry — those spelled one game's starship into the schema,
 * and a system with a Toughness rating and no jump drive had nowhere to put
 * either. Only what every vehicle has regardless of ruleset stays a column:
 * a name, an owner, a crew, weapons and notes.
 *
 * Follows the project's soft-delete convention; access it only through the ship
 * repository, which upgrades legacy rows on read (see {@link upgradeShip}).
 */
export const shipSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** Owning character, or null/undefined for a shared party vehicle. */
  ownerCharacterId: z.string().nullable().optional(),
  name: z.string(),

  /**
   * Live counters keyed by the declared counter id (`hull`, `fuel`, `cargo`…).
   *
   * @remarks
   * A counter absent from the bag reads as 0/0 rather than as an error, so
   * adding one to a ruleset does not invalidate vehicles already built.
   */
  counters: z.record(z.string(), shipCounterSchema).default({}),
  /**
   * Flat specs keyed by the declared spec id (`shipClass`, `jump`, `armor`…).
   *
   * @remarks
   * Values are stored as typed by the declaration — a number spec stores a
   * number — and an unrecognised key is left untouched rather than dropped, so
   * a ruleset edit that removes a field does not destroy what was recorded
   * under it.
   */
  specs: z.record(z.string(), z.union([z.string(), z.number()])).default({}),

  weapons: z.array(z.string()).default([]),
  crew: z.array(shipCrewSlotSchema).default([]),
  notes: z.string().default(''),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Ship = z.infer<typeof shipSchema>;

/** Current {@link Ship} schema version. Bump alongside a new {@link upgradeShip} step. */
export const CURRENT_SHIP_SCHEMA_VERSION = 2;

/**
 * The v1 → v2 column mapping: one game's starship, as the schema used to spell
 * it, expressed in the ids Traveller's `system.json` now declares.
 */
const V1_COUNTERS: Array<[counterId: string, currentKey: string, maxKey: string]> = [
  ['hull', 'hullCurrent', 'hullMax'],
  ['fuel', 'fuelCurrent', 'fuelMax'],
  ['cargo', 'cargoCurrent', 'cargoMax'],
];
const V1_SPEC_KEYS = ['shipClass', 'tl', 'armor', 'jump', 'thrust', 'power', 'upkeep'] as const;

/**
 * Brings a stored ship row up to {@link CURRENT_SHIP_SCHEMA_VERSION}.
 *
 * @remarks
 * Applied on read by the ship repository and persisted on the next save, the
 * same read-path upgrade the character records use. Idempotent: a row already
 * at the current version is returned untouched, and a v1 row missing a column
 * simply contributes nothing for it rather than writing a zero over data that
 * was never there.
 *
 * The legacy columns are deliberately **not** deleted from the returned object.
 * A row that is upgraded on read but never saved again keeps its original
 * fields in IndexedDB either way, and carrying them costs nothing — whereas
 * stripping them would make a rollback lossy.
 */
export function upgradeShip(row: Ship & Record<string, unknown>): Ship {
  if (row.schemaVersion >= CURRENT_SHIP_SCHEMA_VERSION) return row;

  const counters: Record<string, ShipCounter> = { ...(row.counters ?? {}) };
  for (const [id, currentKey, maxKey] of V1_COUNTERS) {
    if (counters[id]) continue;
    const current = row[currentKey];
    const max = row[maxKey];
    if (typeof current !== 'number' && typeof max !== 'number') continue;
    counters[id] = {
      current: typeof current === 'number' ? current : 0,
      max: typeof max === 'number' ? max : 0,
    };
  }

  const specs: Record<string, string | number> = { ...(row.specs ?? {}) };
  for (const key of V1_SPEC_KEYS) {
    if (specs[key] !== undefined) continue;
    const value = row[key];
    // Blank strings carry no information and would print an empty spec row.
    if (typeof value === 'number' || (typeof value === 'string' && value !== '')) {
      specs[key] = value;
    }
  }

  return { ...row, counters, specs, schemaVersion: CURRENT_SHIP_SCHEMA_VERSION };
}
