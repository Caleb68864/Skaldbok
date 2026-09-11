import { db } from '../db/client';
import type { PayoutSplit, PayoutSplitRow } from '../../types/payoutSplit';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';
import { createHardDelete, createSoftDeleteOps } from './createRepository';

/**
 * Repository for a campaign's current payout split — one live row per campaign.
 *
 * @remarks
 * This record is **mutable and represents only the current agreement**. It is
 * never the record of what a past payout used: a distribution deep-copies it
 * onto the ledger entry as `splitSnapshot` at write time, so renegotiating the
 * split cannot rewrite history.
 */

const CURRENT_PAYOUT_SPLIT_SCHEMA_VERSION = 1;

/**
 * Returns a campaign's split, creating a blank one on first read.
 *
 * @remarks
 * Idempotent under a concurrent first read: if more than one live row exists
 * for the campaign it keeps the oldest and soft-deletes the rest, rather than
 * assuming the race cannot happen. The whole read-decide-write runs inside one
 * Dexie transaction.
 *
 * A new split defaults to **0% ship fund and no rows** — deliberately not 50%.
 * Fifty is one particular crew's agreement, not a product default, and seeding
 * it would be a user-facing number hardcoded in the storage layer.
 */
export async function getOrCreateForCampaign(campaignId: string): Promise<PayoutSplit> {
  return db.transaction('rw', db.ledgerSplits, async () => {
    const rows = excludeDeleted(
      await db.ledgerSplits.where('campaignId').equals(campaignId).toArray(),
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    if (rows.length > 0) {
      const [keep, ...duplicates] = rows;
      if (duplicates.length > 0) {
        const txId = generateSoftDeleteTxId();
        const now = nowISO();
        await db.ledgerSplits.bulkUpdate(
          duplicates.map(d => ({ key: d.id, changes: { deletedAt: now, softDeletedBy: txId } })),
        );
      }
      return keep;
    }

    const now = nowISO();
    const split: PayoutSplit = {
      id: generateId(),
      campaignId,
      shipFundPct: 0,
      rows: [],
      schemaVersion: CURRENT_PAYOUT_SPLIT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    await db.ledgerSplits.add(split);
    return split;
  });
}

/**
 * Lists a campaign's split rows without creating one.
 *
 * @remarks
 * `getOrCreateForCampaign` writes on a miss, which is right for a screen about
 * to render the split and wrong for anything that only reads — an export must
 * not manufacture rows in the database it is backing up. Returns an empty array
 * for a campaign that has never opened the split screen.
 */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<PayoutSplit[]> {
  const rows = await db.ledgerSplits.where('campaignId').equals(campaignId).toArray();
  return options?.includeDeleted ? rows : excludeDeleted(rows);
}

/** Fetches one split by id; a soft-deleted row reads as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<PayoutSplit | undefined> {
  const row = await db.ledgerSplits.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

/** Replaces the ship-fund percentage and/or the payee rows. */
export async function update(
  id: string,
  patch: Partial<{ shipFundPct: number; rows: PayoutSplitRow[] }>,
): Promise<void> {
  await db.ledgerSplits.update(id, { ...patch, updatedAt: nowISO() });
}

const lifecycle = createSoftDeleteOps({
  repository: 'ledgerSplitRepository',
  table: 'ledgerSplits',
});

/**
 * Soft-deletes a split. Enlist in a wider cascade via `txId`.
 *
 * @param id - Split to delete.
 * @param txId - Cascade to join.
 */
export const softDelete = lifecycle.softDelete;

/** Restores a soft-deleted split. */
export const restore = lifecycle.restore;

/**
 * Permanently removes a split. Internal — never call from UI.
 *
 * @remarks
 * No `getDeleted` here, deliberately. A split is a cascade child restored
 * through the entry that owns it, and a listing would put a row on the Trash
 * screen with nothing meaningful to restore on its own —
 * `RESTORE_WITHOUT_LISTING` records that decision. `createDeletedListing` is a
 * separate opt-in factory precisely so this file can decline it rather than
 * inherit a listing it does not want.
 */
export const hardDelete = createHardDelete({
  repository: 'ledgerSplitRepository',
  table: 'ledgerSplits',
});
