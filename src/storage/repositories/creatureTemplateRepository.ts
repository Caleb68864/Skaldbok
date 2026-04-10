import { db } from '../db/client';
import { creatureTemplateSchema } from '../../types/creatureTemplate';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/**
 * Creates a new creature template in IndexedDB.
 *
 * @param data - All fields except auto-generated ones (id, timestamps, schemaVersion).
 * @returns The newly created creature template record.
 */
export async function create(
  data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
): Promise<CreatureTemplate | undefined> {
  try {
    const now = nowISO();
    const record: CreatureTemplate = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    await db.creatureTemplates.add(record);
    return record;
  } catch (e) {
    console.warn('creatureTemplateRepository.create: failed', e);
    return undefined;
  }
}

/**
 * Retrieves a single creature template by its unique identifier.
 *
 * @param id - The unique ID of the template to fetch.
 * @returns The validated template, or `undefined` if not found or validation fails.
 */
export async function getById(id: string): Promise<CreatureTemplate | undefined> {
  try {
    const raw = await db.creatureTemplates.get(id);
    if (!raw) return undefined;
    const result = creatureTemplateSchema.safeParse(raw);
    if (!result.success) {
      console.warn('creatureTemplateRepository.getById: validation failed for id', id, result.error);
      return undefined;
    }
    return result.data;
  } catch (e) {
    console.warn('creatureTemplateRepository.getById: error', id, e);
    return undefined;
  }
}

/**
 * Returns all creature templates belonging to a given campaign.
 *
 * @param campaignId - The ID of the campaign whose templates should be fetched.
 * @returns An array of validated templates; may be empty.
 */
export async function listByCampaign(campaignId: string): Promise<CreatureTemplate[]> {
  try {
    const raws = await db.creatureTemplates.where('campaignId').equals(campaignId).toArray();
    return raws.flatMap((raw) => {
      const result = creatureTemplateSchema.safeParse(raw);
      if (!result.success) {
        console.warn('creatureTemplateRepository.listByCampaign: validation failed', raw?.id, result.error);
        return [];
      }
      return [result.data];
    });
  } catch (e) {
    console.warn('creatureTemplateRepository.listByCampaign: error', campaignId, e);
    return [];
  }
}

/**
 * Updates a creature template with a partial patch.
 *
 * @param id - The ID of the template to update.
 * @param patch - Fields to merge into the existing record.
 * @returns The updated template, or `undefined` if the record was not found.
 */
export async function update(id: string, patch: Partial<CreatureTemplate>): Promise<CreatureTemplate | undefined> {
  const existing = await getById(id);
  if (!existing) {
    console.warn('creatureTemplateRepository.update: not found', id);
    return undefined;
  }
  const updated: CreatureTemplate = { ...existing, ...patch, id, updatedAt: nowISO() };
  await db.creatureTemplates.put(updated);
  return updated;
}

/**
 * Archives a creature template (sets status to 'archived').
 *
 * @param id - The ID of the template to archive.
 */
export async function archive(id: string): Promise<void> {
  await db.creatureTemplates.update(id, { status: 'archived', updatedAt: nowISO() });
}
