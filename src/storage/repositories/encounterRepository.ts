import { db } from '../db/client';
import { encounterSchema } from '../../types/encounter';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import * as entityLinkRepository from './entityLinkRepository';

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
export async function getById(id: string, options?: { includeDeleted?: boolean }): Promise<Encounter | undefined> {
  try {
    const raw = await db.encounters.get(id);
    if (!raw) return undefined;
    const result = encounterSchema.safeParse(raw);
    if (!result.success) {
      console.warn('encounterRepository.getById: validation failed for id', id, result.error);
      return undefined;
    }
    if (!options?.includeDeleted && result.data.deletedAt) return undefined;
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
export async function listBySession(sessionId: string, options?: { includeDeleted?: boolean }): Promise<Encounter[]> {
  try {
    const raws = await db.encounters.where('sessionId').equals(sessionId).toArray();
    const parsed = raws.flatMap((raw) => {
      const result = encounterSchema.safeParse(raw);
      if (!result.success) {
        console.warn('encounterRepository.listBySession: validation failed', raw?.id, result.error);
        return [];
      }
      return [result.data];
    });
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
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
export async function listByCampaign(campaignId: string, options?: { includeDeleted?: boolean }): Promise<Encounter[]> {
  try {
    const raws = await db.encounters.where('campaignId').equals(campaignId).toArray();
    const parsed = raws.flatMap((raw) => {
      const result = encounterSchema.safeParse(raw);
      if (!result.success) {
        console.warn('encounterRepository.listByCampaign: validation failed', raw?.id, result.error);
        return [];
      }
      return [result.data];
    });
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
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
 * Ends an encounter by setting its status to 'ended'. The encounter's active
 * segment (if any) is closed via {@link endActiveSegment}.
 *
 * @param id - The ID of the encounter to end.
 * @returns The updated encounter, or `undefined` if not found.
 */
export async function end(id: string): Promise<Encounter | undefined> {
  const existing = await getById(id);
  if (!existing) return undefined;
  if (existing.segments.length > 0 && !existing.segments[existing.segments.length - 1].endedAt) {
    await endActiveSegment(id);
  }
  return update(id, { status: 'ended' });
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

/**
 * Returns the single active encounter for a session, or null.
 *
 * @remarks
 * "Active" is defined as the (non-deleted) encounter whose last segment has
 * no `endedAt`. Encounters with empty segments arrays or fully-closed
 * segment lists are ignored.
 */
export async function getActiveEncounterForSession(sessionId: string): Promise<Encounter | null> {
  try {
    const rows = await db.encounters.where('sessionId').equals(sessionId).toArray();
    const valid = rows
      .map((r) => encounterSchema.safeParse(r))
      .filter((p): p is { success: true; data: Encounter } => p.success)
      .map((p) => p.data);
    const alive = excludeDeleted(valid);
    const active = alive.find((e) => {
      if (!e.segments || e.segments.length === 0) return false;
      const last = e.segments[e.segments.length - 1];
      return !last.endedAt;
    });
    return active ?? null;
  } catch (e) {
    throw new Error(`encounterRepository.getActiveEncounterForSession failed: ${e}`);
  }
}

/**
 * Returns up to `limit` most-recently-ended encounters for a session.
 *
 * @remarks
 * Sorted by the last segment's `endedAt` descending. Excludes soft-deleted
 * encounters and encounters with no ended segments.
 */
export async function getRecentEndedEncountersForSession(
  sessionId: string,
  limit: number,
): Promise<Encounter[]> {
  try {
    const rows = await db.encounters.where('sessionId').equals(sessionId).toArray();
    const valid = rows
      .map((r) => encounterSchema.safeParse(r))
      .filter((p): p is { success: true; data: Encounter } => p.success)
      .map((p) => p.data);
    const alive = excludeDeleted(valid);
    const ended = alive
      .filter((e) => {
        if (!e.segments || e.segments.length === 0) return false;
        const last = e.segments[e.segments.length - 1];
        return !!last.endedAt;
      })
      .sort((a, b) => {
        const aEnd = a.segments[a.segments.length - 1].endedAt ?? '';
        const bEnd = b.segments[b.segments.length - 1].endedAt ?? '';
        return bEnd.localeCompare(aEnd);
      });
    return ended.slice(0, limit);
  } catch (e) {
    throw new Error(`encounterRepository.getRecentEndedEncountersForSession failed: ${e}`);
  }
}

/**
 * Appends a new open segment to an encounter.
 *
 * @remarks
 * Throws if the last segment is still open (no `endedAt`). Invariant: at
 * most one open segment at a time.
 */
export async function pushSegment(
  encounterId: string,
  segment: { startedAt: string },
): Promise<void> {
  try {
    const row = await db.encounters.get(encounterId);
    if (!row) throw new Error(`encounter not found: ${encounterId}`);
    const parsed = encounterSchema.safeParse(row);
    if (!parsed.success) throw new Error(`encounter row invalid: ${encounterId}`);
    const enc = parsed.data;
    if (enc.segments.length > 0 && !enc.segments[enc.segments.length - 1].endedAt) {
      throw new Error(
        `encounterRepository.pushSegment: last segment of ${encounterId} is still open`,
      );
    }
    const newSegments = [...enc.segments, { startedAt: segment.startedAt }];
    await db.encounters.update(encounterId, {
      segments: newSegments,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`encounterRepository.pushSegment failed: ${e}`);
  }
}

/**
 * Sets `endedAt` on the current open segment of an encounter.
 *
 * @remarks
 * Throws if there is no open segment (either the encounter has no segments
 * or the last segment is already ended).
 */
export async function endActiveSegment(encounterId: string): Promise<void> {
  try {
    const row = await db.encounters.get(encounterId);
    if (!row) throw new Error(`encounter not found: ${encounterId}`);
    const parsed = encounterSchema.safeParse(row);
    if (!parsed.success) throw new Error(`encounter row invalid: ${encounterId}`);
    const enc = parsed.data;
    if (enc.segments.length === 0) {
      throw new Error(`encounterRepository.endActiveSegment: no segments for ${encounterId}`);
    }
    const last = enc.segments[enc.segments.length - 1];
    if (last.endedAt) {
      throw new Error(
        `encounterRepository.endActiveSegment: last segment of ${encounterId} is already ended`,
      );
    }
    const newSegments = enc.segments.map((s, i) =>
      i === enc.segments.length - 1 ? { ...s, endedAt: nowISO() } : s,
    );
    await db.encounters.update(encounterId, {
      segments: newSegments,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`encounterRepository.endActiveSegment failed: ${e}`);
  }
}

/**
 * Atomically close any currently-open encounter on the session and open the
 * target encounter in a single rw-transaction. Rolls back on any throw so
 * the DB never ends in a state where the prior encounter is closed but the
 * target is not reopened (or vice versa).
 */
export async function reopenEncounter(
  sessionId: string,
  targetEncounterId: string,
): Promise<void> {
  try {
    await db.transaction('rw', [db.encounters], async () => {
      const existing = await db.encounters.get(targetEncounterId);
      if (!existing) {
        throw new Error(
          `encounterRepository.reopenEncounter: encounter ${targetEncounterId} not found`,
        );
      }
      if ((existing as Encounter).deletedAt) {
        throw new Error(
          `encounterRepository.reopenEncounter: encounter ${targetEncounterId} is deleted`,
        );
      }
      const priorActive = await getActiveEncounterForSession(sessionId);
      if (priorActive && priorActive.id !== targetEncounterId) {
        await endActiveSegment(priorActive.id);
      }
      await pushSegment(targetEncounterId, { startedAt: nowISO() });
      await db.encounters.update(targetEncounterId, {
        status: 'active',
        updatedAt: nowISO(),
      });
    });
  } catch (e) {
    throw new Error(`encounterRepository.reopenEncounter failed: ${e}`);
  }
}

/**
 * Soft-deletes an encounter and cascades the delete to every associated
 * entity link edge in a single transaction.
 *
 * @remarks
 * Overrides the basic soft-delete added in Sub-Spec 1. All cascaded rows
 * share the same `softDeletedBy` UUID so {@link restore} can bring them
 * back atomically. Idempotent and a silent no-op on missing rows.
 */
export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const row = await db.encounters.get(id);
      if (!row) return;
      if ((row as Encounter).deletedAt) return;
      await db.encounters.update(id, {
        deletedAt: now,
        softDeletedBy: finalTxId,
        updatedAt: now,
      });
      await entityLinkRepository.softDeleteLinksForEncounter(id, finalTxId, now);
    });
  } catch (e) {
    throw new Error(`encounterRepository.softDelete failed: ${e}`);
  }
}

/**
 * Restores a soft-deleted encounter and every edge cascaded with it.
 *
 * @remarks
 * Reads the `softDeletedBy` UUID off the encounter row, then clears
 * `deletedAt` / `softDeletedBy` on the encounter and every edge that shares
 * that UUID. Runs in a single transaction.
 */
export async function restore(id: string): Promise<void> {
  try {
    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const row = await db.encounters.get(id);
      if (!row) return;
      if (!(row as Encounter).deletedAt) return;
      const txId = (row as Encounter).softDeletedBy;
      const now = nowISO();
      await db.encounters.update(id, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: now,
      });
      if (txId) {
        await entityLinkRepository.restoreLinksForTxId(txId);
      }
    });
  } catch (e) {
    throw new Error(`encounterRepository.restore failed: ${e}`);
  }
}

export async function hardDelete(id: string): Promise<void> {
  try {
    await db.encounters.delete(id);
  } catch (e) {
    throw new Error(`encounterRepository.hardDelete failed: ${e}`);
  }
}
