import { db } from '../db/client';
import { portraitSchema } from '../../types/portrait';
import type { Portrait } from '../../types/portrait';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted } from '../../utils/softDelete';

/**
 * Character portraits as Blobs (roadmap H8). See `types/portrait.ts`.
 *
 * @remarks
 * A character has at most one live portrait row, and setting a new image
 * **replaces that row's Blob in place** rather than adding a row and deleting
 * the old one. That is the same act as replacing the inline data URL always
 * was, it leaves no tombstones to accumulate, and it needs no permanent delete
 * on a user-reachable path. Rows are soft-deleted only with their character.
 */

function parse(row: unknown, where: string): Portrait | undefined {
  const parsed = portraitSchema.safeParse(row);
  if (!parsed.success) {
    console.warn(`portraitRepository.${where}: validation failed`, parsed.error);
    return undefined;
  }
  return parsed.data;
}

/**
 * Stores a character's portrait image and returns the row's id.
 *
 * @param characterId - The character the image belongs to.
 * @param blob - The image, already resized by the caller.
 * @param existingId - The character's current `portraitId`, if any. A live row
 *   with that id belonging to this character is updated in place.
 */
export async function savePortrait(characterId: string, blob: Blob, existingId?: string): Promise<string> {
  try {
    const now = nowISO();
    return await db.transaction('rw', db.portraits, async () => {
      const current = existingId ? await db.portraits.get(existingId) : undefined;
      if (current && !current.deletedAt && current.characterId === characterId) {
        await db.portraits.update(current.id, {
          blob, mimeType: blob.type || 'image/jpeg', sizeBytes: blob.size, updatedAt: now,
        });
        return current.id;
      }
      const row: Portrait = {
        id: generateId(),
        characterId,
        mimeType: blob.type || 'image/jpeg',
        sizeBytes: blob.size,
        blob,
        createdAt: now,
        updatedAt: now,
      };
      await db.portraits.add(row);
      return row.id;
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      const quotaError = new Error('Storage full', { cause: e });
      quotaError.name = 'QuotaExceededError';
      throw quotaError;
    }
    throw new Error(`portraitRepository.savePortrait failed: ${e}`, { cause: e });
  }
}

/** A live portrait by id, or `undefined`. */
export async function getPortrait(id: string): Promise<Portrait | undefined> {
  try {
    const row = await db.portraits.get(id);
    if (!row || row.deletedAt) return undefined;
    return parse(row, 'getPortrait');
  } catch (e) {
    throw new Error(`portraitRepository.getPortrait failed: ${e}`, { cause: e });
  }
}

/** The live portraits of the given characters, for an export. */
export async function getPortraitsForCharacters(characterIds: string[]): Promise<Portrait[]> {
  try {
    if (characterIds.length === 0) return [];
    const rows = await db.portraits.where('characterId').anyOf(characterIds).toArray();
    return excludeDeleted(rows)
      .map((row) => parse(row, 'getPortraitsForCharacters'))
      .filter((p): p is Portrait => p !== undefined);
  } catch (e) {
    throw new Error(`portraitRepository.getPortraitsForCharacters failed: ${e}`, { cause: e });
  }
}

/**
 * Copies a portrait to another character (character duplicate) and returns the new id.
 *
 * @returns The copy's id, or `undefined` when there is no live source row.
 */
export async function copyPortrait(sourceId: string, characterId: string): Promise<string | undefined> {
  try {
    const source = await db.portraits.get(sourceId);
    if (!source || source.deletedAt) return undefined;
    const now = nowISO();
    const id = generateId();
    await db.portraits.add({ ...source, id, characterId, createdAt: now, updatedAt: now, deletedAt: undefined, softDeletedBy: undefined });
    return id;
  } catch (e) {
    throw new Error(`portraitRepository.copyPortrait failed: ${e}`, { cause: e });
  }
}

/**
 * Soft-deletes a character's live portraits under its cascade id.
 *
 * @remarks
 * Runs inside `characterRepository.softDelete`'s transaction.
 */
export async function softDeletePortraitsForCharacter(characterId: string, txId: string, now: string): Promise<void> {
  const rows = excludeDeleted(await db.portraits.where('characterId').equals(characterId).toArray());
  if (rows.length === 0) return;
  await db.portraits.bulkUpdate(
    rows.map((row) => ({ key: row.id, changes: { deletedAt: now, softDeletedBy: txId, updatedAt: now } })),
  );
}

/** Clears the tombstone on every portrait deleted under `txId`. */
export async function restorePortraitsForTxId(txId: string, now: string): Promise<void> {
  const rows = await db.portraits.where('softDeletedBy').equals(txId).toArray();
  if (rows.length === 0) return;
  await db.portraits.bulkUpdate(
    rows.map((row) => ({ key: row.id, changes: { deletedAt: undefined, softDeletedBy: undefined, updatedAt: now } })),
  );
}
