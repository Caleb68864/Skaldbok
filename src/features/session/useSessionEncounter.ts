import { useCallback, useEffect, useState } from 'react';
import { db } from '../../storage/db/client';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import type { Encounter } from '../../types/encounter';

export interface StartEncounterInput {
  title: string;
  type: 'combat' | 'social' | 'exploration';
  description?: unknown; // ProseMirror JSON
  tags?: string[];
  location?: string;
  /**
   * Parent encounter override for the auto-generated happened_during edge.
   * - `undefined` (or omitted): auto-link to the currently-active encounter (if any)
   * - `null`: do NOT create a happened_during edge even if one is active
   * - specific id: use that id as the parent
   */
  parentOverride?: string | null;
}

export interface UseSessionEncounterResult {
  activeEncounter: Encounter | null;
  recentEnded: Encounter[];
  loading: boolean;
  startEncounter: (input: StartEncounterInput) => Promise<Encounter>;
  endEncounter: (id: string, summary?: unknown) => Promise<void>;
  reopenEncounter: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const VALID_TYPES = new Set(['combat', 'social', 'exploration']);

export function useSessionEncounter(sessionId: string): UseSessionEncounterResult {
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [recentEnded, setRecentEnded] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [active, ended] = await Promise.all([
        encounterRepository.getActiveEncounterForSession(sessionId),
        encounterRepository.getRecentEndedEncountersForSession(sessionId, 3),
      ]);
      setActiveEncounter(active);
      setRecentEnded(ended);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startEncounter = useCallback(
    async (input: StartEncounterInput): Promise<Encounter> => {
      // Validate input eagerly
      if (!input.title || input.title.trim().length === 0) {
        throw new Error('useSessionEncounter.startEncounter: title is required');
      }
      if (!VALID_TYPES.has(input.type)) {
        throw new Error(
          `useSessionEncounter.startEncounter: type must be combat|social|exploration (got: ${input.type})`,
        );
      }
      if (!sessionId) {
        throw new Error('useSessionEncounter.startEncounter: sessionId is required');
      }

      // Load the session's campaignId (needed for the new encounter row)
      const session = await db.sessions.get(sessionId);
      if (!session) {
        throw new Error(`useSessionEncounter.startEncounter: session ${sessionId} not found`);
      }

      let createdEncounter: Encounter | null = null;

      await db.transaction('rw', [db.encounters, db.entityLinks, db.sessions], async () => {
        // Re-read active encounter INSIDE the transaction to win last-writer races
        const priorActive = await encounterRepository.getActiveEncounterForSession(sessionId);

        // Auto-end any prior active
        if (priorActive) {
          await encounterRepository.endActiveSegment(priorActive.id);
        }

        // Create the new encounter with one open segment
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

        // Decide parent linkage
        let parentId: string | null = null;
        if (input.parentOverride === null) {
          parentId = null; // explicit opt-out
        } else if (input.parentOverride !== undefined) {
          parentId = input.parentOverride;
        } else if (priorActive) {
          parentId = priorActive.id; // auto
        }

        if (parentId) {
          await entityLinkRepository.createLink({
            fromEntityId: newId,
            fromEntityType: 'encounter',
            toEntityId: parentId,
            toEntityType: 'encounter',
            relationshipType: 'happened_during',
          });
        }

        createdEncounter = newEncounter;
      });

      await refresh();
      if (!createdEncounter) {
        throw new Error(
          'useSessionEncounter.startEncounter: transaction completed without setting created encounter',
        );
      }
      return createdEncounter;
    },
    [sessionId, refresh],
  );

  const endEncounter = useCallback(
    async (id: string, summary?: unknown): Promise<void> => {
      const existing = await db.encounters.get(id);
      if (!existing) {
        throw new Error(`useSessionEncounter.endEncounter: encounter ${id} not found`);
      }

      await db.transaction('rw', [db.encounters], async () => {
        await encounterRepository.endActiveSegment(id);
        const updates: Partial<Encounter> = {
          status: 'ended',
          updatedAt: nowISO(),
        };
        if (summary !== undefined) updates.summary = summary;
        await db.encounters.update(id, updates);
      });

      await refresh();
    },
    [refresh],
  );

  const reopenEncounter = useCallback(
    async (id: string): Promise<void> => {
      await encounterRepository.reopenEncounter(sessionId, id);
      await refresh();
    },
    [sessionId, refresh],
  );

  return {
    activeEncounter,
    recentEnded,
    loading,
    startEncounter,
    endEncounter,
    reopenEncounter,
    refresh,
  };
}
