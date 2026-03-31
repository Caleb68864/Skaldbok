import { z } from 'zod';

export type CampaignStatus = 'active' | 'archived';

export const campaignSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  system: z.string().default('dragonbane'),
  status: z.enum(['active', 'archived']),
  activeSessionId: z.string().optional(),
  activePartyId: z.string().optional(),
  activeCharacterMemberId: z.string().optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Campaign = z.infer<typeof campaignSchema>;
