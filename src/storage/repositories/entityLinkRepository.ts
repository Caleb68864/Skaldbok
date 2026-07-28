import { db } from '../db/client';
import { entityLinkSchema } from '../../types/entityLink';
import type { EntityLink } from '../../types/entityLink';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';

// entityType is a free-string field — no whitelist enforced.
// Valid values include: 'note', 'character', 'session', 'campaign',
// 'party', 'partyMember', 'encounter', 'encounterParticipant', 'creature'
//
// relationshipType is likewise free-string. Valid values include: 'contains',
// 'introduced_in', 'happened_during', 'represents', 'promoted_into'
// Verified: 2026-07-27 (promoted_into relationship type)

/**
 * Outgoing edges of one relationship type from an entity.
 *
 * @remarks
 * Uses the `[fromEntityId+relationshipType]` compound index for an O(log n)
 * lookup. Rows that fail schema validation are dropped with a warning rather
 * than throwing, so one corrupt edge cannot break a whole query. Soft-deleted
 * edges are excluded unless `includeDeleted` is set.
 */
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

/**
 * Incoming edges of one relationship type into an entity.
 *
 * @remarks
 * The mirror of {@link getLinksFrom}, served by the `[toEntityId+relationshipType]`
 * compound index. Same validation-skips-bad-rows and soft-delete behaviour.
 */
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

/**
 * Creates a new directed edge between two entities.
 *
 * @remarks
 * Edges are immutable identities — to reassign a relationship, delete the old
 * edge and create a new one rather than mutating an existing row. The id and
 * timestamps are generated here; the caller supplies only the endpoints and
 * `relationshipType`.
 */
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

/**
 * Soft-deletes every edge touching a note, in either direction.
 *
 * @remarks
 * The cleanup helper called from the note deletion flow so dangling edges do not
 * accumulate. Pass the cascade's `txId` to tie these edges to the same
 * transaction as the note (so they restore together); omit it to mint a fresh
 * one. Already-deleted edges are left untouched.
 */
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
 * Soft-delete every edge where the given creature template is source or target.
 *
 * @remarks
 * Mirrors {@link softDeleteLinksForEncounter} exactly. All matched edges share
 * the provided `txId` so they can be restored together via
 * {@link restoreLinksForTxId}. Already-deleted edges are left alone.
 */
export async function softDeleteLinksForCreature(
  creatureId: string,
  txId: string,
  now: string,
): Promise<void> {
  try {
    const fromLinks = await db.entityLinks.where('fromEntityId').equals(creatureId).toArray();
    const toLinks = await db.entityLinks.where('toEntityId').equals(creatureId).toArray();
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
    throw new Error(`entityLinkRepository.softDeleteLinksForCreature failed: ${e}`);
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

/** Soft-deletes one edge by id, sharing `txId` when part of a larger cascade. No-op if missing or already deleted. */
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

/** Restores one soft-deleted edge by clearing its `deletedAt`/`softDeletedBy`. No-op if missing or already live. */
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

/** Permanently removes an edge row. Internal only — purge/cleanup jobs, never UI. */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.entityLinks.delete(id);
  } catch (e) {
    throw new Error(`entityLinkRepository.hardDelete failed: ${e}`);
  }
}
