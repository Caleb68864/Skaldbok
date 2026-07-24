import { db } from '../db/client';
import type { Ship } from '../../types/ship';
import { DEFAULT_SHIP_CREW_ROLES } from '../../types/ship';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for {@link Ship} rows. Ships are campaign-scoped and optionally
 * owned by a character. Follows the project soft-delete convention: reads filter
 * `deletedAt` unless `{ includeDeleted: true }` is passed.
 */

const CURRENT_SHIP_SCHEMA_VERSION = 1;

/** Lists a campaign's ships, newest first, excluding soft-deleted rows unless opted in. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<Ship[]> {
  const rows = await db.ships.where('campaignId').equals(campaignId).toArray();
  const visible = options?.includeDeleted ? rows : excludeDeleted(rows);
  return visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Ships owned by a specific character (excludes soft-deleted). */
export async function listByOwner(ownerCharacterId: string): Promise<Ship[]> {
  const rows = await db.ships.where('ownerCharacterId').equals(ownerCharacterId).toArray();
  return excludeDeleted(rows);
}

/** Fetches one ship by id; a soft-deleted row reads as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<Ship | undefined> {
  const row = await db.ships.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

/**
 * Creates a ship with sensible blank defaults and the standard crew roster.
 *
 * @remarks
 * Only `campaignId` and `name` are required; everything else defaults so a GM
 * can stand a ship up in one action and fill the details in later.
 */
export async function create(data: {
  campaignId: string;
  name: string;
  ownerCharacterId?: string | null;
  shipClass?: string;
}): Promise<Ship> {
  const now = nowISO();
  const ship: Ship = {
    id: generateId(),
    campaignId: data.campaignId,
    ownerCharacterId: data.ownerCharacterId ?? null,
    name: data.name,
    shipClass: data.shipClass ?? '',
    hullCurrent: 0,
    hullMax: 0,
    armor: 0,
    fuelCurrent: 0,
    fuelMax: 0,
    cargoCurrent: 0,
    cargoMax: 0,
    power: '',
    weapons: [],
    crew: DEFAULT_SHIP_CREW_ROLES.map(role => ({ role, assignee: '' })),
    notes: '',
    schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await db.ships.put(ship);
  return ship;
}

/** Applies a partial update, stamping `updatedAt`. */
export async function update(id: string, changes: Partial<Ship>): Promise<void> {
  await db.ships.update(id, { ...changes, updatedAt: nowISO() });
}

/** Soft-deletes a ship (reversible via {@link restore}). */
export async function softDelete(id: string): Promise<void> {
  const txId = generateId();
  await db.ships.update(id, { deletedAt: nowISO(), softDeletedBy: txId });
}

/** Restores a soft-deleted ship. */
export async function restore(id: string): Promise<void> {
  await db.ships.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes a ship. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.ships.delete(id);
}
