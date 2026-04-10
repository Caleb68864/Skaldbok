import { db } from '../db/client';
import type { CharacterRecord } from '../../types/character';

/**
 * Retrieves all {@link CharacterRecord} entries stored in IndexedDB.
 *
 * @remarks
 * No validation is applied to the raw records — they are returned as-is from
 * Dexie.  Callers that require strict typing should validate records against
 * an appropriate schema after receiving them.
 *
 * @returns An array of all character records; may be empty if none exist.
 *
 * @example
 * ```ts
 * const characters = await getAll();
 * console.log(`${characters.length} characters found.`);
 * ```
 */
export async function getAll(): Promise<CharacterRecord[]> {
  return db.characters.toArray();
}

/**
 * Retrieves a single {@link CharacterRecord} by its unique identifier.
 *
 * @param id - The unique ID of the character to fetch.
 * @returns The character record, or `undefined` if no record with that ID exists.
 *
 * @example
 * ```ts
 * const character = await getById('char-abc123');
 * if (!character) navigate('/library');
 * ```
 */
export async function getById(id: string): Promise<CharacterRecord | undefined> {
  return db.characters.get(id);
}

/**
 * Persists a {@link CharacterRecord} to IndexedDB using an upsert (put) operation.
 *
 * @remarks
 * If a record with the same `id` already exists it is replaced; otherwise a
 * new record is inserted.  A user-friendly error message is thrown when the
 * browser's storage quota has been exceeded so that the UI can surface it as
 * a toast rather than an unhandled exception.
 *
 * @param character - The full character record to persist.
 * @returns A promise that resolves when the write is complete.
 * @throws {Error} With a human-readable message on `QuotaExceededError` or any
 *   other Dexie/IndexedDB failure.
 *
 * @example
 * ```ts
 * await save({ ...character, updatedAt: nowISO() });
 * ```
 */
export async function save(character: CharacterRecord): Promise<void> {
  try {
    await db.characters.put(character);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save character: ${String(err)}`);
  }
}

/**
 * Permanently deletes a character record from IndexedDB.
 *
 * @remarks
 * This operation is irreversible.  The caller is responsible for any
 * confirmation UI before invoking this function.  Cascade-deleting related
 * records (e.g. party members) must be handled separately by the caller.
 *
 * @param id - The unique ID of the character to delete.
 * @returns A promise that resolves when the deletion is complete.
 * @throws {Error} If the Dexie delete operation fails.
 *
 * @example
 * ```ts
 * await remove('char-abc123');
 * ```
 */
export async function remove(id: string): Promise<void> {
  try {
    await db.characters.delete(id);
  } catch (err) {
    throw new Error(`Failed to delete character: ${String(err)}`);
  }
}
