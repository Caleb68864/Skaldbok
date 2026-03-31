import { z } from 'zod';

export const NOTE_TYPES = ['generic', 'npc', 'combat', 'location', 'loot', 'rumor', 'quote', 'skill-check', 'recap'] as const;

export type NoteType = (typeof NOTE_TYPES)[number];

export type NoteStatus = 'active' | 'archived';

export const baseNoteSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  sessionId: z.string().optional(),
  title: z.string(),
  body: z.unknown(), // ProseMirror JSON object
  type: z.string(),
  typeData: z.unknown().optional(),
  status: z.enum(['active', 'archived']),
  pinned: z.boolean(),
  tags: z.array(z.string()).optional(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Note = z.infer<typeof baseNoteSchema>;
