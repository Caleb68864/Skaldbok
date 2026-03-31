import { db } from '../db/client';
import { entityLinkSchema } from '../../types/entityLink';
import type { EntityLink } from '../../types/entityLink';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

export async function getLinksFrom(fromEntityId: string, relationshipType: string): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks
      .where('[fromEntityId+relationshipType]')
      .equals([fromEntityId, relationshipType])
      .toArray();
    return records
      .map(r => {
        const parsed = entityLinkSchema.safeParse(r);
        if (!parsed.success) {
          console.warn('entityLinkRepository.getLinksFrom: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
  } catch (e) {
    throw new Error(`entityLinkRepository.getLinksFrom failed: ${e}`);
  }
}

export async function getLinksTo(toEntityId: string, relationshipType: string): Promise<EntityLink[]> {
  try {
    const records = await db.entityLinks
      .where('[toEntityId+relationshipType]')
      .equals([toEntityId, relationshipType])
      .toArray();
    return records
      .map(r => {
        const parsed = entityLinkSchema.safeParse(r);
        if (!parsed.success) {
          console.warn('entityLinkRepository.getLinksTo: validation failed', parsed.error);
          return undefined;
        }
        return parsed.data;
      })
      .filter((l): l is EntityLink => l !== undefined);
  } catch (e) {
    throw new Error(`entityLinkRepository.getLinksTo failed: ${e}`);
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

export async function deleteLinksForNote(noteId: string): Promise<void> {
  try {
    // Fetch all links where this note is from or to
    const fromLinks = await db.entityLinks.where('fromEntityId').equals(noteId).toArray();
    const toLinks = await db.entityLinks.where('toEntityId').equals(noteId).toArray();
    const ids = [
      ...fromLinks.map(l => l.id),
      ...toLinks.map(l => l.id),
    ];
    if (ids.length > 0) {
      await db.entityLinks.bulkDelete(ids);
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.deleteLinksForNote failed: ${e}`);
  }
}
