import { describe, it, expect } from 'vitest';
import { renderLedgerToMarkdown } from './renderLedger';
import type { LedgerEntry } from '../../types/ledger';
import type { LedgerAccount } from '../../types/ledgerAccount';
import type { RecurringBill } from '../../types/recurringBill';

/**
 * The exported cashbook has to be readable without the app — that is the whole
 * point of exporting it. These tests pin the two things that make it auditable
 * months later: the running balance, and the fact that each distribution
 * carries the percentages that were agreed *at the time*, not the current ones.
 */

/** Credits, the way the Traveller engine renders them. */
const cr = (n: number) => `${n < 0 ? '-' : ''}Cr ${Math.abs(n).toLocaleString('en-US')}`;

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

const payout = entry({
  id: 'e2',
  date: '2026-08-09',
  memo: 'Tarkine salvage payout',
  amount: -409_500,
  gross: 819_000,
  createdAt: '2026-08-09T00:00:00.000Z',
  legs: [
    { kind: 'shipFund', amount: 409_500, pct: 50 },
    { kind: 'payee', payeeName: 'Milo Aer', amount: 147_420, pct: 36 },
    { kind: 'payee', payeeName: 'Eldon Holt', amount: 73_710, pct: 18 },
    { kind: 'unallocated', amount: 178_370, pct: 46 },
  ],
  splitSnapshot: {
    shipFundPct: 50,
    rows: [
      { id: 'r1', payeeName: 'Milo Aer', pct: 36 },
      { id: 'r2', payeeName: 'Eldon Holt', pct: 18 },
    ],
  },
});

const income = entry({ id: 'e1', memo: 'Cargo sale', amount: 819_000 });

describe('renderLedgerToMarkdown', () => {
  it('renders frontmatter with the entry count and closing balance', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income, payout], cr);
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('type: ledger');
    // Unquoted: `yamlValue` quotes only when the content needs it, matching the
    // other renderers rather than always wrapping.
    expect(md).toContain('campaign: Spinward Main');
    expect(md).toContain('entries: 2');
    expect(md).toContain('closing_balance: 409500');
  });

  it('quotes a campaign name that would otherwise break the frontmatter', () => {
    const md = renderLedgerToMarkdown('Pirates: Spinward Main', [income], cr);
    expect(md).toContain('campaign: "Pirates: Spinward Main"');
  });

  it('flattens a newline in a campaign name rather than emitting invalid YAML', () => {
    const md = renderLedgerToMarkdown('Spinward\nMain', [income], cr);
    const frontmatter = md.slice(0, md.indexOf('---', 4));
    expect(frontmatter).not.toMatch(/campaign: "[^"]*\n/);
  });

  it('renders a running-balance table', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income, payout], cr);
    expect(md).toContain('| Date | Description | In | Out | Balance |');
    // Income lands in the In column and out of the Out column.
    expect(md).toMatch(/\| 2026-08-08 \| Cargo sale \| Cr 819,000 \|\s*\|/);
    expect(md).toContain('**Closing balance: Cr 409,500**');
  });

  it('renders every leg with the percentage it was computed from', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income, payout], cr);
    expect(md).toContain('Ship fund (50%)');
    expect(md).toContain('Milo Aer (36%)');
    expect(md).toContain('Eldon Holt (18%)');
    expect(md).toContain('Unallocated (46%)');
  });

  it('marks the ship fund retained and the payees paid', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income, payout], cr);
    // The distinction the whole schema exists to preserve: retained money did
    // not leave the book, so the reader must not count it as an outflow.
    expect(md).toMatch(/Ship fund \(50%\) — retained/);
    expect(md).toMatch(/Milo Aer \(36%\) — paid/);
  });

  it('records the agreed percentages in their own section', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income, payout], cr);
    expect(md).toContain('## Distributions');
    expect(md).toContain('agreed at the time of each payout');
    expect(md).toContain('Ship fund: 50% (retained)');
    expect(md).toContain('Milo Aer: 36%');
  });

  it('renders an empty book without a table', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [], cr);
    expect(md).toContain('entries: 0');
    expect(md).toContain('_No entries yet._');
    expect(md).not.toContain('| Date |');
  });

  it('omits the Distributions section when nothing was distributed', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [income], cr);
    expect(md).not.toContain('## Distributions');
  });

  it('orders rows by the fold, not by the order they were passed', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [payout, income], cr);
    expect(md.indexOf('Cargo sale')).toBeLessThan(md.indexOf('Tarkine salvage payout'));
  });

  it('escapes a pipe in a memo so it cannot split the table row', () => {
    const md = renderLedgerToMarkdown(
      'Spinward Main',
      [entry({ id: 'e3', memo: 'fuel | berthing', amount: -100 })],
      cr,
    );
    expect(md).toContain('fuel \\| berthing');
  });

  it('flattens a newline in a memo rather than breaking the table', () => {
    const md = renderLedgerToMarkdown(
      'Spinward Main',
      [entry({ id: 'e4', memo: 'line one\nline two', amount: -100 })],
      cr,
    );
    expect(md).toContain('line one line two');
  });

  it('uses the supplied formatter, holding no currency knowledge itself', () => {
    const coins = (n: number) => `${n}c`;
    const md = renderLedgerToMarkdown('Dragonbane Camp', [income], coins);
    expect(md).toContain('819000c');
    expect(md).not.toContain('Cr');
  });

  it('falls back to a dash for an unlabelled entry', () => {
    const md = renderLedgerToMarkdown('Spinward Main', [entry({ id: 'e5', amount: -1 })], cr);
    expect(md).toContain('| — |');
  });
});


/**
 * The account structure, added after the entries-only export had already
 * shipped. Two things were wrong with it by then: the Balance column folded
 * every account together — the mortgage's opening alongside a fuel purchase —
 * so it reported a figure that was not any quantity the crew had and no longer
 * matched the screen; and the mortgage, the escrow and the monthly nut were
 * absent altogether.
 */

function account(over: Partial<LedgerAccount> & { id: string; name: string }): LedgerAccount {
  return {
    campaignId: 'c1',
    kind: 'asset',
    isPrimary: false,
    contingent: false,
    note: '',
    schemaVersion: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  } as LedgerAccount;
}

function bill(over: Partial<RecurringBill> & { name: string; amount: number }): RecurringBill {
  return {
    id: `b-${over.name}`,
    campaignId: 'c1',
    everyDays: 30,
    startDate: '097-1105',
    postedThrough: '',
    postedCount: 0,
    active: true,
    note: '',
    schemaVersion: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

const CASH = account({ id: 'cash', name: 'Cash', isPrimary: true });
const LOAN = account({ id: 'loan', name: 'Ship mortgage', kind: 'liability', note: 'The Leap' });
const ESCROW = account({
  id: 'escrow', name: 'Benefactor escrow', kind: 'liability', contingent: true,
});

const openCash = entry({ id: 'o1', memo: 'Opening balance — Cash', amount: 500_000, accountId: 'cash', kind: 'opening' });
const openLoan = entry({ id: 'o2', memo: 'Opening balance — Ship mortgage', amount: -40_000_000, accountId: 'loan', kind: 'opening' });

describe('renderLedgerToMarkdown — with accounts', () => {
  const md = () =>
    renderLedgerToMarkdown('Spinward Main', [openCash, openLoan], cr, {
      accounts: [CASH, LOAN, ESCROW],
    });

  it('folds cash on hand, not every account together', () => {
    // The mortgage moves the loan account and no cash whatsoever, so the
    // mortgage's own row must leave the Cash column where it was. Asserted on
    // that row rather than on the whole document: -Cr 39,500,000 legitimately
    // appears further down as the net position.
    const mortgageRow = md()
      .split('\n')
      .find(l => l.includes('Opening balance — Ship mortgage'));
    expect(mortgageRow).toBeDefined();
    expect(mortgageRow!.endsWith('| Cr 500,000 |')).toBe(true);
    expect(md()).toContain('**Closing cash: Cr 500,000**');
  });

  it('names the column Cash so the number is not mistaken for a net worth', () => {
    expect(md()).toContain('| Date | Description | In | Out | Cash |');
  });

  it('renames the frontmatter key alongside the column', () => {
    // A reader diffing two exports should not find closing_balance silently
    // changing meaning between them.
    expect(md()).toContain('closing_cash: 500000');
    expect(md()).not.toContain('closing_balance:');
  });

  it('lists every account with its type', () => {
    const out = md();
    expect(out).toContain('## Accounts');
    expect(out).toContain('| Cash _(default)_ | Asset |');
    expect(out).toContain('| Ship mortgage | Liability |');
    expect(out).toContain('| Benefactor escrow | Contingent liability |');
  });

  it('prints a liability as its magnitude, as the screen does', () => {
    expect(md()).toContain('Cr 40,000,000');
    expect(md()).not.toContain('-Cr 40,000,000');
  });

  it('carries the account note', () => {
    expect(md()).toContain('The Leap');
  });

  it('reports the standing position and excludes contingent debt from it', () => {
    const out = md();
    expect(out).toContain('- Assets: Cr 500,000');
    expect(out).toContain('- Liabilities: Cr 40,000,000');
    expect(out).toContain('**Net position: -Cr 39,500,000**');
  });

  it('keeps the old fold when no accounts are supplied', () => {
    // The three-argument call is a single-account cashbook and still correct.
    const out = renderLedgerToMarkdown('Spinward Main', [openCash, openLoan], cr);
    expect(out).toContain('| Date | Description | In | Out | Balance |');
    expect(out).toContain('**Closing balance: -Cr 39,500,000**');
  });
});

describe('renderLedgerToMarkdown — recurring charges', () => {
  const withBills = (bills: RecurringBill[], campaignDate?: string) =>
    renderLedgerToMarkdown('Spinward Main', [openCash], cr, {
      accounts: [CASH], bills, campaignDate,
    });

  it('lists a charge with its amount and interval', () => {
    const out = withBills([bill({ name: 'Life support', amount: 10_000 })]);
    expect(out).toContain('## Recurring charges');
    expect(out).toContain('| Life support | Cr 10,000 | every 30 days |');
  });

  it('reports a term as remaining of total', () => {
    const out = withBills([
      bill({ name: 'Mortgage', amount: 201_335, occurrenceLimit: 27, postedCount: 4 }),
    ]);
    expect(out).toContain('23 of 27');
  });

  it('calls an open-ended charge open-ended rather than leaving it blank', () => {
    expect(withBills([bill({ name: 'Berthing', amount: 7_000 })])).toContain('open-ended');
  });

  it('marks a suspended charge rather than showing a due date it will not meet', () => {
    const out = withBills([bill({ name: 'Berthing', amount: 7_000, active: false })]);
    expect(out).toContain('suspended');
  });

  it('states the date the charges are accrued through', () => {
    const out = withBills([bill({ name: 'Life support', amount: 10_000 })], '187-1105');
    expect(out).toContain('Accrued through **187-1105**');
  });

  it('omits the section entirely when there are no charges', () => {
    expect(withBills([])).not.toContain('## Recurring charges');
  });
});
