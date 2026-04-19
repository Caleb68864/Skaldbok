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

export async function list(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<InventoryContainer[]> {
  const rows = await db.inventoryContainers.where('campaignId').equals(campaignId).toArray();
  return options?.includeDeleted ? rows : excludeDeleted(rows);
}

export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<InventoryContainer | undefined> {
  const row = await db.inventoryContainers.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

export async function create(
  data: Omit<InventoryContainer, 'id' | 'createdAt' | 'updatedAt' | 'items' | 'coins'> & {
    items?: InventoryContainer['items'];
    coins?: InventoryContainer['coins'];
  },
): Promise<InventoryContainer> {
  const now = nowISO();
  const container: InventoryContainer = {
    id: generateId(),
    campaignId: data.campaignId,
    name: data.name,
    kind: data.kind,
    capacity: data.capacity,
    coins: data.coins ?? { gold: 0, silver: 0, copper: 0 },
    items: data.items ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await db.inventoryContainers.add(container);
  return container;
}

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

export async function restore(id: string): Promise<void> {
  const row = await db.inventoryContainers.get(id);
  if (!row || !row.deletedAt) return;
  await db.inventoryContainers.update(id, {
    deletedAt: undefined,
    softDeletedBy: undefined,
    updatedAt: nowISO(),
  });
}

export async function hardDelete(id: string): Promise<void> {
  await db.inventoryContainers.delete(id);
}
