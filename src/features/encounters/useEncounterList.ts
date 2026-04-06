import { useState, useEffect, useCallback } from 'react';
import type { Encounter } from '../../types/encounter';
import { listBySession } from '../../storage/repositories/encounterRepository';

/**
 * Hook for listing encounters within a session and tracking the active encounter.
 *
 * @param sessionId - The session whose encounters to load.
 */
export function useEncounterList(sessionId: string | null) {
  const [encounters, setEncounters] = useState<Encounter[]>([]);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setEncounters([]);
      return;
    }
    const results = await listBySession(sessionId);
    setEncounters(results);
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeEncounter = encounters.find((e) => e.status === 'active') ?? null;

  return { encounters, activeEncounter, refresh };
}
