import { db } from '../db/client';
import { encounterSchema } from '../../types/encounter';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/**
 * Creates a new encounter in IndexedDB.
 *
 * @param data - All fields except auto-generated ones (id, timestamps, schemaVersion).
 * @returns The newly created encounter record.
 */
export async function create(
  data: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
): Promise<Encounter | undefined> {
  try {
    const now = nowISO();
    const record: Encounter = {
      ...data,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    await db.encounters.add(record);
    return record;
  } catch (e) {
    console.warn('encounterRepository.create: failed', e);
    return undefined;
  }
}

/**
 * Retrieves a single encounter by its unique identifier.
 *
 * @param id - The unique ID of the encounter to fetch.
 * @returns The validated encounter, or `undefined` if not found or validation fails.
 */
export async function getById(id: string): Promise<Encounter | undefined> {
  try {
    const raw = await db.encounters.get(id);
    if (!raw) return undefined;
    const result = encounterSchema.safeParse(raw);
    if (!result.success) {
      console.warn('encounterRepository.getById: validation failed for id', id, result.error);
      return undefined;
    }
    return result.data;
  } catch (e) {
    console.warn('encounterRepository.getById: error', id, e);
    return undefined;
  }
}

/**
 * Returns all encounters belonging to a given session.
 *
 * @param sessionId - The ID of the session whose encounters should be fetched.
 * @returns An array of validated encounters; may be empty.
 */
export async function listBySession(sessionId: string): Promise<Encounter[]> {
  try {
    const raws = await db.encounters.where('sessionId').equals(sessionId).toArray();
    return raws.flatMap((raw) => {
      const result = encounterSchema.safeParse(raw);
      if (!result.success) {
        console.warn('encounterRepository.listBySession: validation failed', raw?.id, result.error);
        return [];
      }
      return [result.data];
    });
  } catch (e) {
    console.warn('encounterRepository.listBySession: error', sessionId, e);
    return [];
  }
}

/**
 * Returns all encounters belonging to a given campaign.
 *
 * @param campaignId - The ID of the campaign whose encounters should be fetched.
 * @returns An array of validated encounters; may be empty.
 */
export async function listByCampaign(campaignId: string): Promise<Encounter[]> {
  try {
    const raws = await db.encounters.where('campaignId').equals(campaignId).toArray();
    return raws.flatMap((raw) => {
      const result = encounterSchema.safeParse(raw);
      if (!result.success) {
        console.warn('encounterRepository.listByCampaign: validation failed', raw?.id, result.error);
        return [];
      }
      return [result.data];
    });
  } catch (e) {
    console.warn('encounterRepository.listByCampaign: error', campaignId, e);
    return [];
  }
}

/**
 * Updates an encounter with a partial patch.
 *
 * @param id - The ID of the encounter to update.
 * @param patch - Fields to merge into the existing record.
 * @returns The updated encounter, or `undefined` if not found.
 */
export async function update(id: string, patch: Partial<Encounter>): Promise<Encounter | undefined> {
  const existing = await getById(id);
  if (!existing) {
    console.warn('encounterRepository.update: not found', id);
    return undefined;
  }
  const updated: Encounter = { ...existing, ...patch, id, updatedAt: nowISO() };
  await db.encounters.put(updated);
  return updated;
}

/**
 * Ends an encounter by setting its status to 'ended' and recording the end time.
 *
 * @param id - The ID of the encounter to end.
 * @returns The updated encounter, or `undefined` if not found.
 */
export async function end(id: string): Promise<Encounter | undefined> {
  return update(id, { status: 'ended', endedAt: nowISO() });
}

/**
 * Updates a single participant within an encounter without replacing others.
 *
 * @param encounterId - The ID of the encounter containing the participant.
 * @param participantId - The ID of the participant to update.
 * @param patch - Fields to merge into the participant's record.
 * @returns The updated encounter, or `undefined` if the encounter or participant was not found.
 */
export async function updateParticipant(
  encounterId: string,
  participantId: string,
  patch: Partial<EncounterParticipant>
): Promise<Encounter | undefined> {
  const existing = await getById(encounterId);
  if (!existing) {
    console.warn('encounterRepository.updateParticipant: encounter not found', encounterId);
    return undefined;
  }
  const updatedParticipants = existing.participants.map((p) =>
    p.id === participantId ? { ...p, ...patch } : p
  );
  return update(encounterId, { participants: updatedParticipants });
}

/**
 * Adds a new participant to an encounter.
 *
 * @param encounterId - The ID of the encounter to add a participant to.
 * @param participant - Participant data (without id — auto-generated).
 * @returns The updated encounter, or `undefined` if the encounter was not found.
 */
export async function addParticipant(
  encounterId: string,
  participant: Omit<EncounterParticipant, 'id'>
): Promise<Encounter | undefined> {
  const existing = await getById(encounterId);
  if (!existing) {
    console.warn('encounterRepository.addParticipant: encounter not found', encounterId);
    return undefined;
  }
  const newParticipant: EncounterParticipant = {
    ...participant,
    id: generateId(),
  };
  return update(encounterId, {
    participants: [...existing.participants, newParticipant],
  });
}
