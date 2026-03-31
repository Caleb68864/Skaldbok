import { z } from 'zod';

export type SessionStatus = 'active' | 'ended';

export const sessionSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  title: z.string(),
  status: z.enum(['active', 'ended']),
  date: z.string(), // ISO date e.g. "2026-03-31"
  startedAt: z.string(), // ISO datetime
  endedAt: z.string().optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Session = z.infer<typeof sessionSchema>;
