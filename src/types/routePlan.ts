import { z } from 'zod';

/**
 * The journey-level schedule for a campaign's route: when it starts, and what
 * it has to beat.
 *
 * @remarks
 * One row per campaign, created lazily on first read — the same shape as the
 * ledger's payout split. Kept separate from the stops because these are facts
 * about the journey, not about any one world, and putting them on the first
 * stop would lose them the moment somebody reordered the route.
 *
 * Dates are stored as the user typed them, in the ruleset's own dating.
 */
export const routePlanSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  /** When the journey begins, e.g. `097-1105`. */
  startDate: z.string().default(''),
  /** The deadline the route has to land inside, if there is one. */
  targetDate: z.string().default(''),
  /** What the deadline is for — "trake fruit to Gazelle". */
  targetNote: z.string().default(''),

  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type RoutePlan = z.infer<typeof routePlanSchema>;
