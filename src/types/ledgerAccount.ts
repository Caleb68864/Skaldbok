import { z } from 'zod';

/**
 * A named pot of money — or of debt — that ledger entries move between.
 *
 * @remarks
 * A cashbook can say the crew paid Cr201,335 this month. It cannot say what is
 * still owed on the ship, because a liability is not cash and single-entry has
 * nowhere to put it. Accounts are the smallest change that fixes that: an entry
 * can name the account it moved money out of and, optionally, the account it
 * moved into.
 *
 * A mortgage payment then does two things at once — Cash goes down, the Ship
 * Loan goes *up toward zero* — and the balance owed finally shrinks on screen
 * instead of only in somebody's head.
 *
 * This is double-entry in substance without the debit/credit vocabulary, which
 * the crew explicitly wanted to postpone. Every entry still reads as a plain
 * line of a cashbook.
 */
export const ledgerAccountSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** What the crew calls it: "Cash", "Ship Loan", "Escrow". */
  name: z.string(),
  /**
   * `asset` is money you have; `liability` is money you owe.
   *
   * @remarks
   * Purely a display concern — the arithmetic is the same signed sum either way.
   * A liability simply carries a negative balance, and the UI says "owed" rather
   * than printing a minus sign the reader has to interpret.
   */
  kind: z.enum(['asset', 'liability']).default('asset'),
  /**
   * The account an entry belongs to when it names none.
   *
   * @remarks
   * Exactly one per campaign. It exists so every entry written before accounts
   * existed still counts, and so the common case — money in and out of the
   * crew's cash — needs no picking at all.
   */
  isPrimary: z.boolean().default(false),
  /**
   * Owed only if some condition fails.
   *
   * @remarks
   * The benefactor covering the mortgage is the case: the money is real and
   * accruing, but the crew owes it only if the job goes wrong. Real accounting
   * discloses a contingent liability rather than booking it, so this is kept out
   * of net worth and reported separately — booking it would make the crew look
   * bankrupt for a debt they will probably never pay.
   */
  contingent: z.boolean().default(false),
  /** What it is for, in the crew's own words. */
  note: z.string().default(''),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type LedgerAccount = z.infer<typeof ledgerAccountSchema>;

/** The account every campaign starts with. */
export const DEFAULT_PRIMARY_ACCOUNT_NAME = 'Cash';
