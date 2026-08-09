import { z } from 'zod';
import { payoutSplitRowSchema } from './payoutSplit';

/**
 * One leg of a ledger entry's distribution — where a slice of the entry's
 * money went (or, for `unallocated`, did not).
 *
 * @remarks
 * `amount` is always a non-negative magnitude; direction is implied entirely
 * by `kind` and by the parent entry's signed `amount`. Only the entry itself
 * carries a sign — see {@link ledgerEntrySchema}.
 */
export const ledgerLegSchema = z.object({
  kind: z.enum(['shipFund', 'payee', 'unallocated']),
  /** Present for `kind: 'payee'` legs; absent for `shipFund`/`unallocated`. */
  payeeMemberId: z.string().optional(),
  /** Snapshotted display name for a payee leg, so a later member rename cannot alter history. */
  payeeName: z.string().optional(),
  /** Non-negative magnitude. */
  amount: z.number().int().nonnegative(),
  /**
   * The percentage this leg was computed from, kept for audit.
   *
   * @remarks
   * Redundant with `splitSnapshot` for payee legs, and deliberately so — the
   * exported cashbook renders one line per leg, and a reader asking "why did
   * Milo get 15,000?" should not have to cross-reference a separate object.
   * For a `shipFund` leg this is the off-the-top percentage; for
   * `unallocated` it is the shortfall the split failed to assign.
   */
  pct: z.number().nonnegative().optional(),
});
export type LedgerLeg = z.infer<typeof ledgerLegSchema>;

/**
 * The split as it stood when a distribution was written.
 *
 * @remarks
 * Deliberately *not* a reference to the live `PayoutSplit` row: it holds only
 * the numbers that produced the legs, with none of the identity or audit
 * fields, because it is a historical fact rather than a record you can edit.
 */
export const splitSnapshotSchema = z.object({
  shipFundPct: z.number().nonnegative(),
  rows: z.array(payoutSplitRowSchema),
});
export type SplitSnapshot = z.infer<typeof splitSnapshotSchema>;

/**
 * A single row in a campaign's shared cashbook.
 *
 * @remarks
 * Money is a signed integer count of the system's base currency
 * denomination — positive is in, negative is out. A plain manual entry
 * carries only `amount`; a Distribute action additionally carries `gross`,
 * `legs` and a deep-copied `splitSnapshot` of the split used, so that
 * editing the campaign's current split can never alter a past entry. Follows
 * the project's soft-delete convention; access it only through
 * `ledgerRepository`.
 */
export const ledgerEntrySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  date: z.string(),
  memo: z.string().default(''),
  /** Signed integer count of the base currency denomination. Positive is in, negative is out. */
  amount: z.number().int(),
  /**
   * The account this entry moves money in or out of.
   *
   * @remarks
   * Absent means the campaign's primary account. Every entry written before
   * accounts existed therefore still counts, and the common case — the crew's
   * cash — needs no choosing.
   */
  accountId: z.string().optional(),
  /**
   * The account the money moved to or from, when the entry is a transfer.
   *
   * @remarks
   * The counter side receives the **opposite** sign. A mortgage payment is
   * `amount: -201335` against Cash with `counterAccountId` on the Ship Loan, so
   * cash falls and the debt rises toward zero in one write. Without it the
   * payment leaves the book and the loan never moves.
   */
  counterAccountId: z.string().optional(),
  /**
   * Marks an entry that establishes a starting balance rather than recording a
   * movement.
   *
   * @remarks
   * Only `'opening'` is meaningful. A distribution is still identified by
   * carrying `gross`, and an ordinary line by carrying neither — so this stays
   * optional and nothing written before it needs migrating. Opening balances are
   * separated because "what did we start with" and "what have we done since" are
   * different questions, and a starting figure buried among transactions reads
   * like income the crew earned.
   */
  kind: z.enum(['opening']).optional(),
  /** Present only for a Distribute-generated entry: the pre-split total. */
  gross: z.number().int().nonnegative().optional(),
  /** Present only for a Distribute-generated entry: where the money went. */
  legs: z.array(ledgerLegSchema).optional(),
  /** Deep-copied snapshot of the split used to produce `legs`, frozen at write time. */
  splitSnapshot: splitSnapshotSchema.optional(),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
