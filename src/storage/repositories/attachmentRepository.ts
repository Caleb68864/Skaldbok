import { db } from '../db/client';
import { attachmentSchema } from '../../types/attachment';
import type { Attachment } from '../../types/attachment';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { resizeAndCompress } from '../../utils/imageResize';

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

export async function deleteAttachment(id: string): Promise<void> {
  try {
    await db.attachments.delete(id);
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachment failed: ${e}`);
  }
}

export async function deleteAttachmentsByNote(noteId: string): Promise<void> {
  try {
    await db.attachments.where('noteId').equals(noteId).delete();
  } catch (e) {
    throw new Error(`attachmentRepository.deleteAttachmentsByNote failed: ${e}`);
  }
}

export async function updateAttachmentCaption(id: string, caption: string): Promise<void> {
  try {
    await db.attachments.update(id, { caption });
  } catch (e) {
    throw new Error(`attachmentRepository.updateAttachmentCaption failed: ${e}`);
  }
}
