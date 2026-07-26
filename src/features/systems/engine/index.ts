import type { SystemDefinition } from '../../../types/system';
import { useSystemDefinition } from '../useSystemDefinition';
import { useActiveCharacter } from '../../../context/ActiveCharacterContext';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerEngine } from './travellerEngine';
import { savageWorldsEngine } from './savageWorldsEngine';
import type { SystemEngine } from './types';

export type { SystemEngine, PanelKey, SystemTerms, SystemLabels, SkillDisplayContext } from './types';
export { classicFantasyEngine } from './classicFantasyEngine';
export { travellerEngine } from './travellerEngine';
export { savageWorldsEngine } from './savageWorldsEngine';

/** Base adapter for a system id, before any system.json overrides are applied. */
function baseEngineFor(system: SystemDefinition | undefined | null): SystemEngine {
  if (!system) return classicFantasyEngine;
  if (system.id === 'traveller') return travellerEngine;
  if (system.id === 'savage-worlds') return savageWorldsEngine;
  // classic-fantasy is the fail-safe default. A registered-but-unmapped id
  // (a system with a definition but no adapter yet) reaching this fallback is a
  // wiring gap, so surface it in dev instead of silently rendering as Dragonbane.
  if (import.meta.env.DEV && system.id !== 'classic-fantasy') {
    console.warn(`getEngine: no adapter for system "${system.id}", defaulting to classic-fantasy`);
  }
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
  if (!system) return base;

  const key = `${system.id}@${system.version}`;
  const cached = engineCache.get(key);
  if (cached) return cached;

  const merged: SystemEngine = {
    ...base,
    // Derive attributeIds from the definition so adding/renaming a characteristic
    // in system.json fully wires it (DM badge, characteristic grid, modifier
    // targets) without also editing the adapter's hardcoded array.
    // engineContract.test.ts pins engine.attributeIds === system.attributes ids
    // in order for every bundled system. resourceIds is deliberately NOT derived:
    // an adapter may expose a subset (Dragonbane omits the deathRolls/
    // deathSuccesses death-track counters that its system.json still declares).
    attributeIds: system.attributes.map(a => a.id),
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

/**
 * Resolves the SystemEngine for an explicit system id.
 *
 * @remarks
 * Session-layer screens are scoped to a *campaign*, not to whichever character
 * happens to be active — a GM running a Traveller game may have no active
 * character at all, or one from another campaign. Those screens pass the
 * campaign's system id here rather than using {@link useSystemEngine}.
 */
export function useSystemEngineFor(systemId: string | undefined | null): SystemEngine {
  const { system } = useSystemDefinition(systemId ?? 'classic-fantasy');
  return getEngine(system);
}
