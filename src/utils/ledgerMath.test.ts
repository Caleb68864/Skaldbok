import { describe, it, expect } from 'vitest';
import {
  computeRunningBalance,
  validateSplit,
  evenSplit,
  computeDistribution,
} from './ledgerMath';
import type { LedgerEntry, SplitSnapshot } from '../types/ledger';

function entry(over: Partial<LedgerEntry> & { id: string; amount: number }): LedgerEntry {
  return {
    campaignId: 'c1',
    date: '2026-08-01',
    memo: '',
    schemaVersion: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function split(shipFundPct: number, pcts: number[]): SplitSnapshot {
  return {
    shipFundPct,
    rows: pcts.map((pct, i) => ({ id: `r${i}`, payeeName: `Payee ${i}`, pct })),
  };
}

describe('computeRunningBalance', () => {
  it('folds a mixed in/out sequence into a running total', () => {
    const rows = computeRunningBalance([
      entry({ id: 'a', amount: 100_000, date: '2026-08-01' }),
      entry({ id: 'b', amount: -30_000, date: '2026-08-02' }),
      entry({ id: 'c', amount: -5_000, date: '2026-08-03' }),
    ]);
    expect(rows.map(r => r.balance)).toEqual([100_000, 70_000, 65_000]);
  });

  it('orders by date before createdAt', () => {
    const rows = computeRunningBalance([
      entry({ id: 'late', amount: 1, date: '2026-08-05', createdAt: '2026-08-01T00:00:00.000Z' }),
      entry({ id: 'early', amount: 2, date: '2026-08-01', createdAt: '2026-08-09T00:00:00.000Z' }),
    ]);
    expect(rows.map(r => r.id)).toEqual(['early', 'late']);
  });

  it('breaks a same-millisecond tie by id, so the order is stable across reads', () => {
    const same = { date: '2026-08-01', createdAt: '2026-08-01T10:00:00.000Z' };
    const forward = computeRunningBalance([
      entry({ id: 'bbb', amount: 5, ...same }),
      entry({ id: 'aaa', amount: 7, ...same }),
    ]);
    const reversed = computeRunningBalance([
      entry({ id: 'aaa', amount: 7, ...same }),
      entry({ id: 'bbb', amount: 5, ...same }),
    ]);
    expect(forward.map(r => r.id)).toEqual(['aaa', 'bbb']);
    expect(reversed.map(r => r.id)).toEqual(forward.map(r => r.id));
  });

  it('does not mutate the array it was given', () => {
    const input = [entry({ id: 'b', amount: 1, date: '2026-08-02' }), entry({ id: 'a', amount: 1, date: '2026-08-01' })];
    computeRunningBalance(input);
    expect(input.map(e => e.id)).toEqual(['b', 'a']);
  });

  it('returns an empty list for an empty book', () => {
    expect(computeRunningBalance([])).toEqual([]);
  });
});

describe('validateSplit', () => {
  it('calls exactly 100 ok', () => {
    expect(validateSplit(split(50, [30, 30, 40]))).toEqual({ total: 100, status: 'ok' });
  });

  it('calls a shortfall under', () => {
    expect(validateSplit(split(50, [30, 30]))).toEqual({ total: 60, status: 'under' });
  });

  it('calls an overcommit over', () => {
    expect(validateSplit(split(50, [60, 50]))).toEqual({ total: 110, status: 'over' });
  });

  it('treats an empty crew as under, not ok', () => {
    expect(validateSplit(split(50, [])).status).toBe('under');
  });
});

describe('evenSplit', () => {
  it('puts the remainder on the leading rows', () => {
    expect(evenSplit(3)).toEqual([34, 33, 33]);
  });

  it('divides cleanly when it can', () => {
    expect(evenSplit(4)).toEqual([25, 25, 25, 25]);
  });

  it('always sums to exactly 100', () => {
    for (let n = 1; n <= 12; n++) {
      expect(evenSplit(n).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it('handles a single share', () => {
    expect(evenSplit(1)).toEqual([100]);
  });

  it('returns nothing for a non-positive count', () => {
    expect(evenSplit(0)).toEqual([]);
    expect(evenSplit(-2)).toEqual([]);
  });
});

describe('computeDistribution', () => {
  it('retains the ship fund and pays out only the rest', () => {
    const { legs, net } = computeDistribution(100_000, split(50, [30, 30]));

    const shipFund = legs.find(l => l.kind === 'shipFund')!;
    const payees = legs.filter(l => l.kind === 'payee');
    const unallocated = legs.find(l => l.kind === 'unallocated')!;

    expect(shipFund.amount).toBe(50_000);
    expect(payees.map(l => l.amount)).toEqual([15_000, 15_000]);
    expect(unallocated.amount).toBe(20_000);

    // I1 — every credit accounted for.
    expect(legs.reduce((s, l) => s + l.amount, 0)).toBe(100_000);
    // I2 — only the money that actually left is subtracted.
    expect(net).toBe(-50_000);
  });

  it('subtracts nothing when the whole sum is retained', () => {
    const { legs, net } = computeDistribution(50_000, split(100, []));
    expect(legs.find(l => l.kind === 'shipFund')!.amount).toBe(50_000);
    expect(net).toBe(0);
  });

  it('pays out everything when there is no ship fund', () => {
    const { net } = computeDistribution(60_000, split(0, [50, 50]));
    expect(net).toBe(-60_000);
  });

  it('snapshots each payee name and percentage onto its leg', () => {
    const { legs } = computeDistribution(1_000, split(0, [60, 40]));
    const payees = legs.filter(l => l.kind === 'payee');
    expect(payees.map(l => l.payeeName)).toEqual(['Payee 0', 'Payee 1']);
    expect(payees.map(l => l.pct)).toEqual([60, 40]);
  });

  it('omits the unallocated leg when the split is exact', () => {
    const { legs } = computeDistribution(1_000, split(50, [100]));
    expect(legs.some(l => l.kind === 'unallocated')).toBe(false);
  });

  it('holds both invariants across inputs chosen to force rounding', () => {
    const cases: Array<[number, number, number[]]> = [
      [100_000, 50, [30, 30]],
      [99_999, 33, [33, 33, 34]],
      [7, 50, [50, 50]],
      [1, 50, [100]],
      [3, 33, [33, 33, 34]],
      [1_000_003, 17, [11, 22, 33, 34]],
      [13, 7, [50, 50]],
      [101, 3, [97, 3]],
      [55_555, 50, [20, 20, 20, 20, 20]],
      [12_345, 12, [12, 34, 54]],
      [999, 99, [1, 99]],
      [8, 25, [33, 33, 34]],
      [77, 11, [11, 89]],
      [1_000, 1, [1]],
      [64, 50, [25, 25, 25, 25]],
      [37, 60, [40, 60]],
      [500_001, 45, [15, 15, 15, 55]],
      [23, 0, [33, 33, 34]],
      [9_999_991, 50, [7, 13, 80]],
      [2, 50, [50, 50]],
      [1_234_567, 37, [19, 23, 29, 29]],
      [45, 100, []],
    ];

    for (const [gross, shipFundPct, pcts] of cases) {
      const s = split(shipFundPct, pcts);
      const { legs, net } = computeDistribution(gross, s);
      const legTotal = legs.reduce((sum, l) => sum + l.amount, 0);
      const retained = legs.find(l => l.kind === 'shipFund')!.amount;

      // `|| 0` because -(0) is -0, which toBe compares with Object.is.
      const expectedNet = -(gross - retained) || 0;
      expect(legTotal, `I1 for gross=${gross} fund=${shipFundPct}%`).toBe(gross);
      expect(net, `I2 for gross=${gross} fund=${shipFundPct}%`).toBe(expectedNet);
      expect(legs.every(l => Number.isInteger(l.amount) && l.amount >= 0)).toBe(true);
    }
  });

  it('refuses a non-positive gross rather than writing a meaningless entry', () => {
    expect(() => computeDistribution(0, split(50, [100]))).toThrow(/positive whole amount/);
    expect(() => computeDistribution(-5, split(50, [100]))).toThrow(/positive whole amount/);
  });

  it('refuses a fractional gross', () => {
    expect(() => computeDistribution(10.5, split(50, [100]))).toThrow(/positive whole amount/);
  });

  it('refuses to pay out more than the pot', () => {
    expect(() => computeDistribution(1_000, split(50, [60, 50]))).toThrow(/more than the 100%/);
  });

  it('refuses a nonsensical ship fund', () => {
    expect(() => computeDistribution(1_000, split(150, [100]))).toThrow(/between 0% and 100%/);
  });
});
