import { db } from '../db/client';
import type { PayoutSplit, PayoutSplitRow } from '../../types/payoutSplit';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

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
        const txId = generateId();
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

/** Soft-deletes a split. Enlist in a wider cascade via `txId`. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  await db.ledgerSplits.update(id, {
    deletedAt: nowISO(),
    softDeletedBy: txId ?? generateId(),
  });
}

/** Restores a soft-deleted split. */
export async function restore(id: string): Promise<void> {
  await db.ledgerSplits.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes a split. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.ledgerSplits.delete(id);
}
