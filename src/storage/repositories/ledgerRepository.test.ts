import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import {
  create,
  getById,
  listByCampaign,
  update,
  softDelete,
  restore,
  hardDelete,
} from './ledgerRepository';
import type { LedgerLeg, SplitSnapshot } from '../../types/ledger';

/**
 * The repository that writes the money.
 *
 * @remarks
 * Two of its behaviours are load-bearing in a way the arithmetic tests cannot
 * cover, because both are about what reaches *storage* rather than what the
 * maths returns:
 *
 * - **The split snapshot must be deep-copied on write.** If the stored entry
 *   held a reference to the live split, renegotiating the crew's percentages
 *   would silently rewrite what everyone was paid months earlier. That is the
 *   single requirement the whole feature exists to guarantee.
 * - **Reads must come back in fold order.** The running balance is derived, so
 *   an entry arriving in the wrong position does not just look odd — every
 *   balance after it is wrong.
 */

const SPLIT: SplitSnapshot = {
  shipFundPct: 50,
  rows: [
    { id: 'r1', payeeName: 'Milo Aer', pct: 36 },
    { id: 'r2', payeeName: 'Eldon Holt', pct: 18 },
  ],
};

const LEGS: LedgerLeg[] = [
  { kind: 'shipFund', amount: 409_500, pct: 50 },
  { kind: 'payee', payeeName: 'Milo Aer', amount: 147_420, pct: 36 },
];

describe('ledgerRepository', () => {
  beforeEach(async () => {
    await db.ledgerEntries.clear();
  });

  describe('create', () => {
    it('stores a positive amount for money in', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 819_000 });
      expect(entry.amount).toBe(819_000);
      expect((await getById(entry.id))?.amount).toBe(819_000);
    });

    it('stores a negative amount for money out exactly as given', async () => {
      // The screen negates before it gets here; the repository must not
      // second-guess the sign.
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: -267_878 });
      expect((await getById(entry.id))?.amount).toBe(-267_878);
    });

    it('defaults an unlabelled entry to an empty memo, never undefined', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      expect(entry.memo).toBe('');
    });

    it('omits gross, legs and snapshot on a plain cashbook line', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 100 });
      const stored = await getById(entry.id);
      expect(stored?.gross).toBeUndefined();
      expect(stored?.legs).toBeUndefined();
      expect(stored?.splitSnapshot).toBeUndefined();
    });

    it('stores gross and legs on a distribution', async () => {
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        memo: 'Tarkine payout',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: SPLIT,
      });
      const stored = await getById(entry.id);
      expect(stored?.gross).toBe(819_000);
      expect(stored?.amount).toBe(-409_500);
      expect(stored?.legs).toHaveLength(2);
      expect(stored?.legs?.[0].kind).toBe('shipFund');
    });

    it('stamps schemaVersion and matching created/updated timestamps', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      expect(entry.schemaVersion).toBe(1);
      expect(entry.createdAt).toBe(entry.updatedAt);
    });

    it('gives every entry a distinct id', async () => {
      const a = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      const b = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('the split snapshot is frozen at write time', () => {
    /**
     * These assert against the object `create` **returns**, not the row read
     * back from storage.
     *
     * @remarks
     * Reading back proves nothing here: IndexedDB structured-clones every value
     * on write, so `getById` hands back a fresh object whether or not the
     * repository copied anything. A test written against `getById` passes
     * identically with `structuredClone` removed — verified by mutation.
     *
     * The returned entry is the one the repository is actually responsible for.
     * Callers hold it (the ledger hook puts it straight into React state), so if
     * it aliased the live split, editing the split would mutate the entry
     * already on screen.
     */
    it('does not hand back an entry sharing the split it was given', async () => {
      const live: SplitSnapshot = structuredClone(SPLIT);
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: live,
      });
      expect(entry.splitSnapshot).not.toBe(live);
      expect(entry.splitSnapshot?.rows).not.toBe(live.rows);
      expect(entry.splitSnapshot?.rows[0]).not.toBe(live.rows[0]);
    });

    it('leaves the returned entry unchanged when the crew renegotiates', async () => {
      const live: SplitSnapshot = structuredClone(SPLIT);
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: live,
      });

      live.shipFundPct = 70;
      live.rows[0].pct = 25;
      live.rows.push({ id: 'r3', payeeName: 'Latecomer', pct: 5 });

      expect(entry.splitSnapshot?.shipFundPct).toBe(50);
      expect(entry.splitSnapshot?.rows).toHaveLength(2);
      expect(entry.splitSnapshot?.rows[0].pct).toBe(36);
    });

    it('persists the percentages agreed at the time, not the current ones', async () => {
      // The storage half. IndexedDB's own clone-on-write guarantees this, so it
      // documents the behaviour rather than guarding the repository's copy.
      const live: SplitSnapshot = structuredClone(SPLIT);
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: live,
      });
      live.shipFundPct = 70;
      live.rows[0].pct = 25;

      const stored = await getById(entry.id);
      expect(stored?.splitSnapshot?.shipFundPct).toBe(50);
      expect(stored?.splitSnapshot?.rows.map(r => r.payeeName)).toEqual([
        'Milo Aer',
        'Eldon Holt',
      ]);
    });
  });

  describe('listByCampaign', () => {
    it('returns entries in fold order by date', async () => {
      await create({ campaignId: 'c1', date: '2026-08-10', memo: 'third', amount: 1 });
      await create({ campaignId: 'c1', date: '2026-08-08', memo: 'first', amount: 1 });
      await create({ campaignId: 'c1', date: '2026-08-09', memo: 'second', amount: 1 });
      expect((await listByCampaign('c1')).map(e => e.memo)).toEqual(['first', 'second', 'third']);
    });

    it('orders same-date entries by when they were created', async () => {
      // The ids deliberately sort *against* the timestamps: the earlier entry is
      // `z`, the later one is `a`. A sort that ignored `createdAt` would fall
      // through to the id tiebreak and return them the wrong way round, so this
      // fails if the `createdAt` comparison is dropped.
      await db.ledgerEntries.bulkAdd([
        { id: 'a', campaignId: 'c1', date: '2026-08-08', memo: 'later', amount: 1, schemaVersion: 1, createdAt: '2026-08-08T18:00:00.000Z', updatedAt: '2026-08-08T18:00:00.000Z' },
        { id: 'z', campaignId: 'c1', date: '2026-08-08', memo: 'earlier', amount: 1, schemaVersion: 1, createdAt: '2026-08-08T09:00:00.000Z', updatedAt: '2026-08-08T09:00:00.000Z' },
      ]);
      expect((await listByCampaign('c1')).map(e => e.memo)).toEqual(['earlier', 'later']);
    });

    it('is stable across repeated reads', async () => {
      // Two entries logged in the same instant at the table must not reshuffle
      // between reads — every balance after them would move.
      const shared = { date: '2026-08-08', createdAt: '2026-08-08T10:00:00.000Z' };
      await db.ledgerEntries.bulkAdd([
        { id: 'bbb', campaignId: 'c1', memo: 'b', amount: 1, schemaVersion: 1, updatedAt: shared.createdAt, ...shared },
        { id: 'aaa', campaignId: 'c1', memo: 'a', amount: 1, schemaVersion: 1, updatedAt: shared.createdAt, ...shared },
      ]);
      const first = (await listByCampaign('c1')).map(e => e.id);
      const second = (await listByCampaign('c1')).map(e => e.id);
      expect(second).toEqual(first);
      // NOTE: this cannot prove the repository's `id` tiebreak fires. Dexie's
      // `where('campaignId').equals()` already returns primary-key order, so the
      // result is identical with the tiebreak removed — verified by mutation.
      // The tiebreak that genuinely matters is in `computeRunningBalance`, which
      // folds an arbitrarily-ordered array and IS mutation-proven in
      // `ledgerMath.test.ts`. This one is defence in depth.
    });

    it('keeps campaigns separate', async () => {
      await create({ campaignId: 'c1', date: '2026-08-08', memo: 'ours', amount: 1 });
      await create({ campaignId: 'c2', date: '2026-08-08', memo: 'theirs', amount: 1 });
      expect((await listByCampaign('c1')).map(e => e.memo)).toEqual(['ours']);
      expect((await listByCampaign('c2')).map(e => e.memo)).toEqual(['theirs']);
    });

    it('returns an empty list for a campaign with no entries', async () => {
      expect(await listByCampaign('nobody')).toEqual([]);
    });

    it('hides soft-deleted entries by default', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', memo: 'gone', amount: 1 });
      await softDelete(entry.id);
      expect(await listByCampaign('c1')).toEqual([]);
    });

    it('surfaces soft-deleted entries only when opted in', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', memo: 'gone', amount: 1 });
      await softDelete(entry.id);
      const all = await listByCampaign('c1', { includeDeleted: true });
      expect(all.map(e => e.id)).toEqual([entry.id]);
    });
  });

  describe('getById', () => {
    it('reads a soft-deleted entry as absent', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      await softDelete(entry.id);
      expect(await getById(entry.id)).toBeUndefined();
    });

    it('returns it when opted in', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      await softDelete(entry.id);
      expect((await getById(entry.id, { includeDeleted: true }))?.id).toBe(entry.id);
    });

    it('returns undefined for an id that never existed', async () => {
      expect(await getById('no-such-entry')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('patches the editable fields', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', memo: 'typo', amount: 100 });
      await update(entry.id, { memo: 'corrected', amount: -100, date: '2026-08-09' });
      const stored = await getById(entry.id);
      expect(stored?.memo).toBe('corrected');
      expect(stored?.amount).toBe(-100);
      expect(stored?.date).toBe('2026-08-09');
    });

    it('leaves the snapshot of a distribution untouched', async () => {
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: SPLIT,
      });
      await update(entry.id, { memo: 'renamed' });
      const stored = await getById(entry.id);
      expect(stored?.splitSnapshot?.shipFundPct).toBe(50);
      expect(stored?.legs).toHaveLength(2);
      expect(stored?.gross).toBe(819_000);
    });
  });

  describe('softDelete / restore', () => {
    it('marks the row rather than removing it', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      await softDelete(entry.id);
      const row = await db.ledgerEntries.get(entry.id);
      expect(row).toBeDefined();
      expect(row?.deletedAt).toBeTruthy();
      expect(row?.softDeletedBy).toBeTruthy();
    });

    it('enlists in a caller-supplied cascade transaction', async () => {
      // Follows campaignRepository's signature, not shipRepository's narrower
      // one — a cascade needs every row to share the same transaction id.
      const a = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      const b = await create({ campaignId: 'c1', date: '2026-08-08', amount: 2 });
      await softDelete(a.id, 'tx-shared');
      await softDelete(b.id, 'tx-shared');
      const rows = await db.ledgerEntries.bulkGet([a.id, b.id]);
      expect(rows.map(r => r?.softDeletedBy)).toEqual(['tx-shared', 'tx-shared']);
    });

    it('generates its own transaction id when none is given', async () => {
      const a = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      const b = await create({ campaignId: 'c1', date: '2026-08-08', amount: 2 });
      await softDelete(a.id);
      await softDelete(b.id);
      const rows = await db.ledgerEntries.bulkGet([a.id, b.id]);
      expect(rows[0]?.softDeletedBy).not.toBe(rows[1]?.softDeletedBy);
    });

    it('brings a restored entry back into reads with its amount intact', async () => {
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', memo: 'oops', amount: -5_100 });
      await softDelete(entry.id);
      await restore(entry.id);
      const stored = await getById(entry.id);
      expect(stored?.amount).toBe(-5_100);
      expect(stored?.deletedAt).toBeUndefined();
      expect(stored?.softDeletedBy).toBeUndefined();
      expect(await listByCampaign('c1')).toHaveLength(1);
    });

    it('restores a distribution with its snapshot intact', async () => {
      const entry = await create({
        campaignId: 'c1',
        date: '2026-08-09',
        amount: -409_500,
        gross: 819_000,
        legs: LEGS,
        splitSnapshot: SPLIT,
      });
      await softDelete(entry.id);
      await restore(entry.id);
      const stored = await getById(entry.id);
      expect(stored?.splitSnapshot?.rows).toHaveLength(2);
      expect(stored?.splitSnapshot?.shipFundPct).toBe(50);
    });
  });

  describe('hardDelete', () => {
    it('actually removes the row', async () => {
      // Internal only — purge jobs. No UI path may reach this.
      const entry = await create({ campaignId: 'c1', date: '2026-08-08', amount: 1 });
      await hardDelete(entry.id);
      expect(await db.ledgerEntries.get(entry.id)).toBeUndefined();
    });
  });
});
