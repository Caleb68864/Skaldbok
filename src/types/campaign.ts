import { z } from 'zod';

export type CampaignStatus = 'active' | 'archived';

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  system: z.string().default('classic-fantasy'),
  status: z.enum(['active', 'archived']),
  activeSessionId: z.string().optional(),
  activePartyId: z.string().optional(),
  activeCharacterMemberId: z.string().optional(),
  /**
   * The current in-world date, in the ruleset's own dating.
   *
   * @remarks
   * Lives on the campaign because more than one feature needs it: recurring
   * ship costs accrue against it, and the route schedule is measured in the
   * same dates. Optional and additive — a campaign without one simply accrues
   * nothing.
   */
  campaignDate: z.string().optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Campaign = z.infer<typeof campaignSchema>;
