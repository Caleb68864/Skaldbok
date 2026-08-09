import type { CharacterRecord } from '../../types/character';

/**
 * A debt the character owes, or is owed.
 *
 * @remarks
 * Traveller runs on obligation — a ship mortgage, a patron's advance, a
 * crewmate covering your vacc suit because you could not. The amount that
 * matters is rarely on the sheet as cash, and "I owe Rell 10,000" is exactly
 * the kind of thing a table forgets between sessions and then argues about.
 *
 * `direction` carries the sign rather than a negative `amount`: a debt of
 * -10,000 reads as "they owe me" only if you already know the convention, and
 * somebody eventually types a minus where they meant a plus.
 */
export interface Debt {
  id: string;
  /** Who the debt is with — a crewmate, a broker, a bank. */
  counterparty: string;
  /**
   * The original amount. **Never reduced by a repayment.**
   *
   * @remarks
   * Payments accumulate in {@link Debt.payments} instead, so the sheet can
   * always answer "how much was this to begin with?" as well as "how much is
   * left?". Writing the balance back over `amount` would lose the first
   * question permanently, and it is the one that gets argued about.
   */
  amount: number;
  /** `owed` = this character owes it. `due` = it is owed to them. */
  direction: 'owed' | 'due';
  /** What it was for. */
  note?: string;
  /** Part-payments against this debt, oldest first. */
  payments?: DebtPayment[];
  /** Set when settled, so history survives rather than being deleted. */
  settledAt?: string;
  /**
   * True when the debt settled itself because a payment cleared the balance,
   * rather than someone tapping Settle.
   *
   * @remarks
   * The two are different intentions and must be undone differently. Removing a
   * mis-typed payment should reopen a debt that only closed *because* of that
   * payment — but must not override someone who deliberately marked a debt
   * square, say after forgiving the remainder. Without this the code cannot tell
   * them apart and has to guess.
   */
  autoSettled?: boolean;
  createdAt: string;
}

/** One part-payment against a {@link Debt}. */
export interface DebtPayment {
  id: string;
  /** Always positive — direction comes from the parent debt. */
  amount: number;
  at: string;
  /** Optional context: "sold the vacc suit", "half now, half on Regina". */
  note?: string;
}

/** Total paid against a debt so far. */
export function paidSoFar(debt: Debt): number {
  return (debt.payments ?? []).reduce((sum, p) => sum + p.amount, 0);
}

/**
 * What is still outstanding on a debt.
 *
 * @remarks
 * Clamped at zero: overpaying is a data-entry slip, not a debt that runs
 * negative and starts counting the other way in {@link netDebt}.
 */
export function outstanding(debt: Debt): number {
  return Math.max(0, debt.amount - paidSoFar(debt));
}

/** Whether every credit of a debt has been repaid. */
export function isFullyPaid(debt: Debt): boolean {
  return outstanding(debt) === 0;
}

/**
 * Every debt still owing — unsettled, and not yet paid off in full.
 *
 * @remarks
 * A debt paid down to nothing is closed whether or not anybody tapped Settle,
 * because leaving a zero-balance row in the open list makes the totals read as
 * if money is still outstanding.
 */
export function openDebts(debts: Debt[] | undefined): Debt[] {
  return (debts ?? []).filter(d => !d.settledAt && !isFullyPaid(d));
}

/**
 * Net position across open debts: what you owe, minus what you are owed.
 *
 * @remarks
 * Positive means in the red. Settled debts are excluded — they are kept for
 * history, not arithmetic, and counting them would make every repayment look
 * like it changed nothing.
 */
export function netDebt(debts: Debt[] | undefined): number {
  return openDebts(debts).reduce(
    (sum, d) => sum + (d.direction === 'owed' ? outstanding(d) : -outstanding(d)),
    0,
  );
}

/**
 * Total still owing in one direction.
 *
 * @remarks
 * Counts what remains, not what was borrowed — paying half a debt has to move
 * this number, or a repayment looks like it changed nothing.
 */
export function totalByDirection(debts: Debt[] | undefined, direction: Debt['direction']): number {
  return openDebts(debts)
    .filter(d => d.direction === direction)
    .reduce((sum, d) => sum + outstanding(d), 0);
}

/** Adds a debt, returning the patch for `updateCharacter`. */
export function addDebt(
  character: Pick<CharacterRecord, 'debts'>,
  debt: Omit<Debt, 'id' | 'createdAt'>,
  id: string,
  now: string,
): Pick<CharacterRecord, 'debts'> {
  return { debts: [...(character.debts ?? []), { ...debt, id, createdAt: now }] };
}

/**
 * Marks a debt settled, keeping the row.
 *
 * @remarks
 * Settling is not deleting. "Did I ever pay Rell back?" is a question the table
 * asks months later, and a deleted row answers it with silence. Returns `null`
 * when the debt is missing or already settled, so a double-tap writes nothing.
 */
export function settleDebt(
  character: Pick<CharacterRecord, 'debts'>,
  id: string,
  now: string,
): Pick<CharacterRecord, 'debts'> | null {
  const debts = character.debts ?? [];
  const target = debts.find(d => d.id === id);
  if (!target || target.settledAt) return null;
  return { debts: debts.map(d => (d.id === id ? { ...d, settledAt: now } : d)) };
}

/**
 * Records a part-payment against a debt.
 *
 * @remarks
 * The debt's `amount` is left alone — repayments accumulate as their own rows,
 * so the sheet keeps both the original figure and what is left. "You said you'd
 * pay me back 10,000 and you've given me 4" is a conversation that needs both
 * numbers, and a balance written back over the original destroys the first.
 *
 * A payment that clears the balance settles the debt in the same write. There is
 * no state where a debt shows nothing outstanding and still sits in the open
 * list waiting for someone to tap Settle.
 *
 * Returns `null` — writing nothing — when the debt is missing, already settled,
 * or the amount is not a positive number. A zero-value payment is a mis-tap, and
 * recording it would add a meaningless row to a history people read.
 *
 * @param amount - Positive. Direction comes from the parent debt. Overpayment is
 * accepted and clamped by {@link outstanding}, because refusing it mid-session
 * over a rounding difference is worse than recording what was actually handed
 * over.
 */
export function payDebt(
  character: Pick<CharacterRecord, 'debts'>,
  id: string,
  amount: number,
  paymentId: string,
  now: string,
  note?: string,
): Pick<CharacterRecord, 'debts'> | null {
  const debts = character.debts ?? [];
  const target = debts.find(d => d.id === id);
  if (!target || target.settledAt) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const payment: DebtPayment = { id: paymentId, amount, at: now, ...(note ? { note } : {}) };

  return {
    debts: debts.map(d => {
      if (d.id !== id) return d;
      const withPayment: Debt = { ...d, payments: [...(d.payments ?? []), payment] };
      return isFullyPaid(withPayment)
        ? { ...withPayment, settledAt: now, autoSettled: true }
        : withPayment;
    }),
  };
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

/** Reopens a settled debt — an undo for a mis-tap. */
export function reopenDebt(
  character: Pick<CharacterRecord, 'debts'>,
  id: string,
): Pick<CharacterRecord, 'debts'> | null {
  const debts = character.debts ?? [];
  const target = debts.find(d => d.id === id);
  if (!target || !target.settledAt) return null;
  return {
    debts: debts.map(d => {
      if (d.id !== id) return d;
      const { settledAt: _settled, ...rest } = d;
      return rest;
    }),
  };
}

/** Removes a debt entirely — for one entered by mistake. */
export function removeDebt(
  character: Pick<CharacterRecord, 'debts'>,
  id: string,
): Pick<CharacterRecord, 'debts'> {
  return { debts: (character.debts ?? []).filter(d => d.id !== id) };
}
