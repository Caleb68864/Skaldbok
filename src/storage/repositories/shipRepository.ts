import { db } from '../db/client';
import type { Ship } from '../../types/ship';
import { CURRENT_SHIP_SCHEMA_VERSION, upgradeShip } from '../../types/ship';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';
import { createDeletedListing, createHardDelete, createSoftDeleteOps } from './createRepository';

/**
 * Repository for {@link Ship} rows. Ships are campaign-scoped and optionally
 * owned by a character. Follows the project soft-delete convention: reads filter
 * `deletedAt` unless `{ includeDeleted: true }` is passed.
 *
 * Rows are brought up to the current shape on read by {@link upgradeShip} and
 * persisted on the next save — the same read-path upgrade character records
 * use, and the reason a vehicle built before the counters/specs bags existed
 * still opens.
 */

/** Lists a campaign's ships, newest first, excluding soft-deleted rows unless opted in. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<Ship[]> {
  const rows = await db.ships.where('campaignId').equals(campaignId).toArray();
  const visible = options?.includeDeleted ? rows : excludeDeleted(rows);
  return visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(upgradeShip);
}

/** Ships owned by a specific character (excludes soft-deleted). */
export async function listByOwner(ownerCharacterId: string): Promise<Ship[]> {
  const rows = await db.ships.where('ownerCharacterId').equals(ownerCharacterId).toArray();
  return excludeDeleted(rows).map(upgradeShip);
}

/** Fetches one ship by id; a soft-deleted row reads as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<Ship | undefined> {
  const row = await db.ships.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return upgradeShip(row);
}

/**
 * Creates a vehicle with blank counters and the ruleset's own crew roster.
 *
 * @remarks
 * Only `campaignId` and `name` are required; everything else defaults so a GM
 * can stand a vehicle up in one action and fill the details in later.
 *
 * `counterIds` and `crewRoles` come from the active system's `vehicles`
 * declaration — the repository knows no ruleset and so invents neither. Omitted,
 * a vehicle is created with no counters and an empty roster, which is what a
 * system declaring none should get.
 */
export async function create(data: {
  campaignId: string;
  name: string;
  ownerCharacterId?: string | null;
  /** Counter ids to pre-seed at 0/0, from `system.vehicles.counters`. */
  counterIds?: string[];
  /** Crew positions, in operating order, from `system.vehicles.crewRoles`. */
  crewRoles?: readonly string[];
}): Promise<Ship> {
  const now = nowISO();
  const ship: Ship = {
    id: generateId(),
    campaignId: data.campaignId,
    ownerCharacterId: data.ownerCharacterId ?? null,
    name: data.name,
    counters: Object.fromEntries(
      (data.counterIds ?? []).map(id => [id, { current: 0, max: 0 }]),
    ),
    specs: {},
    weapons: [],
    crew: (data.crewRoles ?? []).map(role => ({ role, assignee: '' })),
    notes: '',
    schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await db.ships.put(ship);
  return ship;
}

/**
 * Applies a partial update, stamping `updatedAt`.
 *
 * @remarks
 * Writes the *upgraded* row rather than patching the stored one. A legacy
 * vehicle patched in place would keep `schemaVersion: 1` and its old columns
 * as the authority, so the next read would re-derive the bags and quietly
 * overwrite whatever was just edited into them.
 */
export async function update(id: string, changes: Partial<Ship>): Promise<void> {
  const stored = await db.ships.get(id);
  if (!stored) return;
  await db.ships.put({ ...upgradeShip(stored), ...changes, updatedAt: nowISO() });
}

/**
 * The soft-delete lifecycle, from the shared factory.
 *
 * @remarks
 * `shipRepository` was the worst of the twenty-four for divergence and the only
 * entry on all three of `repositoryConventions.test.ts`'s write lists: its
 * `softDelete` took no `txId` at all — so a ship could not go down with its
 * campaign or come back with it — it re-stamped `softDeletedBy` on an
 * already-deleted row, orphaning the first cascade, and it minted the id with
 * the raw `generateId` rather than the alias the cascade sites are grepped by.
 * All three are closed by construction now, and `softDelete` gained the
 * optional `txId` parameter without breaking its callers.
 */
const lifecycle = createSoftDeleteOps({ repository: 'shipRepository', table: 'ships' });

/**
 * Soft-deletes a ship (reversible via {@link restore}).
 *
 * @param id - Ship to delete.
 * @param txId - Cascade to join, when a parent is taking this ship down with it.
 */
export const softDelete = lifecycle.softDelete;

/** Restores a soft-deleted ship. */
export const restore = lifecycle.restore;

/**
 * Every soft-deleted Ship in a campaign, newest deletion first.
 *
 * @remarks
 * Feeds the Trash screen, which is the only way a user gets one of these back.
 * Deleting a ship is a soft delete with no cascade, so the row and its
 * counters come back exactly as they were.
 */
export const getDeleted = createDeletedListing<Ship>({
  repository: 'shipRepository',
  table: 'ships',
  scopeIndex: 'campaignId',
});

/** Permanently removes a ship. Internal — never call from UI. */
export const hardDelete = createHardDelete({ repository: 'shipRepository', table: 'ships' });
