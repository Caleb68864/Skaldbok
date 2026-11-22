import { db } from '../db/client';
import { attachmentSchema } from '../../types/attachment';
import type { Attachment } from '../../types/attachment';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { resizeAndCompress } from '../../utils/imageResize';
import { excludeDeleted, generateSoftDeleteTxId, onlyDeleted } from '../../utils/softDelete';

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
    const now = nowISO();
    const record: Attachment = {
      id: generateId(),
      noteId,
      campaignId,
      filename,
      mimeType: 'image/jpeg',
      sizeBytes: blob.size,
      blob,
      createdAt: now,
      updatedAt: now,
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

/**
 * Removes one attachment row, permanently.
 *
 * @remarks
 * **Internal only, and with no caller — the same standing as every other
 * repository's `hardDelete`,** which is why `hardDeleteReachability.test.ts`
 * lists it among the domain hard deletes that `src/storage` may reach and
 * nothing else may.
 *
 * The per-photo remove control is {@link softDeleteAttachment}, not this: a
 * photo removed on its own goes to the Trash (listed by {@link getDeleted}) and
 * comes back from there.
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
      rows.map(row => ({ key: row.id, changes: { deletedAt: now, softDeletedBy: txId, updatedAt: now } })),
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
      rows.map(row => ({ key: row.id, changes: { deletedAt: undefined, softDeletedBy: undefined, updatedAt: nowISO() } })),
    );
  } catch (e) {
    throw new Error(`attachmentRepository.restoreAttachmentsForTxId failed: ${e}`, { cause: e });
  }
}

/**
 * Moves one photo to the Trash, on its own.
 *
 * @remarks
 * The per-photo remove. It mints a transaction id for this row alone, so the
 * row's `softDeletedBy` never matches a note's cascade: restoring the note
 * later does not bring back a photo the user removed separately, and
 * {@link getDeleted} can tell the two kinds of tombstone apart. A row that is
 * missing or already deleted is left alone, so a re-delete cannot overwrite
 * the cascade id a note delete stamped on it.
 *
 * @param id - The attachment to remove.
 */
export async function softDeleteAttachment(id: string): Promise<void> {
  try {
    const row = await db.attachments.get(id);
    if (!row) return;
    if (row.deletedAt) return;
    const now = nowISO();
    await db.attachments.update(id, { deletedAt: now, softDeletedBy: generateSoftDeleteTxId(), updatedAt: now });
  } catch (e) {
    throw new Error(`attachmentRepository.softDeleteAttachment failed: ${e}`, { cause: e });
  }
}

/**
 * Brings back one photo removed with {@link softDeleteAttachment}.
 *
 * @remarks
 * Clears this row only. A photo that went down with its note comes back with
 * the note instead, through {@link restoreAttachmentsForTxId}.
 */
export async function restoreAttachment(id: string): Promise<void> {
  try {
    const row = await db.attachments.get(id);
    if (!row) return;
    if (!row.deletedAt) return;
    await db.attachments.update(id, { deletedAt: undefined, softDeletedBy: undefined, updatedAt: nowISO() });
  } catch (e) {
    throw new Error(`attachmentRepository.restoreAttachment failed: ${e}`, { cause: e });
  }
}

/**
 * Photos removed on their own from a campaign's live notes, newest first.
 *
 * @remarks
 * Feeds the Trash. A tombstoned photo whose note is also deleted (or gone) is
 * left out: either it went down with the note and comes back with it, or the
 * note must be restored first, since restoring the photo alone would put it on
 * a note nobody can open. Once the note is restored, a photo removed on its own
 * before the note was deleted shows up here again. Invalid rows are dropped
 * with a warning, as in {@link getAttachmentsByNote}.
 *
 * @param campaignId - The campaign whose Trash is being shown.
 */
export async function getDeleted(campaignId: string): Promise<Attachment[]> {
  try {
    const deleted = onlyDeleted(await db.attachments.where('campaignId').equals(campaignId).toArray());
    if (deleted.length === 0) return [];
    const noteIds = [...new Set(deleted.map(row => row.noteId))];
    const notes = await db.notes.bulkGet(noteIds);
    const liveNotes = new Set(
      notes.filter((n): n is NonNullable<typeof n> => !!n && !n.deletedAt).map(n => n.id),
    );
    return deleted
      .filter(row => liveNotes.has(row.noteId))
      .map(row => {
        const parsed = attachmentSchema.safeParse(row);
        if (!parsed.success) {
          console.warn('attachmentRepository.getDeleted: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((a): a is Attachment => a !== undefined);
  } catch (e) {
    throw new Error(`attachmentRepository.getDeleted failed: ${e}`, { cause: e });
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
    await db.attachments.update(id, { caption, updatedAt: nowISO() });
  } catch (e) {
    throw new Error(`attachmentRepository.updateAttachmentCaption failed: ${e}`, { cause: e });
  }
}
