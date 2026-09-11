import { db } from '../db/client';
import { encounterSchema } from '../../types/encounter';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import * as entityLinkRepository from './entityLinkRepository';
import * as sessionRepository from './sessionRepository';

/**
 * Creates a new encounter in IndexedDB.
 *
 * @remarks
 * Throws on failure, like every other write in this layer. It used to catch
 * everything — `QuotaExceededError` included — `console.warn` it and return
 * `undefined`, so a failed write was indistinguishable from a successful one at
 * every call site. This is local-first; there is no server copy and no later
 * retry.
 *
 * @param data - All fields except auto-generated ones (id, timestamps, schemaVersion).
 * @returns The newly created encounter record.
 * @throws If the row cannot be written — "Storage is full…" on a quota failure.
 */
export async function create(
  data: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
): Promise<Encounter> {
  const now = nowISO();
  const record: Encounter = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
  try {
    await db.encounters.add(record);
    return record;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.', { cause: e });
    }
    throw new Error(`encounterRepository.create failed: ${e}`, { cause: e });
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
  // The read and the write are one transaction. Split apart, two edits landing
  // in the same tick each read the pre-edit row and the second silently
  // discards the first — two quick blurs in the combat view lost the earlier one.
  return db.transaction('rw', db.encounters, async () => {
    const existing = await db.encounters.get(id);
    if (!existing || existing.deletedAt) {
      console.warn('encounterRepository.update: not found', id);
      return undefined;
    }
    const updated: Encounter = { ...existing, ...patch, id, updatedAt: nowISO() };
    await db.encounters.put(updated);
    return updated;
  });
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

/** Fields for starting a new encounter within a session. */
export interface StartEncounterInput {
  title: string;
  type: Encounter['type'];
  description?: unknown; // ProseMirror JSON
  tags?: string[];
  location?: string;
  /**
   * Parent encounter override for the auto-generated `happened_during` edge.
   * - `undefined` (or omitted): auto-link to the currently-active encounter, if any
   * - `null`: do NOT create a `happened_during` edge even if one is active
   * - specific id: use that id as the parent
   */
  parentOverride?: string | null;
}

/**
 * Opens an encounter in a session, closing any prior active one.
 *
 * @remarks
 * Moved out of `useSessionEncounter.startEncounter`, which held the whole thing
 * — the session lookup, the transaction over three tables, the row and the
 * `happened_during` edge — inline in a React hook.
 *
 * The transaction spans `encounters`, `entityLinks` and `sessions` and that is
 * not incidental: the prior active encounter's segment must close in the same
 * commit that opens the new one, or the "at most one active encounter per
 * session" invariant is briefly false and a concurrent read sees two. That is
 * why this is one repository function rather than three calls a caller
 * sequences, and it is the reason the `db.transaction` stays — it simply stays
 * on the correct side of the storage boundary.
 *
 * The session is resolved through {@link sessionRepository.getSessionById},
 * which excludes soft-deleted rows, so an encounter can no longer be started in
 * a deleted session. The old inline `db.sessions.get(sessionId)` checked only
 * that the row was there.
 *
 * @param sessionId - Session to open the encounter in.
 * @param input - Validated encounter fields.
 * @returns The created encounter.
 * @throws If the session does not exist or is soft-deleted.
 */
export async function startForSession(
  sessionId: string,
  input: StartEncounterInput,
): Promise<Encounter> {
  const session = await sessionRepository.getSessionById(sessionId);
  if (!session) {
    throw new Error(`encounterRepository.startForSession: session ${sessionId} not found`);
  }

  let created: Encounter | null = null;
  await db.transaction('rw', [db.encounters, db.entityLinks, db.sessions], async () => {
    // Re-read the active encounter *inside* the transaction to win last-writer races.
    const priorActive = await getActiveEncounterForSession(sessionId);
    if (priorActive) await endActiveSegment(priorActive.id);

    const now = nowISO();
    const newId = generateId();
    const newEncounter: Encounter = {
      id: newId,
      sessionId,
      campaignId: session.campaignId,
      title: input.title.trim(),
      type: input.type,
      status: 'active',
      description: input.description,
      body: undefined,
      summary: undefined,
      tags: input.tags ?? [],
      location: input.location,
      segments: [{ startedAt: now }],
      participants: [],
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.encounters.add(newEncounter);

    let parentId: string | null = null;
    if (input.parentOverride === null) parentId = null;
    else if (input.parentOverride !== undefined) parentId = input.parentOverride;
    else if (priorActive) parentId = priorActive.id;

    if (parentId) {
      await entityLinkRepository.createLink({
        fromEntityId: newId,
        fromEntityType: 'encounter',
        toEntityId: parentId,
        toEntityType: 'encounter',
        relationshipType: 'happened_during',
      });
    }
    created = newEncounter;
  });

  if (!created) {
    throw new Error(
      'encounterRepository.startForSession: transaction completed without creating an encounter',
    );
  }
  return created;
}

/**
 * Closes an encounter's open segment and records the user's wrap-up prose.
 *
 * @remarks
 * This was written out in `useSessionEncounter.endEncounter` as a bare
 * `db.encounters.get(id)` — existence checked, `deletedAt` not — followed by a
 * transaction writing `status: 'ended'` and the summary. So the paragraph
 * someone types at the end of a fight could land in an encounter that had been
 * deleted in another tab, and be unreachable the moment the dialog closed.
 *
 * It is the worst of the four tombstone-blind writes for one specific reason:
 * the other three write structure the user can re-create — a participant, a
 * party — and this one writes text they composed by hand. This is local-first;
 * there is no other copy of it anywhere.
 *
 * Distinct from {@link end}, which takes no summary and resolves the encounter
 * through {@link getById}. Both refuse a tombstone; this one says so by throwing
 * rather than returning `undefined`, because the caller is a dialog that must
 * not silently swallow the text it was given.
 *
 * @param id - Encounter to end.
 * @param summary - Wrap-up content. Omit to leave any existing summary alone.
 * @returns The updated encounter.
 * @throws If the encounter does not exist or is soft-deleted.
 */
export async function endWithSummary(id: string, summary?: unknown): Promise<Encounter | undefined> {
  return db.transaction('rw', [db.encounters], async () => {
    const existing = await db.encounters.get(id);
    if (!existing) {
      throw new Error(`encounterRepository.endWithSummary: encounter ${id} not found`);
    }
    if ((existing as Encounter).deletedAt) {
      throw new Error(`encounterRepository.endWithSummary: encounter ${id} is deleted`);
    }
    const segments = (existing as Encounter).segments ?? [];
    if (segments.length > 0 && !segments[segments.length - 1]!.endedAt) {
      await endActiveSegment(id);
    }
    const updates: Partial<Encounter> = { status: 'ended', updatedAt: nowISO() };
    if (summary !== undefined) updates.summary = summary;
    await db.encounters.update(id, updates);
    const updated = await db.encounters.get(id);
    return updated as Encounter | undefined;
  });
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
  // One transaction covering the read of the participant list and the write of
  // the merged one. Previously this read the encounter, mapped the list, and
  // then `update` read it *again* and put the whole record — so two
  // participants edited in the same tick each mapped the pre-edit list and the
  // second write dropped the first participant's change.
  return db.transaction('rw', db.encounters, async () => {
    const existing = await db.encounters.get(encounterId);
    if (!existing || existing.deletedAt) {
      console.warn('encounterRepository.updateParticipant: encounter not found', encounterId);
      return undefined;
    }
    const updated: Encounter = {
      ...existing,
      participants: existing.participants.map((p) =>
        p.id === participantId ? { ...p, ...patch } : p,
      ),
      updatedAt: nowISO(),
    };
    await db.encounters.put(updated);
    return updated;
  });
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
 * One participant to add, and the bestiary creature or PC it stands for.
 *
 * @remarks
 * `represents` is not optional, because a participant with no `represents` edge
 * is a bare name with no stat block, no HP source and no identity — every reader
 * (`CombatEncounterView`, `ParticipantDrawer`, `useEncounter`) resolves the
 * participant through that edge. The binding has no foreign-key column by
 * design; `encounterParticipantSchema` says so in its own doc comment.
 */
export interface ParticipantToAdd {
  name: string;
  type: EncounterParticipant['type'];
  instanceState?: EncounterParticipant['instanceState'];
  represents: { id: string; type: 'creature' | 'character' };
}

/**
 * Adds participants to an encounter with their `represents` edges, in one
 * transaction, refusing a soft-deleted encounter.
 *
 * @remarks
 * **The one implementation of a rule that used to have four.** Four callers
 * opened `db.transaction('rw', [db.encounters, db.entityLinks], …)` by hand and
 * wrote a participant into whatever they read back — the bestiary's "Add to
 * Encounter", the combat view's quick-create, the add-the-whole-party helper,
 * and `useEncounter`'s own two paths. Only `useEncounter` checked `deletedAt`,
 * and it carried the comment explaining why all of them had to:
 *
 * > "A tombstoned encounter is invisible in the UI, so writing to one adds a
 * > participant nobody can see or remove. The repository's `update` refuses
 * > this; the participant paths need their own transaction (they touch
 * > entityLinks too), so they have to make the same check."
 *
 * That is the whole argument for this function existing. The participant paths
 * do need their own transaction — `update` cannot carry the edge — so the
 * transaction moves here rather than the check being copied a fourth time.
 * `BestiaryScreen` was byte-for-byte the same transaction minus one line.
 *
 * Two behaviours that were not uniform across the four and now are:
 *
 * - **`sortOrder` is `max(existing) + 1`, not `length + 1`.** After a mid-list
 *   removal, `length + 1` reuses a live key — add P1/P2/P3, remove P2, and the
 *   next add collides with P3. Two callers had the fix and the bestiary did not.
 * - **A PC cannot appear twice; a creature template deliberately can.** The GM
 *   adds three goblins from one template on purpose, but "Astrid" twice is
 *   always a mis-click. Deduplication is by the existing `represents` edges of
 *   the participants already in the encounter, read inside the transaction.
 *
 * @param encounterId - Encounter to append to.
 * @param additions - Participants to add, in order.
 * @returns The ids of the participants actually added; `[]` if the encounter is
 * soft-deleted or every addition was a duplicate PC.
 * @throws If the encounter does not exist, or the write fails.
 */
export async function addRepresentedParticipants(
  encounterId: string,
  additions: ParticipantToAdd[],
): Promise<string[]> {
  if (additions.length === 0) return [];
  const now = nowISO();
  return db.transaction('rw', [db.encounters, db.entityLinks], async () => {
    const enc = await db.encounters.get(encounterId);
    if (!enc) {
      throw new Error(
        `encounterRepository.addRepresentedParticipants: encounter ${encounterId} not found`,
      );
    }
    // The line the other three were missing.
    if ((enc as Encounter).deletedAt) return [];

    const existing = [...((enc as Encounter).participants ?? [])];
    const existingIds = existing.map((p) => p.id);
    const alreadyRepresented = new Set(
      existingIds.length === 0
        ? []
        : (await entityLinkRepository.getLinksFromMany(existingIds, 'represents'))
            .filter((link) => link.toEntityType === 'character')
            .map((link) => link.toEntityId),
    );

    const addedIds: string[] = [];
    for (const addition of additions) {
      if (
        addition.represents.type === 'character'
        && alreadyRepresented.has(addition.represents.id)
      ) {
        continue;
      }
      const participantId = generateId();
      existing.push({
        id: participantId,
        name: addition.name,
        type: addition.type,
        instanceState: addition.instanceState ?? {},
        sortOrder: Math.max(0, ...existing.map((p) => p.sortOrder)) + 1,
      });
      await entityLinkRepository.createLink({
        fromEntityId: participantId,
        fromEntityType: 'encounterParticipant',
        toEntityId: addition.represents.id,
        toEntityType: addition.represents.type,
        relationshipType: 'represents',
      });
      if (addition.represents.type === 'character') {
        alreadyRepresented.add(addition.represents.id);
      }
      addedIds.push(participantId);
    }

    if (addedIds.length > 0) {
      await db.encounters.update(encounterId, { participants: existing, updatedAt: now });
    }
    return addedIds;
  });
}

/**
 * Removes a participant and soft-deletes its outgoing edges under one cascade id.
 *
 * @remarks
 * The mirror of {@link addRepresentedParticipants}, and here for the same
 * reason: the removal has to tombstone the participant's `represents` edges in
 * the same transaction that drops it from the list, or a restore brings back a
 * participant with no identity. The shared `softDeletedBy` is what makes the
 * removal restorable as a unit.
 *
 * @returns `true` if a participant was removed.
 */
export async function removeRepresentedParticipant(
  encounterId: string,
  participantId: string,
): Promise<boolean> {
  const txId = generateSoftDeleteTxId();
  const now = nowISO();
  return db.transaction('rw', [db.encounters, db.entityLinks], async () => {
    const enc = await db.encounters.get(encounterId);
    if (!enc || (enc as Encounter).deletedAt || !(enc as Encounter).participants) return false;
    const participants = (enc as Encounter).participants;
    if (!participants.some((p) => p.id === participantId)) return false;
    await db.encounters.update(encounterId, {
      participants: participants.filter((p) => p.id !== participantId),
      updatedAt: now,
    });
    await entityLinkRepository.softDeleteLinksFromEntity(participantId, 'represents', txId, now);
    return true;
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
    throw new Error(`encounterRepository.getActiveEncounterForSession failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.getRecentEndedEncountersForSession failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.pushSegment failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.endActiveSegment failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.reopenEncounter failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.softDelete failed: ${e}`, { cause: e });
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
    throw new Error(`encounterRepository.restore failed: ${e}`, { cause: e });
  }
}

/** Permanently removes an encounter row. Internal only — never called from UI, which soft-deletes. */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.encounters.delete(id);
  } catch (e) {
    throw new Error(`encounterRepository.hardDelete failed: ${e}`, { cause: e });
  }
}
