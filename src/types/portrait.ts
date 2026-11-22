import { z } from 'zod';

/**
 * A character portrait stored as an image Blob in its own table.
 *
 * @remarks
 * Roadmap H8. Portraits lived inline on the character record as a base64 data
 * URL (roughly 200–600 KB each), so every one-second autosave rewrote the
 * image, every library listing loaded every image, and every export, import,
 * upgrade and normalisation pass round-tripped it as a string. A portrait set
 * from now on is stored here instead and the record carries only its id
 * (`CharacterRecord.portraitId`).
 *
 * Nothing is migrated: a record's existing `portraitUri` is still read and
 * shown, and stays until the user sets a new portrait. Soft-deleted with its
 * character, under the character's cascade id, and restored with it.
 */
export const portraitSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  blob: z.instanceof(Blob),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Portrait = z.infer<typeof portraitSchema>;

/** A portrait as it travels in a bundle: the Blob as base64 `data`. */
export const portraitBundleSchema = portraitSchema.omit({ blob: true }).extend({
  data: z.string().optional(),
  encoding: z.literal('base64').optional(),
});
