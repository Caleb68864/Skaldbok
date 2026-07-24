import { z } from 'zod';

/** One crew position and who is assigned to it. */
export const shipCrewSlotSchema = z.object({
  role: z.string(),
  /** Free text — a character name, "hired", or blank. */
  assignee: z.string().default(''),
});
export type ShipCrewSlot = z.infer<typeof shipCrewSlotSchema>;

/**
 * A starship. Scoped to a campaign and optionally owned by a character, so a
 * crew can share one vessel (owner unset) or characters can each own their own.
 *
 * @remarks
 * Counters are stored flat as `<x>Current`/`<x>Max` rather than nested, which
 * keeps the Dexie rows and the editing forms simple. Follows the project's
 * soft-delete convention; access it only through the ship repository.
 */
export const shipSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** Owning character, or null/undefined for a shared party ship. */
  ownerCharacterId: z.string().nullable().optional(),
  name: z.string(),
  shipClass: z.string().default(''),
  tl: z.number().optional(),

  // Live-play counters (change during a session).
  hullCurrent: z.number().default(0),
  hullMax: z.number().default(0),
  armor: z.number().default(0),
  fuelCurrent: z.number().default(0),
  fuelMax: z.number().default(0),
  /** Cargo in tons. */
  cargoCurrent: z.number().default(0),
  cargoMax: z.number().default(0),

  // Drives / specs.
  jump: z.number().optional(),
  thrust: z.number().optional(),
  power: z.string().default(''),

  weapons: z.array(z.string()).default([]),
  crew: z.array(shipCrewSlotSchema).default([]),

  /** Monthly upkeep (mortgage + maintenance + life support), in credits. */
  upkeep: z.number().optional(),
  notes: z.string().default(''),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Ship = z.infer<typeof shipSchema>;

/** The crew roles a new Traveller ship starts with, in operating order. */
export const DEFAULT_SHIP_CREW_ROLES = [
  'Pilot',
  'Navigator',
  'Engineer',
  'Gunner',
  'Sensors',
  'Steward',
] as const;
