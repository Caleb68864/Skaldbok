import { z } from 'zod';

/**
 * One payee's share of a campaign's Distribute split.
 *
 * @remarks
 * `payeeName` is a snapshot taken at the time the row is edited — it is the
 * field that survives a party member being renamed or removed later.
 * `payeeMemberId` links back to the live `PartyMember` when one still
 * exists, but is optional: a payee is not required to be a tracked member.
 */
export const payoutSplitRowSchema = z.object({
  id: z.string(),
  payeeMemberId: z.string().optional(),
  payeeName: z.string(),
  pct: z.number().nonnegative(),
});
export type PayoutSplitRow = z.infer<typeof payoutSplitRowSchema>;

/**
 * A campaign's current Distribute split — one row per campaign, created
 * lazily on first read by `ledgerSplitRepository.getOrCreateForCampaign`.
 *
 * @remarks
 * Editing this record never alters any previously written {@link LedgerEntry}
 * — a distribution deep-copies it into `splitSnapshot` at write time. Follows
 * the project's soft-delete convention.
 */
export const payoutSplitSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  shipFundPct: z.number().nonnegative().default(0),
  rows: z.array(payoutSplitRowSchema).default([]),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type PayoutSplit = z.infer<typeof payoutSplitSchema>;
