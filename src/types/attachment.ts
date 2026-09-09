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
  /**
   * ISO timestamp set when soft-deleted.
   *
   * @remarks
   * Attachments were outside the soft-delete convention, on the reasoning that
   * a Blob's whole point is to free space when removed. That held for removing
   * one photo deliberately, and failed badly for the cascade: deleting a note
   * hard-deleted its attachments, so Trash restored the note and the photos
   * were already gone. A feature that promises reversibility has to be
   * reversible for the payload too.
   */
  deletedAt: z.string().optional(),
  /** Transaction id shared by every row deleted in one cascade. */
  softDeletedBy: z.string().optional(),
});

export type Attachment = z.infer<typeof attachmentSchema>;
