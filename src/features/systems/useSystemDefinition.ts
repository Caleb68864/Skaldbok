import { useState, useEffect } from 'react';
import * as systemRepository from '../../storage/repositories/systemRepository';
import { dragonbaneSystem } from '../../systems/dragonbane';
import type { SystemDefinition } from '../../types/system';

export function useSystemDefinition(systemId: string) {
  const [system, setSystem] = useState<SystemDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    systemRepository.getById(systemId).then(async stored => {
      if (!mounted) return;
      if (stored) {
        setSystem(stored);
      } else if (systemId === 'dragonbane') {
        await systemRepository.save(dragonbaneSystem);
        setSystem(dragonbaneSystem);
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
