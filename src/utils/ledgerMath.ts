import type { LedgerEntry, LedgerLeg, SplitSnapshot } from '../types/ledger';

/**
 * Pure arithmetic for the campaign cashbook.
 *
 * @remarks
 * Deliberately free of Dexie, React and the storage layer: this is the module
 * where a bug silently corrupts a crew's books, so it is the one that gets
 * exhaustively tested. Everything here works in whole base-currency units —
 * no float reaches a return value.
 */

/** How a split's percentages add up. `ok` is exactly 100. */
export type SplitStatus = 'ok' | 'under' | 'over';

/** The outcome of checking a split's row percentages. */
export interface SplitValidation {
  /** Sum of the payee row percentages (the ship fund is taken off the top separately). */
  total: number;
  status: SplitStatus;
}

/** A ledger entry paired with the balance immediately after it. */
export type EntryWithBalance = LedgerEntry & { balance: number };

/**
 * Orders entries the way the cashbook reads and folds a running balance over
 * them.
 *
 * @remarks
 * The balance is **never persisted** — it is derived on every read, so an
 * edited, deleted or restored row cannot leave a stale total behind.
 *
 * Ordering is `date`, then `createdAt`, then `id`. The `id` tiebreak looks
 * paranoid and is not: two entries logged in the same millisecond at the table
 * would otherwise fold in whatever order IndexedDB happened to return them,
 * and the running balance column would reshuffle between reloads.
 *
 * Only `amount` is summed. On a distribution that is the *net* movement, which
 * already excludes money retained in the ship fund — see
 * {@link computeDistribution}.
 */
export function computeRunningBalance(entries: LedgerEntry[]): EntryWithBalance[] {
  const ordered = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  let running = 0;
  return ordered.map(entry => {
    running += entry.amount;
    return { ...entry, balance: running };
  });
}

/**
 * Totals a split's payee percentages and says whether they add up.
 *
 * @remarks
 * Hand-entered percentages are the stored truth, so "they do not sum to 100"
 * is a state the UI must show rather than prevent. `under` still distributes,
 * producing a visible unallocated leg; `over` does not.
 */
export function validateSplit(split: SplitSnapshot): SplitValidation {
  const total = split.rows.reduce((sum, row) => sum + row.pct, 0);
  if (total === 100) return { total, status: 'ok' };
  return { total, status: total > 100 ? 'over' : 'under' };
}

/**
 * Divides 100 into `n` whole percentages, remainder on the leading rows.
 *
 * @remarks
 * `evenSplit(3)` is `[34, 33, 33]`, not `[33, 33, 34]`. The direction is
 * arbitrary but pinned by test, because "the remainder goes somewhere" is
 * exactly the kind of incidental behaviour that changes under a refactor and
 * silently moves a credit between two crewmates.
 *
 * @param n - Number of shares. Zero or negative returns an empty list.
 */
export function evenSplit(n: number): number[] {
  if (!Number.isFinite(n) || n <= 0) return [];
  const count = Math.floor(n);
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Legs produced by a distribution, plus the net cash movement they imply. */
export interface DistributionResult {
  legs: LedgerLeg[];
  /** Signed. Negative, because a distribution pays money out. */
  net: number;
}

/**
 * Splits a gross sum into ship-fund, payee and unallocated legs.
 *
 * @remarks
 * Two invariants hold for every input, and both are asserted before returning:
 *
 * - **I1** — `sum(legs.amount) === gross`. Every credit is accounted for.
 * - **I2** — `net === -(gross - shipFundLeg.amount)`. Only money that actually
 *   left the book is subtracted from the balance.
 *
 * I2 is the one that matters. The ship fund is **retained**: it stays in the
 * crew's account to pay mortgage, fuel and maintenance. An earlier design
 * treated it as an outflow, which would have drifted the running balance
 * upward-wrong by the fund's share of every payout — silently, compounding,
 * and invisible until the books disagreed with the table by a wide margin.
 *
 * A shortfall (rows summing under 100) becomes an explicit `unallocated` leg
 * rather than being quietly spread across the payees. Rounding residue folds
 * into the ship fund, which is the residual pot by nature.
 *
 * @param gross - The sum being divided. Must be positive.
 * @param split - The agreement to divide it by.
 * @throws If `gross` is not a positive integer, if the split's rows exceed
 * 100%, or if either invariant fails.
 */
export function computeDistribution(gross: number, split: SplitSnapshot): DistributionResult {
  if (!Number.isFinite(gross) || !Number.isInteger(gross) || gross <= 0) {
    throw new Error(`Distribution needs a positive whole amount (got ${gross}).`);
  }
  const validation = validateSplit(split);
  if (validation.status === 'over') {
    throw new Error(
      `The crew split totals ${validation.total}% — more than the 100% available to share.`,
    );
  }
  if (split.shipFundPct < 0 || split.shipFundPct > 100) {
    throw new Error(`The ship fund must be between 0% and 100% (got ${split.shipFundPct}%).`);
  }

  const legs: LedgerLeg[] = [];

  // Ship fund comes off the top and stays in the book.
  const shipFund = Math.floor((gross * split.shipFundPct) / 100);
  const pool = gross - shipFund;

  const payeeLegs: LedgerLeg[] = split.rows.map(row => ({
    kind: 'payee' as const,
    payeeMemberId: row.payeeMemberId,
    payeeName: row.payeeName,
    amount: Math.floor((pool * row.pct) / 100),
    pct: row.pct,
  }));
  const paidToPayees = payeeLegs.reduce((sum, leg) => sum + leg.amount, 0);

  // A shortfall is shown, not absorbed.
  const unallocatedPct = 100 - validation.total;
  const unallocated = unallocatedPct > 0 ? Math.floor((pool * unallocatedPct) / 100) : 0;

  // Whatever integer division left behind belongs to the residual pot.
  const residue = pool - paidToPayees - unallocated;

  legs.push({ kind: 'shipFund', amount: shipFund + residue, pct: split.shipFundPct });
  legs.push(...payeeLegs);
  if (unallocated > 0) {
    legs.push({ kind: 'unallocated', amount: unallocated, pct: unallocatedPct });
  }

  // The ternary normalises negative zero: `-(0)` is `-0`, which folds harmlessly
  // but renders as "-0" and compares unequal to 0 under Object.is.
  const paidOut = paidToPayees + unallocated;
  const net = paidOut === 0 ? 0 : -paidOut;

  const legTotal = legs.reduce((sum, leg) => sum + leg.amount, 0);
  if (legTotal !== gross) {
    throw new Error(`Distribution lost money: legs total ${legTotal}, gross is ${gross}.`);
  }
  const retained = legs.find(leg => leg.kind === 'shipFund')?.amount ?? 0;
  if (net !== -(gross - retained) && !(net === 0 && gross === retained)) {
    throw new Error(
      `Distribution net ${net} does not match the money that actually left (${-(gross - retained)}).`,
    );
  }

  return { legs, net };
}
