import { db } from '../db/client';
import { attachmentSchema } from '../../types/attachment';
import type { Attachment } from '../../types/attachment';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { resizeAndCompress } from '../../utils/imageResize';
import { excludeDeleted } from '../../utils/softDelete';

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
      // The caught error is re-labelled, not replaced: the caller wants a
      // recognisable name, and the original is still the only thing that says
      // which write ran out of room.
      const quotaError = new Error('Storage full', { cause: e });
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    throw new Error(`attachmentRepository.createAttachment failed: ${e}`, { cause: e });
  }
}

/** A note's attachments, validated and sorted oldest-first; invalid rows are dropped with a warning. */
export async function getAttachmentsByNote(
  noteId: string,
  options?: { includeDeleted?: boolean },
): Promise<Attachment[]> {
  try {
    const rows = await db.attachments.where('noteId').equals(noteId).toArray();
    const records = options?.includeDeleted ? rows : excludeDeleted(rows);
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
    throw new Error(`attachmentRepository.getAttachmentsByNote failed: ${e}`, { cause: e });
  }
}

/** Every attachment in a campaign, validated and sorted oldest-first. */
export async function getAttachmentsByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<Attachment[]> {
  try {
    const rows = await db.attachments.where('campaignId').equals(campaignId).toArray();
    const records = options?.includeDeleted ? rows : excludeDeleted(rows);
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
    throw new Error(`attachmentRepository.getAttachmentsByCampaign failed: ${e}`, { cause: e });
  }
}

/**
 * Removes one attachment row.
 *
 * @remarks
 * Deliberately still a hard delete: this is the per-photo remove control, an
 * explicit "get rid of this image" aimed at one Blob the user is looking at.
 * Freeing the space is the point of the action.
 *
 * The *cascade* is a different act and is soft — see
 * {@link softDeleteAttachmentsByNote}. Deleting a note is reversible from
 * Trash, so what goes down with it has to come back.
 */
export async function deleteAttachment(id: string): Promise<void> {
  try {
    await db.attachments.delete(id);
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachment failed: ${e}`, { cause: e });
  }
}

/**
 * Soft-deletes every live attachment on a note, under a cascade transaction id.
 *
 * @remarks
 * Runs inside the caller's transaction when there is one, which is how
 * `noteRepository.softDeleteWithLinks` takes the note, its edges and its photos
 * down atomically. `txId` is what {@link restoreAttachmentsForTxId} matches on,
 * so a restore brings back exactly the rows this cascade removed and not any
 * attachment deleted separately beforehand.
 *
 * @param noteId - The note being deleted.
 * @param txId - Cascade id shared with the note and its edges.
 */
export async function softDeleteAttachmentsByNote(noteId: string, txId: string): Promise<void> {
  try {
    const rows = excludeDeleted(await db.attachments.where('noteId').equals(noteId).toArray());
    if (rows.length === 0) return;
    const now = nowISO();
    await db.attachments.bulkUpdate(
      rows.map(row => ({ key: row.id, changes: { deletedAt: now, softDeletedBy: txId } })),
    );
  } catch (e) {
    throw new Error(`attachmentRepository.softDeleteAttachmentsByNote failed: ${e}`, { cause: e });
  }
}

/** Clears the tombstone on every attachment removed under `txId`. */
export async function restoreAttachmentsForTxId(txId: string): Promise<void> {
  try {
    const rows = await db.attachments.where('softDeletedBy').equals(txId).toArray();
    if (rows.length === 0) return;
    await db.attachments.bulkUpdate(
      rows.map(row => ({ key: row.id, changes: { deletedAt: undefined, softDeletedBy: undefined } })),
    );
  } catch (e) {
    throw new Error(`attachmentRepository.restoreAttachmentsForTxId failed: ${e}`, { cause: e });
  }
}

/**
 * Hard-deletes every attachment belonging to a note.
 *
 * @remarks
 * Internal only, for purge jobs — the same standing as every other repository's
 * `hardDelete`. User-facing note deletion goes through
 * {@link softDeleteAttachmentsByNote}; calling this from a delete flow is what
 * made Trash restore a note whose photos no longer existed.
 */
export async function deleteAttachmentsByNote(noteId: string): Promise<void> {
  try {
    await db.attachments.where('noteId').equals(noteId).delete();
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachmentsByNote failed: ${e}`, { cause: e });
  }
}

/** Updates just the caption on an attachment. */
export async function updateAttachmentCaption(id: string, caption: string): Promise<void> {
  try {
    await db.attachments.update(id, { caption });
  } catch (e) {
    throw new Error(`attachmentRepository.updateAttachmentCaption failed: ${e}`, { cause: e });
  }
}
