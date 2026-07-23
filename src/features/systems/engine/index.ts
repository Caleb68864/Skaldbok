import type { SystemDefinition } from '../../../types/system';
import { useSystemDefinition } from '../useSystemDefinition';
import { useActiveCharacter } from '../../../context/ActiveCharacterContext';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerEngine } from './travellerEngine';
import type { SystemEngine } from './types';

export type { SystemEngine, PanelKey, SystemTerms, SystemLabels, SkillDisplayContext } from './types';
export { classicFantasyEngine } from './classicFantasyEngine';
export { travellerEngine } from './travellerEngine';

/** Base adapter for a system id, before any system.json overrides are applied. */
function baseEngineFor(system: SystemDefinition | undefined | null): SystemEngine {
  if (!system) return classicFantasyEngine;
  if (system.id === 'traveller') return travellerEngine;
  return classicFantasyEngine;
}

/**
 * Memo cache so `getEngine` returns a stable object identity per system.
 *
 * @remarks
 * Consumers call this during render; returning a fresh object each time would
 * defeat memoisation downstream. Keyed by system id + version so editing a
 * system definition picks up new labels.
 */
const engineCache = new Map<string, SystemEngine>();

/**
 * Resolves the SystemEngine adapter for a given system definition.
 *
 * @remarks
 * `terms` and `labels` declared in the system's JSON override the adapter's
 * defaults, so a user-authored ruleset can rename user-facing vocabulary (for
 * example the abilities/magic tab) without touching code. Setting
 * `labels.abilitiesScreen` to `null` hides that tab entirely.
 */
export function getEngine(system: SystemDefinition | undefined | null): SystemEngine {
  const base = baseEngineFor(system);
  if (!system || (!system.terms && !system.labels)) return base;

  const key = `${system.id}@${system.version}`;
  const cached = engineCache.get(key);
  if (cached) return cached;

  const merged: SystemEngine = {
    ...base,
    terms: { ...base.terms, ...system.terms },
    labels: { ...base.labels, ...system.labels },
  };
  engineCache.set(key, merged);
  return merged;
}

/** Resolves the SystemEngine for the currently active character's system. */
export function useSystemEngine(): SystemEngine {
  const { character } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'classic-fantasy');
  return getEngine(system);
}
