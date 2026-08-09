import { z } from 'zod';

/**
 * A cost that comes round again — the ship's mortgage, life support, berthing.
 *
 * @remarks
 * Accrues in **campaign time**, not real time. The *Leap* charges its nut per
 * in-world month, and a journey played across three Saturdays still costs six
 * months of mortgage. Posting against the real calendar would make the ship
 * cheaper the longer the group takes to play the session, which is exactly
 * backwards.
 *
 * A bill is a template plus a watermark: `postedThrough` is the campaign date up
 * to which it has already been charged. Everything owed is the gap between that
 * and the campaign's current date, so advancing the date is what makes money
 * move — and posting is idempotent, because the watermark moves with it.
 */
export const recurringBillSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** What it is: "Mortgage", "Life support", "Berthing". */
  name: z.string(),
  /** Always positive. It is a cost; the sign is applied when it posts. */
  amount: z.number().int().nonnegative(),
  /**
   * Days between charges.
   *
   * @remarks
   * Days rather than "months" because rulesets disagree about what a month is —
   * the Imperium dates by day-of-year and has none. 30 is offered as a default
   * and a table using four-week months can say 28 without arguing with the app.
   */
  everyDays: z.number().int().positive().default(30),
  /**
   * The account the money comes out of, in the ruleset's own terms.
   *
   * @remarks
   * Usually cash. For a cost somebody else is covering it is the escrow account
   * instead, so the crew's cash is untouched and the obligation accrues where it
   * belongs.
   */
  accountId: z.string().optional(),
  /** The account it pays down, when the charge is a transfer rather than a spend. */
  counterAccountId: z.string().optional(),
  /** First charge, in the ruleset's dating. */
  startDate: z.string().default(''),
  /**
   * Campaign date this bill has been charged up to.
   *
   * @remarks
   * The watermark that makes posting idempotent. Blank means nothing has posted
   * yet and the first charge falls due on `startDate`.
   */
  postedThrough: z.string().default(''),
  /**
   * Stop after this many charges, if there is an end.
   *
   * @remarks
   * The benefactor covering the mortgage for twenty-seven months is exactly
   * this: after the twenty-seventh charge the arrangement lapses and the crew is
   * paying it themselves again. Absent means it runs forever.
   */
  occurrenceLimit: z.number().int().positive().optional(),
  /** How many charges have posted, counted against {@link occurrenceLimit}. */
  postedCount: z.number().int().nonnegative().default(0),
  /** Paused without being deleted — a berth you are not currently paying for. */
  active: z.boolean().default(true),
  note: z.string().default(''),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type RecurringBill = z.infer<typeof recurringBillSchema>;
