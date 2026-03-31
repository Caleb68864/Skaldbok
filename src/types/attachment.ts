import { z } from 'zod';

export const attachmentSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  campaignId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  blob: z.instanceof(Blob),
  caption: z.string().optional(),
  createdAt: z.string(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
