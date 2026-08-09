import { describe, it, expect } from 'vitest';
import {
  openDebts, netDebt, totalByDirection, addDebt, settleDebt, reopenDebt, removeDebt,
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
