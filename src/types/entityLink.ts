import { z } from 'zod';

export const entityLinkSchema = z.object({
  id: z.string(),
  fromEntityId: z.string(),
  fromEntityType: z.string(),
  toEntityId: z.string(),
  toEntityType: z.string(),
  relationshipType: z.string(),
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type EntityLink = z.infer<typeof entityLinkSchema>;
