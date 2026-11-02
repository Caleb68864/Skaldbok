import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import { startSessionIfNoneActive } from './sessionRepository';
import { postBillCharges } from './ledgerRepository';

const SESSION = { campaignId: 'c', title: 'S', status: 'active' as const, date: '2026-01-01', startedAt: '2026-01-01T00:00:00.000Z' };

beforeEach(async () => {
  await resetDatabase();
});

describe('startSessionIfNoneActive', () => {
  it('a double tap starts one session', async () => {
    // Roadmap A10: "one active session" was a check on React state, then a write.
    const results = await Promise.all([startSessionIfNoneActive(SESSION), startSessionIfNoneActive(SESSION)]);
    const live = (await db.sessions.toArray()).filter(s => s.status === 'active');
    expect(live).toHaveLength(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('ignores a soft-deleted active session', async () => {
    await db.sessions.put({ ...SESSION, id: 'gone', createdAt: '', updatedAt: '', schemaVersion: 1, deletedAt: 'x', softDeletedBy: 'y' } as never);
    expect(await startSessionIfNoneActive(SESSION)).toBeTruthy();
  });
});

describe('postBillCharges', () => {
  const bill = { id: 'b1', campaignId: 'c', name: 'Rent', amount: 5, createdAt: '', updatedAt: '', schemaVersion: 1 };
  const charges = [
    { campaignId: 'c', date: '001', memo: 'Rent', amount: -5 },
    { campaignId: 'c', date: '002', memo: 'Rent', amount: -5 },
  ];

  it('writes entries and watermarks together', async () => {
    await db.recurringBills.put(bill as never);
    await postBillCharges(charges, [{ billId: 'b1', postedThrough: '002', postedCount: 2 }]);
    expect(await db.ledgerEntries.count()).toBe(2);
    expect((await db.recurringBills.get('b1'))?.postedCount).toBe(2);
  });

  it('a failure partway leaves nothing, so the next open cannot post it twice', async () => {
    await db.recurringBills.put(bill as never);
    const poisoned = [charges[0], { ...charges[1], amount: undefined as never, get memo(): string { throw new Error('boom'); } }];
    await expect(postBillCharges(poisoned, [{ billId: 'b1', postedThrough: '002', postedCount: 2 }])).rejects.toThrow();
    expect(await db.ledgerEntries.count()).toBe(0);
    expect((await db.recurringBills.get('b1'))?.postedCount).toBeUndefined();
  });
});
