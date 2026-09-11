import { useCallback, useEffect, useMemo, useState } from 'react';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import type { Encounter } from '../../types/encounter';

// `StartEncounterInput` moved to `encounterRepository` with the transaction it
// describes, and is re-exported here so the screens that import it from this
// hook keep working.
export type { StartEncounterInput } from '../../storage/repositories/encounterRepository';
import type { StartEncounterInput } from '../../storage/repositories/encounterRepository';

/** State and actions returned by {@link useSessionEncounter}. */
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

/**
 * Manages the lifecycle of encounters within one session: the active encounter,
 * recently ended ones, and start/end/reopen actions.
 *
 * @remarks
 * At most one encounter is active per session — that invariant is phrased over
 * non-deleted rows, matching the soft-delete convention. Starting an encounter
 * records a `happened_during` entity-link to the previously active encounter so the
 * timeline can nest them; {@link StartEncounterInput.parentOverride} tunes or
 * suppresses that link. All reads go through the encounter repository, so
 * soft-deleted encounters never surface.
 */
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

      // The session lookup, the three-table transaction, the encounter row
      // and its `happened_during` edge all moved into
      // `encounterRepository.startForSession`. The transaction did not go away
      // and should not: closing the prior active encounter's segment has to
      // commit with the new one or the one-active-encounter invariant is
      // briefly false. It moved to the side of the boundary that owns it.
      const created = await encounterRepository.startForSession(sessionId, input);
      await refresh();
      return created;
    },
    [sessionId, refresh],
  );

  const endEncounter = useCallback(
    async (id: string, summary?: unknown): Promise<void> => {
      // Was a bare `db.encounters.get(id)` that checked existence and not
      // `deletedAt`, then wrote the user's wrap-up prose into whatever it got
      // back. Of the four tombstone-blind writes this is the one that loses
      // text a person typed, so the repository throws rather than returning
      // undefined — a dialog must not silently swallow what it was given.
      await encounterRepository.endWithSummary(id, summary);
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

  // Memoised because this object *is* a context value: `SessionEncounterProvider`
  // passes it straight to `.Provider value={…}`. Returned as a fresh literal it
  // handed every consumer a new identity on each provider render, which is the
  // defect `context/providerMemoization.test.tsx` exists to catch — it was
  // simply one level further down than that file was looking.
  return useMemo(
    () => ({
      activeEncounter,
      recentEnded,
      loading,
      startEncounter,
      endEncounter,
      reopenEncounter,
      refresh,
    }),
    [activeEncounter, recentEnded, loading, startEncounter, endEncounter, reopenEncounter, refresh],
  );
}
