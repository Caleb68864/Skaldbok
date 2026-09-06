import { db } from '../db/client';
import type { CharacterRecord } from '../../types/character';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { normalizeCharacter } from '../../utils/characterNormalization';
import { upgradeCharacter } from '../../utils/migrations';
import { restoreLinksForTxId, softDeleteLinksForEntity } from './entityLinkRepository';
import { getById as getSystemById } from './systemRepository';

/**
 * Loads the system a character is played under, for normalisation.
 *
 * @remarks
 * Read *before* opening any write transaction: `db.systems` is not in the scope
 * of the character transactions below, and reading it from inside one throws.
 * A missing system is not an error — normalisation falls back to leaving values
 * alone rather than imposing bounds it cannot know.
 */
async function loadSystemFor(character: Pick<CharacterRecord, 'systemId'>) {
  try {
    return (await getSystemById(character.systemId)) ?? null;
  } catch {
    return null;
  }
}

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
export async function getAll(options?: { includeDeleted?: boolean }): Promise<CharacterRecord[]> {
  const rows = (await db.characters.toArray()).map(upgradeCharacter);
  return options?.includeDeleted ? rows : excludeDeleted(rows);
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
export async function getById(id: string, options?: { includeDeleted?: boolean }): Promise<CharacterRecord | undefined> {
  const row = await db.characters.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  // Records written by an older schema version are brought forward on read, so
  // the rest of the app only ever sees the current shape. The upgraded record
  // persists on the next save.
  return upgradeCharacter(row);
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
    const system = await loadSystemFor(character);
    await db.characters.put(normalizeCharacter(character, { system }));
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save character: ${String(err)}`);
  }
}

/**
 * Applies a change to one character as a single read-modify-write transaction.
 *
 * @remarks
 * The safe alternative to `getById` → mutate → {@link save}. That pattern reads
 * the record, awaits something, and writes the *whole* record back, so any
 * field another writer changed in between is silently reverted — which is how
 * moving an item into a party container could reappear on the character the
 * next time the sheet autosaved.
 *
 * The mutator runs inside the transaction and is handed the row as stored, not
 * a copy the caller loaded earlier. Return the fields to change, or `null` to
 * make no write at all. `updatedAt` is stamped here, so callers must not.
 *
 * This does **not** solve the second half of the race: if the target is the
 * *active* character, the in-memory record in `ActiveCharacterContext` is still
 * stale and its next autosave will overwrite this write. Route changes to the
 * active character through `updateCharacter`, or call `flushAll()` first.
 *
 * @param id - Character to change.
 * @param mutate - Receives the stored record, returns a partial update or `null`.
 * @returns The updated record, or `null` if the character was missing, deleted,
 *   or the mutator declined.
 */
export async function patch(
  id: string,
  mutate: (current: CharacterRecord) => Partial<CharacterRecord> | null,
): Promise<CharacterRecord | null> {
  try {
    // Read the system outside the transaction: db.systems is not in its scope.
    const existing = await db.characters.get(id);
    if (!existing || existing.deletedAt) return null;
    const system = await loadSystemFor(existing);

    return await db.transaction('rw', db.characters, async () => {
      const current = await db.characters.get(id);
      if (!current || current.deletedAt) return null;
      const changes = mutate(current);
      if (!changes) return null;
      const next = normalizeCharacter({ ...current, ...changes, updatedAt: nowISO() }, { system });
      await db.characters.put(next);
      return next;
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to update character: ${String(err)}`);
  }
}

/**
 * Soft-deletes a character.
 *
 * @remarks
 * The user-facing "Delete" path — the row stays in IndexedDB with a `deletedAt`
 * stamp so it can be restored. Pass `txId` to enlist this in a wider cascade;
 * otherwise a fresh transaction id is minted. No-op if the character is missing
 * or already deleted.
 *
 * Cascades, under the same transaction id, to everything that points at the
 * character: the party seats linked to it (`partyMembers.linkedCharacterId`)
 * and every `entityLinks` edge touching it (encounter participants
 * `represents` it). Without the cascade a deleted character keeps a live seat
 * in the party drawer and a live participant in old encounters.
 */
export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.characters.get(id);
    if (!row) return;
    if (row.deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.transaction('rw', [db.characters, db.partyMembers, db.entityLinks], async () => {
      await db.characters.update(id, {
        deletedAt: now,
        softDeletedBy: finalTxId,
        updatedAt: now,
      });
      const seats = await db.partyMembers.where('linkedCharacterId').equals(id).toArray();
      const liveSeats = seats.filter((m) => !m.deletedAt);
      if (liveSeats.length > 0) {
        await db.partyMembers.bulkUpdate(
          liveSeats.map((m) => ({
            key: m.id,
            changes: { deletedAt: now, softDeletedBy: finalTxId, updatedAt: now },
          })),
        );
      }
      await softDeleteLinksForEntity(id, finalTxId, now);
    });
  } catch (e) {
    throw new Error(`characterRepository.softDelete failed: ${e}`);
  }
}

/**
 * Restores a soft-deleted character together with everything its deletion
 * cascaded to — party seats and edges that share its `softDeletedBy`. A seat
 * removed on its own earlier carries a different transaction id and stays
 * removed. No-op if missing or already live.
 */
export async function restore(id: string): Promise<void> {
  try {
    const row = await db.characters.get(id);
    if (!row) return;
    if (!row.deletedAt) return;
    const txId = row.softDeletedBy;
    const now = nowISO();
    await db.transaction('rw', [db.characters, db.partyMembers, db.entityLinks], async () => {
      await db.characters.update(id, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: now,
      });
      if (!txId) return;
      const seats = await db.partyMembers.where('linkedCharacterId').equals(id).toArray();
      const cascaded = seats.filter((m) => m.softDeletedBy === txId);
      if (cascaded.length > 0) {
        await db.partyMembers.bulkUpdate(
          cascaded.map((m) => ({
            key: m.id,
            changes: { deletedAt: undefined, softDeletedBy: undefined, updatedAt: now },
          })),
        );
      }
      await restoreLinksForTxId(txId);
    });
  } catch (e) {
    throw new Error(`characterRepository.restore failed: ${e}`);
  }
}

/**
 * Every soft-deleted character, most recently deleted first. Feeds the Trash
 * screen; uses the `deletedAt` index rather than scanning the table.
 */
export async function getDeleted(): Promise<CharacterRecord[]> {
  try {
    const rows = await db.characters.where('deletedAt').above('').toArray();
    return rows
      .map((r) => upgradeCharacter(r) as CharacterRecord)
      .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
  } catch (e) {
    throw new Error(`characterRepository.getDeleted failed: ${e}`);
  }
}

/** Permanently removes a character row. Internal only — purge/cleanup jobs, never UI (which soft-deletes). */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.characters.delete(id);
  } catch (e) {
    throw new Error(`characterRepository.hardDelete failed: ${e}`);
  }
}
