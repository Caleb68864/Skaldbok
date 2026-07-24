import { db } from '../db/client';
import type { InventoryContainer } from '../../types/inventoryContainer';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for {@link InventoryContainer} rows. Follows the project-wide
 * soft-delete convention: reads filter `deletedAt` unless
 * `{ includeDeleted: true }` is passed explicitly.
 */

/** Lists a campaign's inventory containers, excluding soft-deleted rows unless opted in. */
export async function list(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<InventoryContainer[]> {
  const rows = await db.inventoryContainers.where('campaignId').equals(campaignId).toArray();
  return options?.includeDeleted ? rows : excludeDeleted(rows);
}

/** Fetches one container by id; treats a soft-deleted row as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<InventoryContainer | undefined> {
  const row = await db.inventoryContainers.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

/**
 * Creates a new inventory container, defaulting `items`/`wealth` to empty.
 *
 * @remarks
 * A fresh container starts with no currency rather than an assumed
 * gold/silver/copper purse — the active system decides which denominations exist.
 */
export async function create(
  data: Omit<InventoryContainer, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'wealth'> & {
    items?: InventoryContainer['items'];
    wealth?: InventoryContainer['wealth'];
  },
): Promise<InventoryContainer> {
  const now = nowISO();
  const container: InventoryContainer = {
    id: generateId(),
    campaignId: data.campaignId,
    name: data.name,
    kind: data.kind,
    capacity: data.capacity,
    // Denomination-keyed and empty by default: the active system decides which
    // currencies exist, so a new container starts with none rather than an
    // assumed gold/silver/copper purse.
    wealth: data.wealth ?? {},
    items: data.items ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await db.inventoryContainers.add(container);
  return container;
}

/** Upserts a container, refreshing `updatedAt`; maps a storage-quota failure to a user-friendly message. */
export async function save(container: InventoryContainer): Promise<void> {
  try {
    await db.inventoryContainers.put({ ...container, updatedAt: nowISO() });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save container: ${String(err)}`);
  }
}

/** Soft-deletes a container (the user-facing delete). Enlist in a cascade via `txId`. No-op if missing or already deleted. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  const row = await db.inventoryContainers.get(id);
  if (!row || row.deletedAt) return;
  const finalTxId = txId ?? generateSoftDeleteTxId();
  const now = nowISO();
  await db.inventoryContainers.update(id, {
    deletedAt: now,
    softDeletedBy: finalTxId,
    updatedAt: now,
  });
}

/** Restores a soft-deleted container. No-op if missing or already live. */
export async function restore(id: string): Promise<void> {
  const row = await db.inventoryContainers.get(id);
  if (!row || !row.deletedAt) return;
  await db.inventoryContainers.update(id, {
    deletedAt: undefined,
    softDeletedBy: undefined,
    updatedAt: nowISO(),
  });
}

/** Permanently removes a container row. Internal only — never called from UI, which soft-deletes. */
export async function hardDelete(id: string): Promise<void> {
  await db.inventoryContainers.delete(id);
}
