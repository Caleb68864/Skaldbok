import { db } from '../db/client';
import { baseNoteSchema } from '../../types/note';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getNoteById(id: string): Promise<Note | undefined> {
  try {
    const record = await db.notes.get(id);
    if (!record) return undefined;
    const parsed = baseNoteSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('noteRepository.getNoteById: validation failed for id', id, parsed.error);
      return undefined;
    }
    return parsed.data;
  } catch (e) {
    throw new Error(`noteRepository.getNoteById failed: ${e}`);
  }
}

export async function getNotesByCampaign(campaignId: string): Promise<Note[]> {
  try {
    const records = await db.notes.where('campaignId').equals(campaignId).toArray();
    return records
      .map(record => {
        const parsed = baseNoteSchema.safeParse(record);
        if (!parsed.success) {
          console.warn('noteRepository.getNotesByCampaign: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((n): n is Note => n !== undefined);
  } catch (e) {
    throw new Error(`noteRepository.getNotesByCampaign failed: ${e}`);
  }
}

export async function getNotesBySession(sessionId: string): Promise<Note[]> {
  try {
    const records = await db.notes.where('sessionId').equals(sessionId).toArray();
    return records
      .map(record => {
        const parsed = baseNoteSchema.safeParse(record);
        if (!parsed.success) {
          console.warn('noteRepository.getNotesBySession: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((n): n is Note => n !== undefined);
  } catch (e) {
    throw new Error(`noteRepository.getNotesBySession failed: ${e}`);
  }
}

export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Note> {
  try {
    const now = nowISO();
    const note = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    } as Note;
    await db.notes.add(note);
    return note;
  } catch (e) {
    throw new Error(`noteRepository.createNote failed: ${e}`);
  }
}

export async function updateNote(id: string, data: Partial<Note>): Promise<Note> {
  try {
    const now = nowISO();
    await db.notes.update(id, { ...data, updatedAt: now });
    const updated = await db.notes.get(id);
    if (!updated) throw new Error(`noteRepository.updateNote: note ${id} not found after update`);
    return updated as Note;
  } catch (e) {
    throw new Error(`noteRepository.updateNote failed: ${e}`);
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await db.notes.delete(id);
  } catch (e) {
    throw new Error(`noteRepository.deleteNote failed: ${e}`);
  }
}
