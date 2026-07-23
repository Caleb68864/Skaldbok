import type { SystemDefinition } from '../../../types/system';
import { useSystemDefinition } from '../useSystemDefinition';
import { useActiveCharacter } from '../../../context/ActiveCharacterContext';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerEngine } from './travellerEngine';
import type { SystemEngine } from './types';

export type { SystemEngine, PanelKey } from './types';
export { classicFantasyEngine } from './classicFantasyEngine';
export { travellerEngine } from './travellerEngine';

/** Resolves the SystemEngine adapter for a given system definition (or id). */
export function getEngine(system: SystemDefinition | undefined | null): SystemEngine {
  if (!system) return classicFantasyEngine;
  if (system.id === 'traveller') return travellerEngine;
  return classicFantasyEngine;
}

/** Resolves the SystemEngine for the currently active character's system. */
export function useSystemEngine(): SystemEngine {
  const { character } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  return getEngine(system);
}
