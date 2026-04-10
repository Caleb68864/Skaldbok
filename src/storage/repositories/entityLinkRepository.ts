import { db } from '../db/client';
import { entityLinkSchema } from '../../types/entityLink';
import type { EntityLink } from '../../types/entityLink';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';

// entityType is a free-string field — no whitelist enforced.
// Valid values include: 'note', 'character', 'session', 'campaign',
// 'party', 'partyMember', 'encounter', 'encounterParticipant', 'creature'
// Verified: 2026-04-10 (encounter-notes-folder-unification)

export async function getLinksFrom(fromEntityId: string, relationshipType: string, options?: { includeDeleted?: boolean }): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks
      .where('[fromEntityId+relationshipType]')
      .equals([fromEntityId, relationshipType])
      .toArray();
    const parsed = records
      .map(r => {
        const result = entityLinkSchema.safeParse(r);
        if (!result.success) {
          console.warn('entityLinkRepository.getLinksFrom: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`entityLinkRepository.getLinksFrom failed: ${e}`);
  }
}

export async function getLinksTo(toEntityId: string, relationshipType: string, options?: { includeDeleted?: boolean }): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks
      .where('[toEntityId+relationshipType]')
      .equals([toEntityId, relationshipType])
      .toArray();
    const parsed = records
      .map(r => {
        const result = entityLinkSchema.safeParse(r);
        if (!result.success) {
          console.warn('entityLinkRepository.getLinksTo: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`entityLinkRepository.getLinksTo failed: ${e}`);
  }
}

/**
 * Returns all entity links originating from a given entity, regardless of relationship type.
 */
export async function getAllLinksFrom(fromEntityId: string, options?: { includeDeleted?: boolean }): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks.where('fromEntityId').equals(fromEntityId).toArray();
    const parsed = records
      .map(r => {
        const result = entityLinkSchema.safeParse(r);
        if (!result.success) {
          console.warn('entityLinkRepository.getAllLinksFrom: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`entityLinkRepository.getAllLinksFrom failed: ${e}`);
  }
}

/**
 * Returns all entity links pointing to a given entity, regardless of relationship type.
 */
export async function getAllLinksTo(toEntityId: string, options?: { includeDeleted?: boolean }): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks.where('toEntityId').equals(toEntityId).toArray();
    const parsed = records
      .map(r => {
        const result = entityLinkSchema.safeParse(r);
        if (!result.success) {
          console.warn('entityLinkRepository.getAllLinksTo: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`entityLinkRepository.getAllLinksTo failed: ${e}`);
  }
}

export async function createLink(data: Omit<EntityLink, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<EntityLink> {
  try {
    const now = nowISO();
    const link: EntityLink = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.entityLinks.add(link);
    return link;
  } catch (e) {
    throw new Error(`entityLinkRepository.createLink failed: ${e}`);
  }
}

export async function deleteLinksForNote(noteId: string, txId?: string): Promise<void> {
  try {
    const fromLinks = await db.entityLinks.where('fromEntityId').equals(noteId).toArray();
    const toLinks = await db.entityLinks.where('toEntityId').equals(noteId).toArray();
    const all = [...fromLinks, ...toLinks];
    if (all.length === 0) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    const changes = all
      .filter(l => !(l as EntityLink).deletedAt)
      .map(l => ({
        key: l.id,
        changes: { deletedAt: now, softDeletedBy: finalTxId, updatedAt: now },
      }));
    if (changes.length > 0) {
      await db.entityLinks.bulkUpdate(changes);
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.deleteLinksForNote failed: ${e}`);
  }
}

/**
 * Soft-delete every edge where the given encounter is source or target.
 *
 * @remarks
 * All matched edges share the provided `txId` so they can be restored
 * together via {@link restoreLinksForTxId}. Already-deleted edges are
 * left alone.
 */
export async function softDeleteLinksForEncounter(
  encounterId: string,
  txId: string,
  now: string,
): Promise<void> {
  try {
    const fromLinks = await db.entityLinks.where('fromEntityId').equals(encounterId).toArray();
    const toLinks = await db.entityLinks.where('toEntityId').equals(encounterId).toArray();
    const byId = new Map<string, EntityLink>();
    for (const l of [...fromLinks, ...toLinks]) {
      if (!(l as EntityLink).deletedAt) {
        byId.set(l.id, l as EntityLink);
      }
    }
    for (const id of byId.keys()) {
      await db.entityLinks.update(id, {
        deletedAt: now,
        softDeletedBy: txId,
        updatedAt: now,
      });
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.softDeleteLinksForEncounter failed: ${e}`);
  }
}

/**
 * Restore every edge that was soft-deleted in the given transaction.
 *
 * @remarks
 * Clears both `deletedAt` and `softDeletedBy` on every row whose
 * `softDeletedBy` matches the given `txId`. Used by the encounter restore
 * cascade to reinstate edges that were taken down together.
 */
export async function restoreLinksForTxId(txId: string): Promise<void> {
  try {
    const rows = await db.entityLinks.where('softDeletedBy').equals(txId).toArray();
    for (const row of rows) {
      await db.entityLinks.update(row.id, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: nowISO(),
      });
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.restoreLinksForTxId failed: ${e}`);
  }
}

export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.entityLinks.get(id);
    if (!row) return;
    if ((row as EntityLink).deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.entityLinks.update(id, {
      deletedAt: now,
      softDeletedBy: finalTxId,
      updatedAt: now,
    });
  } catch (e) {
    throw new Error(`entityLinkRepository.softDelete failed: ${e}`);
  }
}

export async function restore(id: string): Promise<void> {
  try {
    const row = await db.entityLinks.get(id);
    if (!row) return;
    if (!(row as EntityLink).deletedAt) return;
    await db.entityLinks.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`entityLinkRepository.restore failed: ${e}`);
  }
}

export async function hardDelete(id: string): Promise<void> {
  try {
    await db.entityLinks.delete(id);
  } catch (e) {
    throw new Error(`entityLinkRepository.hardDelete failed: ${e}`);
  }
}
