import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import { getOrCreateForCampaign, update } from './ledgerSplitRepository';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';
import type { PayoutSplit } from '../../types/payoutSplit';

/**
 * `getOrCreateForCampaign` is the one repository method the ledger screen
 * depends on being *singular*: it is called on every mount, and the split it
 * returns is the record a distribution snapshots from. Two live rows for one
 * campaign would mean two crews' worth of percentages, and which one you got
 * would depend on IndexedDB's iteration order.
 *
 * These tests pin the create-once behaviour and the duplicate collapse, both of
 * which are read-only-obvious and therefore exactly the kind of thing that
 * survives a refactor in a broken state.
 */

async function seedSplit(campaignId: string, createdAt: string): Promise<PayoutSplit> {
  const row: PayoutSplit = {
    id: generateId(),
    campaignId,
    shipFundPct: 0,
    rows: [],
    schemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  };
  await db.ledgerSplits.add(row);
  return row;
}

describe('ledgerSplitRepository.getOrCreateForCampaign', () => {
  beforeEach(async () => {
    await db.ledgerSplits.clear();
  });

  it('creates a split on first read', async () => {
    const split = await getOrCreateForCampaign('c1');
    expect(split.campaignId).toBe('c1');
    expect(await db.ledgerSplits.count()).toBe(1);
  });

  it('defaults to no ship-fund cut and no crew rows', async () => {
    // Deliberately not 50%: that is one crew's agreement, not a product default.
    const split = await getOrCreateForCampaign('c1');
    expect(split.shipFundPct).toBe(0);
    expect(split.rows).toEqual([]);
  });

  it('returns the same row on a second read rather than creating another', async () => {
    const first = await getOrCreateForCampaign('c1');
    const second = await getOrCreateForCampaign('c1');
    expect(second.id).toBe(first.id);
    expect(await db.ledgerSplits.count()).toBe(1);
  });

  it('keeps campaigns separate', async () => {
    const a = await getOrCreateForCampaign('c1');
    const b = await getOrCreateForCampaign('c2');
    expect(b.id).not.toBe(a.id);
    expect(await db.ledgerSplits.count()).toBe(2);
  });

  it('survives concurrent first reads with exactly one live row', async () => {
    // The race this guards: two callers both find nothing and both insert.
    await Promise.all([
      getOrCreateForCampaign('c1'),
      getOrCreateForCampaign('c1'),
      getOrCreateForCampaign('c1'),
    ]);
    const live = (await db.ledgerSplits.where('campaignId').equals('c1').toArray()).filter(
      r => !r.deletedAt,
    );
    expect(live).toHaveLength(1);
  });

  it('collapses pre-existing duplicates to the oldest and soft-deletes the rest', async () => {
    const oldest = await seedSplit('c1', '2026-08-01T00:00:00.000Z');
    const middle = await seedSplit('c1', '2026-08-02T00:00:00.000Z');
    const newest = await seedSplit('c1', '2026-08-03T00:00:00.000Z');

    const kept = await getOrCreateForCampaign('c1');

    expect(kept.id).toBe(oldest.id);
    const rows = await db.ledgerSplits.where('campaignId').equals('c1').toArray();
    const live = rows.filter(r => !r.deletedAt);
    expect(live.map(r => r.id)).toEqual([oldest.id]);

    // The losers are soft-deleted, not destroyed — they may carry percentages
    // somebody typed, and this repo never hard-deletes from a read path.
    const removed = rows.filter(r => r.deletedAt);
    expect(removed.map(r => r.id).sort()).toEqual([middle.id, newest.id].sort());
    for (const row of removed) {
      expect(row.softDeletedBy).toBeTruthy();
    }
  });

  it('ignores a soft-deleted split and creates a fresh one', async () => {
    const stale = await seedSplit('c1', '2026-08-01T00:00:00.000Z');
    await db.ledgerSplits.update(stale.id, {
      deletedAt: nowISO(),
      softDeletedBy: generateId(),
    });

    const split = await getOrCreateForCampaign('c1');
    expect(split.id).not.toBe(stale.id);
    expect(split.deletedAt).toBeUndefined();
  });

  it('round-trips an edited split', async () => {
    const split = await getOrCreateForCampaign('c1');
    await update(split.id, {
      shipFundPct: 50,
      rows: [{ id: 'r1', payeeName: 'Milo Aer', pct: 36 }],
    });

    const reread = await getOrCreateForCampaign('c1');
    expect(reread.shipFundPct).toBe(50);
    expect(reread.rows).toEqual([{ id: 'r1', payeeName: 'Milo Aer', pct: 36 }]);
  });
});
