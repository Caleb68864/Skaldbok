import { describe, it, expect } from 'vitest';
import { computeAccountBalances, primaryAccount, entriesForAccount } from './ledgerAccounts';
import type { LedgerAccount } from '../types/ledgerAccount';
import type { LedgerEntry } from '../types/ledger';

function account(over: Partial<LedgerAccount> & { id: string; name: string }): LedgerAccount {
  return {
    campaignId: 'c1',
    kind: 'asset',
    isPrimary: false,
    note: '',
    schemaVersion: 1,
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...over,
  };
}

function entry(over: Partial<LedgerEntry> & { id: string; amount: number }): LedgerEntry {
  return {
    campaignId: 'c1',
    date: '2026-08-08',
    memo: '',
    schemaVersion: 1,
    createdAt: '2026-08-08T00:00:00.000Z',
    updatedAt: '2026-08-08T00:00:00.000Z',
    ...over,
  };
}

const CASH = account({ id: 'cash', name: 'Cash', isPrimary: true });
const LOAN = account({ id: 'loan', name: 'Ship Loan', kind: 'liability' });

describe('primaryAccount', () => {
  it('finds the flagged account', () => {
    expect(primaryAccount([LOAN, CASH])?.id).toBe('cash');
  });
  it('falls back to the first when none is flagged', () => {
    expect(primaryAccount([LOAN])?.id).toBe('loan');
  });
  it('is null with no accounts at all', () => {
    expect(primaryAccount([])).toBeNull();
  });
});

describe('computeAccountBalances — the common case', () => {
  it('counts an entry naming no account against the primary', () => {
    // Every entry written before accounts existed looks like this.
    const s = computeAccountBalances([CASH, LOAN], [entry({ id: 'e1', amount: 819_000 })]);
    expect(s.balances.find(b => b.account.id === 'cash')!.balance).toBe(819_000);
    expect(s.balances.find(b => b.account.id === 'loan')!.balance).toBe(0);
  });

  it('counts an entry naming an account against that account', () => {
    const s = computeAccountBalances(
      [CASH, LOAN],
      [entry({ id: 'e1', amount: -40_000_000, accountId: 'loan', kind: 'opening' })],
    );
    expect(s.balances.find(b => b.account.id === 'loan')!.balance).toBe(-40_000_000);
  });

  it('nets money in and out of one account', () => {
    const s = computeAccountBalances([CASH], [
      entry({ id: 'e1', amount: 819_000 }),
      entry({ id: 'e2', amount: -267_878 }),
    ]);
    expect(s.balances[0].balance).toBe(551_122);
    expect(s.balances[0].entryCount).toBe(2);
  });

  it('counts an entry against the primary when its account no longer exists', () => {
    // Losing money from the books because somebody deleted an account is worse
    // than showing it in the wrong pot.
    const s = computeAccountBalances([CASH], [entry({ id: 'e1', amount: 500, accountId: 'gone' })]);
    expect(s.balances[0].balance).toBe(500);
  });

  it('handles a campaign with no accounts without throwing', () => {
    const s = computeAccountBalances([], [entry({ id: 'e1', amount: 500 })]);
    expect(s.balances).toEqual([]);
    expect(s.primary).toBeNull();
    expect(s.netWorth).toBe(0);
  });
});

describe('computeAccountBalances — transfers move both sides', () => {
  it('pays the mortgage down: cash falls, the loan rises toward zero', () => {
    const s = computeAccountBalances([CASH, LOAN], [
      entry({ id: 'open-cash', amount: 500_000, accountId: 'cash', kind: 'opening' }),
      entry({ id: 'open-loan', amount: -40_000_000, accountId: 'loan', kind: 'opening' }),
      entry({
        id: 'mortgage',
        amount: -201_335,
        accountId: 'cash',
        counterAccountId: 'loan',
        memo: 'Monthly mortgage',
      }),
    ]);
    expect(s.balances.find(b => b.account.id === 'cash')!.balance).toBe(298_665);
    expect(s.balances.find(b => b.account.id === 'loan')!.balance).toBe(-39_798_665);
  });

  it('counts a transfer against both accounts', () => {
    const s = computeAccountBalances([CASH, LOAN], [
      entry({ id: 'e1', amount: -100, accountId: 'cash', counterAccountId: 'loan' }),
    ]);
    expect(s.balances.find(b => b.account.id === 'cash')!.entryCount).toBe(1);
    expect(s.balances.find(b => b.account.id === 'loan')!.entryCount).toBe(1);
  });

  it('ignores a counter account that does not exist', () => {
    const s = computeAccountBalances([CASH], [
      entry({ id: 'e1', amount: -100, accountId: 'cash', counterAccountId: 'gone' }),
    ]);
    expect(s.balances[0].balance).toBe(-100);
  });

  it('nets to nothing when both sides name the same account', () => {
    // A mistake the user made. Netting to zero beats double-counting it.
    const s = computeAccountBalances([CASH], [
      entry({ id: 'e1', amount: -100, accountId: 'cash', counterAccountId: 'cash' }),
    ]);
    expect(s.balances[0].balance).toBe(0);
  });
});

describe('computeAccountBalances — totals', () => {
  const opening = [
    entry({ id: 'o1', amount: 500_000, accountId: 'cash', kind: 'opening' }),
    entry({ id: 'o2', amount: -40_000_000, accountId: 'loan', kind: 'opening' }),
  ];

  it('reports what is owed as a positive figure', () => {
    // So the UI never prints "owed -39,798,665".
    expect(computeAccountBalances([CASH, LOAN], opening).totalOwed).toBe(40_000_000);
  });

  it('totals the assets alone', () => {
    expect(computeAccountBalances([CASH, LOAN], opening).totalAssets).toBe(500_000);
  });

  it('reports net worth as assets minus debt', () => {
    expect(computeAccountBalances([CASH, LOAN], opening).netWorth).toBe(-39_500_000);
  });

  it('improves net worth as the mortgage is paid', () => {
    const before = computeAccountBalances([CASH, LOAN], opening).netWorth;
    const after = computeAccountBalances([CASH, LOAN], [
      ...opening,
      entry({ id: 'm', amount: -201_335, accountId: 'cash', counterAccountId: 'loan' }),
    ]).netWorth;
    // Paying debt converts cash into equity: the crew is no richer, but no
    // poorer either — the money moved, it did not leave.
    expect(after).toBe(before);
  });

  it('gets poorer when money simply leaves', () => {
    const after = computeAccountBalances([CASH, LOAN], [
      ...opening,
      entry({ id: 'fuel', amount: -40_000, accountId: 'cash' }),
    ]).netWorth;
    expect(after).toBe(-39_540_000);
  });
});

describe('entriesForAccount', () => {
  const entries = [
    entry({ id: 'income', amount: 819_000 }),
    entry({ id: 'mortgage', amount: -201_335, accountId: 'cash', counterAccountId: 'loan' }),
    entry({ id: 'loanOpen', amount: -40_000_000, accountId: 'loan', kind: 'opening' }),
  ];

  it('includes unassigned entries for the primary account', () => {
    const rows = entriesForAccount('cash', true, entries);
    expect(rows.map(r => r.id)).toEqual(['income', 'mortgage']);
  });

  it('excludes unassigned entries for a non-primary account', () => {
    const rows = entriesForAccount('loan', false, entries);
    expect(rows.map(r => r.id)).toEqual(['mortgage', 'loanOpen']);
  });

  it('flips the sign when the account is the counter side', () => {
    // The mortgage left Cash and arrived against the loan; each account should
    // read from its own point of view.
    const cash = entriesForAccount('cash', true, entries).find(r => r.id === 'mortgage')!;
    const loan = entriesForAccount('loan', false, entries).find(r => r.id === 'mortgage')!;
    expect(cash.signedForAccount).toBe(-201_335);
    expect(loan.signedForAccount).toBe(201_335);
  });

  it('returns nothing for an account no entry touches', () => {
    expect(entriesForAccount('escrow', false, entries)).toEqual([]);
  });
});
