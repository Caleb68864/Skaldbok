import { describe, it, expect } from 'vitest';
import {
  openDebts, netDebt, totalByDirection, addDebt, settleDebt, reopenDebt, removeDebt,
  paidSoFar, outstanding, isFullyPaid, payDebt, removeDebtPayment,
  type Debt,
} from './debts';

const d = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', counterparty: 'Rell', amount: 10000, direction: 'owed',
  note: 'vacc suit', createdAt: '2026-08-08T00:00:00.000Z', ...over,
});

const NOW = '2026-08-09T00:00:00.000Z';

describe('openDebts', () => {
  it('excludes settled ones', () => {
    const list = [d(), d({ id: 'd2', settledAt: NOW })];
    expect(openDebts(list).map(x => x.id)).toEqual(['d1']);
  });
  it('handles an absent list', () => {
    expect(openDebts(undefined)).toEqual([]);
  });
});

describe('netDebt', () => {
  it('is positive when you owe more than you are owed', () => {
    expect(netDebt([d({ amount: 10000, direction: 'owed' })])).toBe(10000);
  });
  it('subtracts what you are owed', () => {
    expect(netDebt([
      d({ id: 'a', amount: 10000, direction: 'owed' }),
      d({ id: 'b', amount: 4000, direction: 'due' }),
    ])).toBe(6000);
  });
  it('ignores settled debts, so repaying actually changes the number', () => {
    expect(netDebt([d({ settledAt: NOW })])).toBe(0);
  });
});

describe('totalByDirection', () => {
  it('sums one side only', () => {
    const list = [
      d({ id: 'a', amount: 10000, direction: 'owed' }),
      d({ id: 'b', amount: 2500, direction: 'owed' }),
      d({ id: 'c', amount: 4000, direction: 'due' }),
    ];
    expect(totalByDirection(list, 'owed')).toBe(12500);
    expect(totalByDirection(list, 'due')).toBe(4000);
  });
});

describe('addDebt', () => {
  it('appends with the supplied id and timestamp', () => {
    const patch = addDebt({ debts: [] }, {
      counterparty: 'Rell', amount: 10000, direction: 'owed', note: 'vacc suit',
    }, 'new-1', NOW);
    expect(patch.debts).toHaveLength(1);
    expect(patch.debts![0]).toMatchObject({ id: 'new-1', createdAt: NOW, amount: 10000 });
  });
  it('does not mutate the existing list', () => {
    const existing: Debt[] = [d()];
    addDebt({ debts: existing }, { counterparty: 'X', amount: 1, direction: 'due' }, 'n', NOW);
    expect(existing).toHaveLength(1);
  });
});

describe('settleDebt', () => {
  it('marks settled without removing the row', () => {
    // "Did I ever pay Rell back?" is asked months later; a deleted row
    // answers with silence.
    const patch = settleDebt({ debts: [d()] }, 'd1', NOW)!;
    expect(patch.debts).toHaveLength(1);
    expect(patch.debts![0].settledAt).toBe(NOW);
  });
  it('returns null for an unknown or already-settled debt', () => {
    expect(settleDebt({ debts: [d()] }, 'nope', NOW)).toBeNull();
    expect(settleDebt({ debts: [d({ settledAt: NOW })] }, 'd1', NOW)).toBeNull();
  });
});

describe('reopenDebt', () => {
  it('clears settledAt', () => {
    const patch = reopenDebt({ debts: [d({ settledAt: NOW })] }, 'd1')!;
    expect(patch.debts![0].settledAt).toBeUndefined();
    expect('settledAt' in patch.debts![0]).toBe(false);
  });
  it('returns null when the debt is already open', () => {
    expect(reopenDebt({ debts: [d()] }, 'd1')).toBeNull();
  });
});

describe('removeDebt', () => {
  it('drops the row entirely', () => {
    expect(removeDebt({ debts: [d()] }, 'd1').debts).toEqual([]);
  });
  it('leaves others alone', () => {
    expect(removeDebt({ debts: [d(), d({ id: 'd2' })] }, 'd1').debts!.map(x => x.id)).toEqual(['d2']);
  });
});

// ── Part-payments ───────────────────────────────────────────────

describe('outstanding', () => {
  it('is the full amount when nothing has been paid', () => {
    expect(outstanding(d())).toBe(10000);
    expect(paidSoFar(d())).toBe(0);
  });

  it('subtracts what has been paid', () => {
    const debt = d({ payments: [{ id: 'p1', amount: 4000, at: NOW }] });
    expect(paidSoFar(debt)).toBe(4000);
    expect(outstanding(debt)).toBe(6000);
    expect(isFullyPaid(debt)).toBe(false);
  });

  it('sums several payments', () => {
    const debt = d({
      payments: [
        { id: 'p1', amount: 4000, at: NOW },
        { id: 'p2', amount: 1000, at: NOW },
      ],
    });
    expect(outstanding(debt)).toBe(5000);
  });

  it('clamps at zero rather than running negative on an overpayment', () => {
    // An overpaid debt must not start counting the other way in netDebt.
    const debt = d({ payments: [{ id: 'p1', amount: 12000, at: NOW }] });
    expect(outstanding(debt)).toBe(0);
    expect(isFullyPaid(debt)).toBe(true);
  });
});

describe('payDebt', () => {
  it('records a part-payment without touching the original amount', () => {
    const patch = payDebt({ debts: [d()] }, 'd1', 4000, 'p1', NOW);
    const debt = patch!.debts![0];
    expect(debt.amount).toBe(10000);
    expect(debt.payments).toHaveLength(1);
    expect(outstanding(debt)).toBe(6000);
    expect(debt.settledAt).toBeUndefined();
  });

  it('keeps the debt open while anything is outstanding', () => {
    const patch = payDebt({ debts: [d()] }, 'd1', 9999, 'p1', NOW);
    expect(openDebts(patch!.debts).map(x => x.id)).toEqual(['d1']);
  });

  it('settles the debt in the same write when the balance clears', () => {
    const patch = payDebt({ debts: [d()] }, 'd1', 10000, 'p1', NOW);
    const debt = patch!.debts![0];
    expect(debt.settledAt).toBe(NOW);
    expect(openDebts(patch!.debts)).toEqual([]);
  });

  it('settles on an overpayment too', () => {
    const patch = payDebt({ debts: [d()] }, 'd1', 12000, 'p1', NOW);
    expect(patch!.debts![0].settledAt).toBe(NOW);
  });

  it('accumulates payments across several instalments', () => {
    const first = payDebt({ debts: [d()] }, 'd1', 4000, 'p1', NOW)!;
    const second = payDebt(first, 'd1', 6000, 'p2', NOW)!;
    const debt = second.debts![0];
    expect(debt.payments).toHaveLength(2);
    expect(outstanding(debt)).toBe(0);
    expect(debt.settledAt).toBe(NOW);
  });

  it('stores an optional note against the payment', () => {
    const patch = payDebt({ debts: [d()] }, 'd1', 100, 'p1', NOW, 'sold the suit');
    expect(patch!.debts![0].payments![0].note).toBe('sold the suit');
  });

  it('writes nothing for a missing debt', () => {
    expect(payDebt({ debts: [d()] }, 'nope', 100, 'p1', NOW)).toBeNull();
  });

  it('writes nothing against an already-settled debt', () => {
    expect(payDebt({ debts: [d({ settledAt: NOW })] }, 'd1', 100, 'p1', NOW)).toBeNull();
  });

  it('refuses a zero or negative payment', () => {
    // A mis-tap, not a repayment — recording it would litter the history.
    expect(payDebt({ debts: [d()] }, 'd1', 0, 'p1', NOW)).toBeNull();
    expect(payDebt({ debts: [d()] }, 'd1', -500, 'p1', NOW)).toBeNull();
  });

  it('leaves other debts untouched', () => {
    const patch = payDebt({ debts: [d(), d({ id: 'd2', amount: 500 })] }, 'd1', 100, 'p1', NOW);
    expect(patch!.debts![1].payments).toBeUndefined();
  });
});

describe('part-payments move the totals', () => {
  it('reduces what you owe', () => {
    const before = [d({ amount: 10000, direction: 'owed' })];
    const after = payDebt({ debts: before }, 'd1', 4000, 'p1', NOW)!.debts!;
    expect(totalByDirection(before, 'owed')).toBe(10000);
    expect(totalByDirection(after, 'owed')).toBe(6000);
  });

  it('reduces the net position', () => {
    const before = [d({ amount: 10000, direction: 'owed' })];
    const after = payDebt({ debts: before }, 'd1', 4000, 'p1', NOW)!.debts!;
    expect(netDebt(before)).toBe(10000);
    expect(netDebt(after)).toBe(6000);
  });

  it('drops a fully-paid debt out of the totals entirely', () => {
    const after = payDebt({ debts: [d()] }, 'd1', 10000, 'p1', NOW)!.debts!;
    expect(netDebt(after)).toBe(0);
    expect(totalByDirection(after, 'owed')).toBe(0);
  });
});

describe('removeDebtPayment', () => {
  it('takes a mis-typed payment back off', () => {
    const paid = payDebt({ debts: [d()] }, 'd1', 4000, 'p1', NOW)!;
    const patch = removeDebtPayment(paid, 'd1', 'p1')!;
    expect(patch.debts![0].payments).toEqual([]);
    expect(outstanding(patch.debts![0])).toBe(10000);
  });

  it('reopens a debt that was settled by the payment it removes', () => {
    const paid = payDebt({ debts: [d()] }, 'd1', 10000, 'p1', NOW)!;
    expect(paid.debts![0].settledAt).toBe(NOW);
    const patch = removeDebtPayment(paid, 'd1', 'p1')!;
    expect(patch.debts![0].settledAt).toBeUndefined();
    expect(openDebts(patch.debts).map(x => x.id)).toEqual(['d1']);
  });

  it('leaves a debt settled by hand alone', () => {
    // Settled manually, then a stray payment removed — the manual settle stands.
    const start = { debts: [d({ payments: [{ id: 'p1', amount: 100, at: NOW }] })] };
    const settled = settleDebt(start, 'd1', NOW)!;
    const patch = removeDebtPayment(settled, 'd1', 'p1')!;
    expect(patch.debts![0].settledAt).toBe(NOW);
  });

  it('writes nothing for an unknown payment', () => {
    expect(removeDebtPayment({ debts: [d()] }, 'd1', 'nope')).toBeNull();
  });
});
