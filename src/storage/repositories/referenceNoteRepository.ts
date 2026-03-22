import { db } from '../db/client';
import type { ReferenceNote } from '../db/client';

export async function getAll(): Promise<ReferenceNote[]> {
  return db.referenceNotes.toArray();
}

export async function save(note: ReferenceNote): Promise<void> {
  try {
    await db.referenceNotes.put(note);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save reference note: ${String(err)}`);
  }
}

export async function remove(id: string): Promise<void> {
  try {
    await db.referenceNotes.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference note: ${String(err)}`);
  }
}
