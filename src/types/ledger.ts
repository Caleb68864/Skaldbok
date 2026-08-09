import { z } from 'zod';

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
});
export type LedgerLeg = z.infer<typeof ledgerLegSchema>;

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
  /** Present only for a Distribute-generated entry: the pre-split total. */
  gross: z.number().int().nonnegative().optional(),
  /** Present only for a Distribute-generated entry: where the money went. */
  legs: z.array(ledgerLegSchema).optional(),
  /** Deep-copied snapshot of the split used to produce `legs`, frozen at write time. */
  splitSnapshot: z.unknown().optional(),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
