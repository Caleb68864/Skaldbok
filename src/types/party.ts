import { z } from 'zod';

export const partySchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string().optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const partyMemberSchema = z.object({
  id: z.string(),
  partyId: z.string(),
  linkedCharacterId: z.string().optional(),
  name: z.string().optional(),
  isActivePlayer: z.boolean(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Party = z.infer<typeof partySchema>;
export type PartyMember = z.infer<typeof partyMemberSchema>;
