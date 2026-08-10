import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import { create, ensureForCampaign, listByCampaign, softDelete } from './ledgerAccountRepository';
import { create as createEntry, softDelete as softDeleteEntry } from './ledgerRepository';

/**
 * The rule these tests exist for: **an account with entries cannot be deleted.**
 *
 * @remarks
 * Deleting one used to succeed. The account row was soft-deleted and its entries
 * kept pointing at it, but both the accounts panel and the cash-on-hand fold walk
 * only live accounts — so the money left the totals while the entries stayed
 * listed in the table, and the book stopped adding up. Nothing failed loudly; the
 * numbers just stopped agreeing.
 */

beforeEach(async () => {
  await db.ledgerAccounts.clear();
  await db.ledgerEntries.clear();
});

async function cashAndSavings() {
  const accounts = await ensureForCampaign('c1');
  const primary = accounts.find(a => a.isPrimary)!;
  const savings = await create({ campaignId: 'c1', name: 'Savings', kind: 'asset' });
  return { primary, savings };
}

describe('softDelete — what it refuses', () => {
  it('refuses the primary account', async () => {
    const { primary } = await cashAndSavings();
    expect(await softDelete(primary.id)).toEqual({ reason: 'primary' });
  });

  it('refuses an account that does not exist', async () => {
    expect(await softDelete('nope')).toEqual({ reason: 'missing' });
  });

  it('refuses an account already deleted', async () => {
    const { savings } = await cashAndSavings();
    expect(await softDelete(savings.id)).toBeNull();
    expect(await softDelete(savings.id)).toEqual({ reason: 'missing' });
  });

  it('refuses an account an entry is booked against, and says how many', async () => {
    const { savings } = await cashAndSavings();
    await createEntry({
      campaignId: 'c1', date: '2026-08-01', memo: 'Deposit',
      amount: 500_000, accountId: savings.id,
    });
    expect(await softDelete(savings.id)).toEqual({ reason: 'has-entries', entryCount: 1 });
  });

  it('counts an entry that only names the account as the far side of a transfer', async () => {
    // The counter side moves this account's balance just as much as the near
    // side does, so a transfer pins the account down too.
    const { primary, savings } = await cashAndSavings();
    await createEntry({
      campaignId: 'c1', date: '2026-08-01', memo: 'Sweep',
      amount: -5_000, accountId: primary.id, counterAccountId: savings.id,
    });
    expect(await softDelete(savings.id)).toEqual({ reason: 'has-entries', entryCount: 1 });
  });

  it('counts several entries', async () => {
    const { savings } = await cashAndSavings();
    for (const n of [1, 2, 3]) {
      await createEntry({
        campaignId: 'c1', date: '2026-08-0' + n, memo: `E${n}`,
        amount: 100, accountId: savings.id,
      });
    }
    expect(await softDelete(savings.id)).toEqual({ reason: 'has-entries', entryCount: 3 });
  });

  it('leaves the account alive after refusing', async () => {
    // A refusal that half-deleted the row would be worse than allowing it.
    const { savings } = await cashAndSavings();
    await createEntry({
      campaignId: 'c1', date: '2026-08-01', memo: 'Deposit',
      amount: 500_000, accountId: savings.id,
    });
    await softDelete(savings.id);
    const live = await listByCampaign('c1');
    expect(live.map(a => a.id)).toContain(savings.id);
  });
});

describe('softDelete — what it allows', () => {
  it('removes an account with no entries', async () => {
    const { savings } = await cashAndSavings();
    expect(await softDelete(savings.id)).toBeNull();
    const live = await listByCampaign('c1');
    expect(live.map(a => a.id)).not.toContain(savings.id);
  });

  it('removes an account once its entries are deleted', async () => {
    // The way out of a refusal: clear the entries, then the account goes.
    const { savings } = await cashAndSavings();
    const entry = await createEntry({
      campaignId: 'c1', date: '2026-08-01', memo: 'Deposit',
      amount: 500_000, accountId: savings.id,
    });
    expect(await softDelete(savings.id)).toEqual({ reason: 'has-entries', entryCount: 1 });
    await softDeleteEntry(entry.id);
    expect(await softDelete(savings.id)).toBeNull();
  });

  it('ignores an entry belonging to another campaign', async () => {
    // Scoped by campaign, so a same-id collision across campaigns cannot
    // wrongly pin an account down.
    const { savings } = await cashAndSavings();
    await createEntry({
      campaignId: 'c2', date: '2026-08-01', memo: 'Elsewhere',
      amount: 100, accountId: savings.id,
    });
    expect(await softDelete(savings.id)).toBeNull();
  });
});
