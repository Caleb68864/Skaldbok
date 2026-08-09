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
  amount: number;
  /** `owed` = this character owes it. `due` = it is owed to them. */
  direction: 'owed' | 'due';
  /** What it was for. */
  note?: string;
  /** Set when settled, so history survives rather than being deleted. */
  settledAt?: string;
  createdAt: string;
}

/** Every unsettled debt, in the order entered. */
export function openDebts(debts: Debt[] | undefined): Debt[] {
  return (debts ?? []).filter(d => !d.settledAt);
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
    (sum, d) => sum + (d.direction === 'owed' ? d.amount : -d.amount),
    0,
  );
}

/** Total of open debts in one direction. */
export function totalByDirection(debts: Debt[] | undefined, direction: Debt['direction']): number {
  return openDebts(debts)
    .filter(d => d.direction === direction)
    .reduce((sum, d) => sum + d.amount, 0);
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
