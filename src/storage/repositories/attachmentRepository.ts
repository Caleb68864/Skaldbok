import { db } from '../db/client';
import { attachmentSchema } from '../../types/attachment';
import type { Attachment } from '../../types/attachment';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { resizeAndCompress } from '../../utils/imageResize';

/**
 * Resizes an image and stores it as an attachment on a note.
 *
 * @remarks
 * The source image is downscaled and re-encoded to JPEG (see
 * {@link resizeAndCompress}) before the Blob is written, so the local database
 * does not fill up with full-resolution photos. A `QuotaExceededError` is
 * re-thrown with its name preserved so the UI can distinguish "storage full"
 * from other failures.
 */
export async function createAttachment(
  noteId: string,
  campaignId: string,
  file: File
): Promise<Attachment> {
  try {
    const blob = await resizeAndCompress(file, 1920, 0.8);
    const filename = `${noteId.slice(0, 8)}-${Date.now()}.jpg`;
    const record: Attachment = {
      id: generateId(),
      noteId,
      campaignId,
      filename,
      mimeType: 'image/jpeg',
      sizeBytes: blob.size,
      blob,
      createdAt: nowISO(),
    };
    await db.attachments.add(record);
    return record;
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      const quotaError = new Error('Storage full');
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    throw new Error(`attachmentRepository.createAttachment failed: ${e}`);
  }
}

/** A note's attachments, validated and sorted oldest-first; invalid rows are dropped with a warning. */
export async function getAttachmentsByNote(noteId: string): Promise<Attachment[]> {
  try {
    const records = await db.attachments.where('noteId').equals(noteId).toArray();
    return records
      .map(record => {
        const parsed = attachmentSchema.safeParse(record);
        if (!parsed.success) {
          console.warn('attachmentRepository.getAttachmentsByNote: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((a): a is Attachment => a !== undefined)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (e) {
    throw new Error(`attachmentRepository.getAttachmentsByNote failed: ${e}`);
  }
}

/** Every attachment in a campaign, validated and sorted oldest-first. */
export async function getAttachmentsByCampaign(campaignId: string): Promise<Attachment[]> {
  try {
    const records = await db.attachments.where('campaignId').equals(campaignId).toArray();
    return records
      .map(record => {
        const parsed = attachmentSchema.safeParse(record);
        if (!parsed.success) {
          console.warn('attachmentRepository.getAttachmentsByCampaign: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((a): a is Attachment => a !== undefined)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (e) {
    throw new Error(`attachmentRepository.getAttachmentsByCampaign failed: ${e}`);
  }
}

/**
 * Removes one attachment row.
 *
 * @remarks
 * Attachments are not part of the soft-delete convention — they store binary
 * Blobs whose whole point is to free space when removed — so this is a hard
 * delete.
 */
export async function deleteAttachment(id: string): Promise<void> {
  try {
    await db.attachments.delete(id);
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachment failed: ${e}`);
  }
}

/** Hard-deletes every attachment belonging to a note, e.g. when the note is purged. */
export async function deleteAttachmentsByNote(noteId: string): Promise<void> {
  try {
    await db.attachments.where('noteId').equals(noteId).delete();
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachmentsByNote failed: ${e}`);
  }
}

/** Updates just the caption on an attachment. */
export async function updateAttachmentCaption(id: string, caption: string): Promise<void> {
  try {
    await db.attachments.update(id, { caption });
  } catch (e) {
    throw new Error(`attachmentRepository.updateAttachmentCaption failed: ${e}`);
  }
}
