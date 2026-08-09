import { describe, it, expect } from 'vitest';
import { renderLedgerToMarkdown } from './renderLedger';
import type { LedgerEntry } from '../../types/ledger';

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
