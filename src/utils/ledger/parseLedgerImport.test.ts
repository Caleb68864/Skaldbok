import { describe, it, expect } from 'vitest';
import { parseLedgerImport, parseMoney } from './parseLedgerImport';

const ok = (r: ReturnType<typeof parseLedgerImport>) => {
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
  return r;
};

describe('parseMoney', () => {
  it('reads a plain number', () => {
    expect(parseMoney(201335)).toBe(201335);
    expect(parseMoney('201335')).toBe(201335);
  });

  it('reads the ways people actually write credits', () => {
    expect(parseMoney('Cr201,335')).toBe(201335);
    expect(parseMoney('Cr 201 335')).toBe(201335);
    expect(parseMoney('201_335')).toBe(201335);
  });

  it('reads accounting parentheses as negative', () => {
    expect(parseMoney('(1,200)')).toBe(-1200);
    expect(parseMoney('(Cr1,200)')).toBe(-1200);
  });

  it('reads a leading minus', () => {
    expect(parseMoney('-267878')).toBe(-267878);
    expect(parseMoney('-Cr267,878')).toBe(-267878);
  });

  it('truncates a fractional value rather than storing a float', () => {
    expect(parseMoney('10.7')).toBe(10);
  });

  it('returns null for anything unreadable, never a silent zero', () => {
    // A zero would be a transaction that vanishes from the balance while still
    // appearing in the list.
    expect(parseMoney('a lot')).toBeNull();
    expect(parseMoney('')).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney({})).toBeNull();
  });
});

describe('parseLedgerImport — accounts', () => {
  it('reads accounts with their kinds and openings', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      accounts: [
        { name: 'Cash', kind: 'asset', opening: 500000 },
        { name: 'Ship Loan', kind: 'liability', opening: -40000000 },
      ],
    })));
    expect(r.accounts).toHaveLength(2);
    expect(r.accounts[1]).toMatchObject({ name: 'Ship Loan', kind: 'liability', opening: -40000000 });
  });

  it('flips a debt written as a positive figure, and says so', () => {
    // "We owe 40 million" is the natural way to say it and the opposite of how
    // it is stored.
    const r = ok(parseLedgerImport(JSON.stringify({
      accounts: [{ name: 'Ship Loan', kind: 'liability', opening: 40000000 }],
    })));
    expect(r.accounts[0].opening).toBe(-40000000);
    expect(r.warnings.join(' ')).toContain('recorded as owed');
  });

  it('recognises the words people use for a debt', () => {
    for (const kind of ['liability', 'debt', 'loan', 'owed']) {
      const r = ok(parseLedgerImport(JSON.stringify({ accounts: [{ name: 'X', kind }] })));
      expect(r.accounts[0].kind).toBe('liability');
    }
  });

  it('defaults to an asset', () => {
    const r = ok(parseLedgerImport(JSON.stringify({ accounts: [{ name: 'Cash' }] })));
    expect(r.accounts[0].kind).toBe('asset');
  });

  it('skips a nameless account and a duplicate', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      accounts: [{ name: 'Cash' }, { opening: 1 }, { name: 'cash', opening: 99 }],
    })));
    expect(r.accounts).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('no name');
    expect(r.warnings.join(' ')).toContain('more than once');
  });
});

describe('parseLedgerImport — entry signs', () => {
  const one = (entry: unknown) =>
    ok(parseLedgerImport(JSON.stringify({ entries: [entry] }))).entries[0];

  it('takes a negative amount as money out', () => {
    expect(one({ amount: -267878, memo: 'nut' }).amount).toBe(-267878);
  });

  it('takes a positive amount as money in', () => {
    expect(one({ amount: 819000, memo: 'cargo' }).amount).toBe(819000);
  });

  it('honours an explicit direction', () => {
    expect(one({ amount: 267878, direction: 'out' }).amount).toBe(-267878);
    expect(one({ amount: 819000, direction: 'in' }).amount).toBe(819000);
  });

  it('recognises the words for each direction', () => {
    for (const d of ['out', 'expense', 'debit', 'paid', 'payment']) {
      expect(one({ amount: 100, direction: d }).amount).toBe(-100);
    }
    for (const d of ['in', 'income', 'credit', 'received']) {
      expect(one({ amount: 100, direction: d }).amount).toBe(100);
    }
  });

  it('reads separate in and out columns, the way a cashbook reads', () => {
    expect(one({ in: 819000, memo: 'cargo' }).amount).toBe(819000);
    expect(one({ out: 267878, memo: 'nut' }).amount).toBe(-267878);
  });

  it('skips an entry carrying both an in and an out figure', () => {
    // Ambiguous, and guessing would be wrong half the time.
    const r = ok(parseLedgerImport(JSON.stringify({
      entries: [{ amount: 5, memo: 'fine' }, { in: 100, out: 50 }],
    })));
    expect(r.entries).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('both an in and an out');
  });

  it('explains why when every entry is unreadable, rather than just failing', () => {
    // The warnings are the only account the user gets of what is wrong with
    // their file; swallowing them leaves them with nothing to fix.
    const r = parseLedgerImport(JSON.stringify({ entries: [{ in: 100, out: 50 }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('both an in and an out');
  });

  it('warns when direction and sign disagree, and trusts the sign', () => {
    const r = ok(parseLedgerImport(JSON.stringify({ entries: [{ amount: -100, direction: 'in' }] })));
    expect(r.entries[0].amount).toBe(-100);
    expect(r.warnings.join(' ')).toContain('marked as money in');
  });

  it('skips an entry for nothing but keeps the rest', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      entries: [{ amount: 5, memo: 'real' }, { amount: 0, memo: 'x' }],
    })));
    expect(r.entries).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('for nothing');
  });

  it('skips an entry with no readable amount but keeps the rest', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      entries: [{ amount: 5, memo: 'real' }, { memo: 'some money' }],
    })));
    expect(r.entries).toHaveLength(1);
    expect(r.warnings.join(' ')).toContain('no readable amount');
  });
});

describe('parseLedgerImport — shapes and fields', () => {
  it('reads a bare array of entries', () => {
    const r = ok(parseLedgerImport('[{"amount":100,"memo":"a"}]'));
    expect(r.entries).toHaveLength(1);
  });

  it('accepts the other names for the entry list', () => {
    for (const key of ['entries', 'transactions', 'ledger', 'lines']) {
      const r = ok(parseLedgerImport(JSON.stringify({ [key]: [{ amount: 1 }] })));
      expect(r.entries).toHaveLength(1);
    }
  });

  it('reads the alternative names for date and memo', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      entries: [{ when: '2026-08-08', description: 'Monthly nut', amount: -267878 }],
    })));
    expect(r.entries[0].date).toBe('2026-08-08');
    expect(r.entries[0].memo).toBe('Monthly nut');
  });

  it('carries account names through for both sides of a transfer', () => {
    const r = ok(parseLedgerImport(JSON.stringify({
      entries: [{ amount: -201335, account: 'Cash', counterAccount: 'Ship Loan' }],
    })));
    expect(r.entries[0]).toMatchObject({ accountName: 'Cash', counterAccountName: 'Ship Loan' });
  });

  it('rejects text that is not JSON', () => {
    const r = parseLedgerImport('nope');
    expect(r.ok).toBe(false);
  });

  it('rejects a file with neither accounts nor entries', () => {
    const r = parseLedgerImport('{"campaign":"Spinward Main"}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Could not find anything');
  });

  it('refuses a runaway file', () => {
    const many = JSON.stringify(Array.from({ length: 1001 }, () => ({ amount: 1 })));
    const r = parseLedgerImport(many);
    expect(r.ok).toBe(false);
  });
});

describe('parseLedgerImport — the real Session 1 position', () => {
  it('reads the crew opening position and its first transactions', () => {
    const file = JSON.stringify({
      accounts: [
        { name: 'Cash', kind: 'asset', opening: 'Cr0' },
        { name: 'Ship Loan', kind: 'debt', opening: 'Cr40,000,000', note: 'The Leap — far trader' },
      ],
      entries: [
        { date: '2026-08-08', description: "Milo — rescue bubble and recon wardrobe", out: 'Cr5,100' },
        { date: '2026-08-08', description: 'Johnathan — vacc suit', out: 'Cr20,000' },
        { date: '2026-08-08', description: "Johnathan — half of Milo's vacc suit", out: 'Cr10,000' },
        {
          date: '2026-08-08',
          description: 'Monthly mortgage',
          out: 'Cr201,335',
          account: 'Cash',
          counterAccount: 'Ship Loan',
        },
      ],
    });
    const r = ok(parseLedgerImport(file));

    expect(r.accounts.map(a => a.name)).toEqual(['Cash', 'Ship Loan']);
    expect(r.accounts[1].opening).toBe(-40_000_000);
    expect(r.accounts[1].note).toContain('far trader');

    expect(r.entries).toHaveLength(4);
    expect(r.entries.map(e => e.amount)).toEqual([-5_100, -20_000, -10_000, -201_335]);
    expect(r.entries[3].counterAccountName).toBe('Ship Loan');
  });
});
