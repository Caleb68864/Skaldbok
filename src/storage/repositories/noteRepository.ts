import { db } from '../db/client';
import { baseNoteSchema } from '../../types/note';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/**
 * Retrieves a single {@link Note} by its unique identifier.
 *
 * @remarks
 * The raw record is validated against {@link baseNoteSchema} before being
 * returned.  Records that fail validation are treated as absent and a warning
 * is logged to the console.
 *
 * @param id - The unique ID of the note to fetch.
 * @returns The validated note, or `undefined` if it does not exist or fails validation.
 * @throws {Error} If the Dexie query itself throws an unexpected error.
 *
 * @example
 * ```ts
 * const note = await getNoteById('abc123');
 * if (!note) console.warn('Note not found');
 * ```
 */
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

/**
 * Retrieves all {@link Note} records belonging to a given campaign.
 *
 * @remarks
 * Records that fail schema validation are silently excluded from the result
 * and a warning is logged per failed record.
 *
 * @param campaignId - The ID of the campaign whose notes should be fetched.
 * @returns An array of validated notes; may be empty if none exist.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const notes = await getNotesByCampaign('campaign-1');
 * console.log(`Found ${notes.length} notes.`);
 * ```
 */
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

/**
 * Retrieves all {@link Note} records associated with a given session.
 *
 * @remarks
 * Only notes that have a `sessionId` matching the provided value are returned.
 * Campaign-level notes without a `sessionId` are excluded.
 * Records that fail schema validation are silently excluded.
 *
 * @param sessionId - The ID of the session whose notes should be fetched.
 * @returns An array of validated notes; may be empty if none exist.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const sessionNotes = await getNotesBySession('session-42');
 * const combatNote = sessionNotes.find(n => n.type === 'combat');
 * ```
 */
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

/**
 * Creates a new {@link Note} record in IndexedDB and returns the persisted note.
 *
 * @remarks
 * The `id`, `createdAt`, `updatedAt`, and `schemaVersion` fields are
 * generated automatically and must not be supplied in `data`.
 *
 * @param data - All note fields except the auto-generated ones.
 * @returns The newly created note with all generated fields populated.
 * @throws {Error} If the Dexie insert throws (e.g. duplicate key or storage quota exceeded).
 *
 * @example
 * ```ts
 * const note = await createNote({
 *   campaignId: 'campaign-1',
 *   sessionId: 'session-7',
 *   title: 'The Dragon Hoard',
 *   body: null,
 *   type: 'loot',
 *   typeData: {},
 *   status: 'active',
 *   pinned: false,
 * });
 * console.log(note.id); // auto-generated
 * ```
 */
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

/**
 * Applies a partial update to an existing {@link Note} and returns the full
 * updated record.
 *
 * @remarks
 * `updatedAt` is automatically set to the current ISO datetime regardless of
 * whether it is included in `data`.  The full note is re-fetched from the
 * database after the update to guarantee the returned value reflects the
 * persisted state.
 *
 * @param id   - The ID of the note to update.
 * @param data - Partial note fields to merge into the existing record.
 * @returns The updated note as it exists in the database after the write.
 * @throws {Error} If the note cannot be found after the update, or if Dexie throws.
 *
 * @example
 * ```ts
 * const updated = await updateNote('abc123', { title: 'Revised Title', pinned: true });
 * ```
 */
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

/**
 * Permanently deletes a {@link Note} record from IndexedDB.
 *
 * @remarks
 * This operation is irreversible.  The caller is responsible for any
 * confirmation prompts before invoking this function.
 *
 * @param id - The ID of the note to delete.
 * @returns A promise that resolves when the deletion is complete.
 * @throws {Error} If the Dexie delete operation throws.
 *
 * @example
 * ```ts
 * await deleteNote('abc123');
 * ```
 */
export async function deleteNote(id: string): Promise<void> {
  try {
    await db.notes.delete(id);
  } catch (e) {
    throw new Error(`noteRepository.deleteNote failed: ${e}`);
  }
}
