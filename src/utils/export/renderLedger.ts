import type { LedgerEntry, LedgerLeg } from '../../types/ledger';
import { computeRunningBalance } from '../ledgerMath';

/** Escapes a value for a Markdown table cell, where a raw pipe would split the row. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** How a leg reads in the exported book. */
function legLabel(leg: LedgerLeg): string {
  if (leg.kind === 'shipFund') return 'Ship fund';
  if (leg.kind === 'unallocated') return 'Unallocated';
  return leg.payeeName ?? 'Unnamed payee';
}

/**
 * Renders a campaign's cashbook as Markdown.
 *
 * @remarks
 * Frontmatter plus a running-balance table, matching the house style set by
 * `renderSession`. Every distribution additionally renders its legs as indented
 * rows carrying the percentage each was computed from, so the exported book is
 * self-auditing: a reader asking "why did Milo get 15,000 in session 3?" can
 * answer it from the file alone, without the app and without the current split.
 *
 * `formatMoney` is supplied by the caller from the campaign system's engine, so
 * this module holds no currency knowledge.
 *
 * Deliberately **unfiltered** — unlike the note export paths, which apply
 * `excludePrivateNotes`. A campaign cashbook is shared crew data by definition
 * and entries carry no private flag.
 *
 * @param campaignName - Title for the document.
 * @param entries - The campaign's entries; ordering and balances are derived here.
 * @param formatMoney - Renders a signed base-unit integer, e.g. `Cr 15,000`.
 */
export function renderLedgerToMarkdown(
  campaignName: string,
  entries: LedgerEntry[],
  formatMoney: (baseUnits: number) => string,
): string {
  const rows = computeRunningBalance(entries);
  const closing = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  const lines: string[] = [];
  lines.push('---');
  lines.push('type: ledger');
  lines.push(`campaign: "${campaignName.replace(/"/g, '\\"')}"`);
  lines.push(`entries: ${rows.length}`);
  lines.push(`closing_balance: ${closing}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${campaignName} — Ledger`);
  lines.push('');

  if (rows.length === 0) {
    lines.push('_No entries yet._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Date | Description | In | Out | Balance |');
  lines.push('| --- | --- | ---: | ---: | ---: |');

  for (const row of rows) {
    const isIn = row.amount >= 0;
    lines.push(
      `| ${cell(row.date)} | ${cell(row.memo || '—')} | ${
        isIn ? cell(formatMoney(row.amount)) : ''
      } | ${isIn ? '' : cell(formatMoney(Math.abs(row.amount)))} | ${cell(
        formatMoney(row.balance),
      )} |`,
    );

    for (const leg of row.legs ?? []) {
      const pct = leg.pct !== undefined ? ` (${leg.pct}%)` : '';
      const note = leg.kind === 'shipFund' ? 'retained' : 'paid';
      lines.push(
        `| | ⤷ ${cell(legLabel(leg))}${pct} — ${note} | | ${cell(formatMoney(leg.amount))} | |`,
      );
    }
  }

  lines.push('');
  lines.push(`**Closing balance: ${formatMoney(closing)}**`);
  lines.push('');

  const distributions = rows.filter(r => r.splitSnapshot);
  if (distributions.length > 0) {
    lines.push('## Distributions');
    lines.push('');
    lines.push(
      'The percentages below are the ones **agreed at the time of each payout**, ' +
        'not the current split. Changing the split never rewrites a past distribution.',
    );
    lines.push('');
    for (const row of distributions) {
      const snap = row.splitSnapshot!;
      lines.push(`### ${row.date} — ${row.memo || 'Payout'}`);
      lines.push('');
      if (row.gross !== undefined) {
        lines.push(`- Gross divided: ${formatMoney(row.gross)}`);
      }
      lines.push(`- Ship fund: ${snap.shipFundPct}% (retained)`);
      for (const splitRow of snap.rows) {
        lines.push(`- ${splitRow.payeeName}: ${splitRow.pct}%`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
