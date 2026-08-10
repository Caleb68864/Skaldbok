import type { LedgerEntry, LedgerLeg } from '../../types/ledger';
import type { LedgerAccount } from '../../types/ledgerAccount';
import type { RecurringBill } from '../../types/recurringBill';
import type { RouteCalendar } from '../route/calendar';
import { computeRunningBalance } from '../ledgerMath';
import { computeAccountBalances } from '../ledgerAccounts';
import { nextDue, remainingOccurrences } from '../ledger/accrual';
import { yamlValue } from './yamlValue';

/**
 * The account structure behind the entries.
 *
 * @remarks
 * Optional so a single-account book — and the existing tests — keep the older
 * three-argument call. Supplying it changes what the Balance column *means*:
 * see {@link renderLedgerToMarkdown}.
 */
export interface LedgerExportContext {
  accounts?: LedgerAccount[];
  bills?: RecurringBill[];
  /** The campaign's in-world date, for reporting when each charge next falls due. */
  campaignDate?: string;
  calendar?: RouteCalendar;
  /**
   * What the campaign's ruleset calls the pot kept off the top of a payout —
   * the engine's `terms.reservePot`.
   *
   * @remarks
   * Optional, and it falls back to a neutral "Reserve" rather than to any one
   * ruleset's word, so an export written without a system to hand does not
   * quietly file a fantasy party's cut under "Ship fund".
   */
  reservePotLabel?: string;
}

/** Neutral fallback when no ruleset supplied its own word. */
const DEFAULT_RESERVE_POT_LABEL = 'Reserve';

/** Escapes a value for a Markdown table cell, where a raw pipe would split the row. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** How a leg reads in the exported book. */
function legLabel(leg: LedgerLeg, reservePotLabel: string): string {
  if (leg.kind === 'shipFund') return reservePotLabel;
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
  context?: LedgerExportContext,
): string {
  const reservePotLabel = context?.reservePotLabel ?? DEFAULT_RESERVE_POT_LABEL;
  const accounts = context?.accounts ?? [];
  const hasAccounts = accounts.length > 0;

  // Fold cash on hand when the account structure is known, matching the screen.
  // Without it the column sums the mortgage's opening alongside a fuel purchase
  // and reports a figure that is not any quantity the crew has — the export was
  // still doing that after the app stopped.
  const rows = hasAccounts
    ? computeRunningBalance(entries, {
        accountIds: new Set(accounts.filter(a => a.kind === 'asset').map(a => a.id)),
        primaryId: accounts.find(a => a.isPrimary)?.id,
      })
    : computeRunningBalance(entries);
  const closing = rows.length > 0 ? rows[rows.length - 1].balance : 0;
  const balanceHeading = hasAccounts ? 'Cash' : 'Balance';

  const lines: string[] = [];
  lines.push('---');
  lines.push('type: ledger');
  lines.push(`campaign: ${yamlValue(campaignName)}`);
  lines.push(`entries: ${rows.length}`);
  // Renamed alongside the column: a reader diffing two exports should not find
  // `closing_balance` silently changing meaning between them.
  lines.push(`${hasAccounts ? 'closing_cash' : 'closing_balance'}: ${closing}`);
  lines.push('---');
  lines.push('');
  lines.push(`# ${campaignName} — Ledger`);
  lines.push('');

  if (rows.length === 0) {
    lines.push('_No entries yet._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`| Date | Description | In | Out | ${balanceHeading} |`);
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
        `| | ⤷ ${cell(legLabel(leg, reservePotLabel))}${pct} — ${note} | | ${cell(
          formatMoney(leg.amount),
        )} | |`,
      );
    }
  }

  lines.push('');
  lines.push(`**Closing ${hasAccounts ? 'cash' : 'balance'}: ${formatMoney(closing)}**`);
  lines.push('');

  // What the crew owns and owes. Without this the export carries the movements
  // but loses the mortgage, the escrow and the standing position they add up to
  // — the figures a reader most wants months later.
  if (hasAccounts) {
    const summary = computeAccountBalances(accounts, entries);
    lines.push('## Accounts');
    lines.push('');
    lines.push('| Account | Type | Balance | Note |');
    lines.push('| --- | --- | ---: | --- |');
    for (const { account, balance } of summary.balances) {
      const type = account.contingent
        ? 'Contingent liability'
        : account.kind === 'liability'
          ? 'Liability'
          : 'Asset';
      // Liabilities print their magnitude, as they do on screen — the minus
      // sign is an implementation detail of the arithmetic, not a fact about
      // the debt.
      const shown = account.kind === 'liability' ? Math.abs(balance) : balance;
      lines.push(
        `| ${cell(account.name)}${account.isPrimary ? ' _(default)_' : ''} | ${type} | ${cell(
          formatMoney(shown),
        )} | ${cell(account.note || '—')} |`,
      );
    }
    lines.push('');
    lines.push(`- Assets: ${formatMoney(summary.totalAssets)}`);
    if (summary.totalOwed !== 0) lines.push(`- Liabilities: ${formatMoney(summary.totalOwed)}`);
    if (summary.totalAtRisk !== 0) {
      lines.push(
        `- Contingent: ${formatMoney(summary.totalAtRisk)} ` +
          '(disclosed, excluded from net position)',
      );
    }
    lines.push(`- **Net position: ${formatMoney(summary.netWorth)}**`);
    lines.push('');
  }

  const bills = (context?.bills ?? []).filter(b => b.amount > 0);
  if (bills.length > 0) {
    lines.push('## Recurring charges');
    lines.push('');
    if (context?.campaignDate) {
      lines.push(`Accrued through **${context.campaignDate}**.`);
      lines.push('');
    }
    lines.push('| Charge | Amount | Interval | Next due | Remaining |');
    lines.push('| --- | ---: | --- | --- | --- |');
    for (const bill of bills) {
      const due = nextDue(bill, context?.calendar);
      const left = remainingOccurrences(bill);
      lines.push(
        `| ${cell(bill.name)} | ${cell(formatMoney(bill.amount))} | every ${
          bill.everyDays
        } days | ${cell(!bill.active ? 'suspended' : (due ?? '—'))} | ${
          left === null ? 'open-ended' : `${left} of ${bill.occurrenceLimit}`
        } |`,
      );
    }
    lines.push('');
  }

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
      lines.push(`- ${reservePotLabel}: ${snap.shipFundPct}% (retained)`);
      for (const splitRow of snap.rows) {
        lines.push(`- ${splitRow.payeeName}: ${splitRow.pct}%`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
