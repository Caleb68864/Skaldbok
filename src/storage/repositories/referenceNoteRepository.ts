import { db } from '../db/client';
import type { ReferenceNote } from '../db/client';

/**
 * Every stored legacy reference note.
 *
 * @remarks
 * Reference content has since moved to user-owned reference sections and to
 * shared-scope notes; this repository serves the older `referenceNotes` table
 * that predates that move.
 */
export async function getAll(): Promise<ReferenceNote[]> {
  return db.referenceNotes.toArray();
}

/** Upserts a reference note, mapping a storage-quota failure to a user-friendly message. */
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

/** Permanently removes a reference note. Reference notes predate the soft-delete convention. */
export async function remove(id: string): Promise<void> {
  try {
    await db.referenceNotes.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete reference note: ${String(err)}`);
  }
}
