import type { CharacterRecord } from '../types/character';
import type { LedgerEntry } from '../types/ledger';
import type { AdvancementModel } from '../features/systems/engine/types';
import { isFullyPaid, type Debt } from '../features/characters/debts';
import { traitChance, type TraitRollOpts } from '../systems/savage-worlds/savageMath';

/**
 * Pure helpers that no shipped code calls, kept for the tests that use them.
 *
 * @remarks
 * Each of these used to be exported from its domain module (`ledgerAccounts`,
 * `advancement`, `debts`, `savageMath`) with nothing but its own test importing
 * it, so it went into the production bundle's source and the API docs as if
 * something relied on it. They live here now, beside the other test utilities.
 * If a screen comes to need one, move it back next to its siblings; the tests
 * that pin its behaviour move with it.
 *
 * Nothing outside a test file may import from `src/test-utils/`.
 */

/**
 * The entries belonging to one account, either side of a transfer.
 *
 * @remarks
 * The sign is flipped for entries where this account is the *counter* side, so
 * the column always reads from that account's point of view. A mortgage payment
 * shows as money out of Cash and money in against the loan, which is what each
 * account actually experienced.
 */
export function entriesForAccount(
  accountId: string,
  isPrimary: boolean,
  entries: LedgerEntry[],
): Array<LedgerEntry & { signedForAccount: number }> {
  const rows: Array<LedgerEntry & { signedForAccount: number }> = [];
  for (const entry of entries) {
    const belongsNear = entry.accountId === accountId || (isPrimary && !entry.accountId);
    if (belongsNear) rows.push({ ...entry, signedForAccount: entry.amount });
    else if (entry.counterAccountId === accountId) {
      rows.push({ ...entry, signedForAccount: -entry.amount });
    }
  }
  return rows;
}

/** How many session-checklist boxes are ticked. */
export function countEarnedMarks(
  character: Pick<CharacterRecord, 'advancementChecks'>,
  advancement: AdvancementModel | null | undefined,
): number {
  const checks = character.advancementChecks ?? {};
  return (advancement?.sessionEvents ?? []).filter(event => checks[event.id] === true).length;
}

/**
 * Removes a part-payment — an undo for a mis-typed figure.
 *
 * @remarks
 * Reopens the debt if removing the payment leaves something outstanding, so a
 * corrected overpayment does not leave a settled row with a balance on it.
 */
export function removeDebtPayment(
  character: Pick<CharacterRecord, 'debts'>,
  debtId: string,
  paymentId: string,
): Pick<CharacterRecord, 'debts'> | null {
  const debts = character.debts ?? [];
  const target = debts.find(d => d.id === debtId);
  if (!target || !(target.payments ?? []).some(p => p.id === paymentId)) return null;

  return {
    debts: debts.map(d => {
      if (d.id !== debtId) return d;
      const payments = (d.payments ?? []).filter(p => p.id !== paymentId);
      const next: Debt = { ...d, payments };
      // Only undo a settle the payments caused. A hand-settled debt stays
      // settled — that was a deliberate act about the debt, not about this row.
      if (next.autoSettled && !isFullyPaid(next)) {
        const { settledAt: _settled, autoSettled: _auto, ...rest } = next;
        return rest;
      }
      return next;
    }),
  };
}

/**
 * Probability of clearing the target by **at least `raises` raises** (each raise
 * is +4 over the Target Number). `raises = 0` is a plain success.
 */
export function raiseChance(sides: number, targetNumber: number, raises: number, opts: TraitRollOpts = {}): number {
  return traitChance(sides, targetNumber + 4 * Math.max(0, raises), opts);
}
