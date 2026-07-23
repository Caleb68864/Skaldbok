import { useState, useEffect } from 'react';
import * as systemRepository from '../../storage/repositories/systemRepository';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import type { SystemDefinition } from '../../types/system';

/** The bundled definition for an id, if this build ships one. */
function bundledSystem(systemId: string): SystemDefinition | undefined {
  return BUNDLED_SYSTEMS.find(s => s.id === systemId);
}

/**
 * Loads a {@link SystemDefinition}, preferring the stored copy but refreshing it
 * when this build ships a newer one.
 *
 * @remarks
 * System definitions are cached in IndexedDB so user-authored systems persist.
 * That previously meant an edit to a bundled `system.json` could never reach an
 * existing user — the stale stored copy won every time. Comparing `version`
 * lets a release ship new system data (skills, labels, identity fields) and
 * have it actually apply. **Bump the definition's `version` whenever you edit a
 * bundled `system.json`.**
 *
 * Systems this build does not bundle (user-authored) are always served from
 * storage untouched.
 */
export function useSystemDefinition(systemId: string) {
  const [system, setSystem] = useState<SystemDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    systemRepository.getById(systemId).then(async stored => {
      if (!mounted) return;
      const bundled = bundledSystem(systemId);

      if (bundled && (!stored || (stored.version ?? 0) < bundled.version)) {
        await systemRepository.save(bundled);
        if (!mounted) return;
        setSystem(bundled);
      } else if (stored) {
        setSystem(stored);
      } else {
        setError(`Unknown system: ${systemId}`);
      }
      setIsLoading(false);
    }).catch(err => {
      if (mounted) {
        setError(String(err));
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [systemId]);

  return { system, isLoading, error };
}
