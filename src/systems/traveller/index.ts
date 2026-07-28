import systemData from './system.json';
import type { SystemDefinition } from '../../types/system';

/**
 * The bundled Traveller ruleset, loaded from `system.json`.
 *
 * @remarks
 * Sibling to
 * {@link systems/classic-fantasy!classicFantasySystem | classicFantasySystem};
 * registered in `systems/registry.ts` and paired with the
 * {@link features/systems/engine/travellerEngine!travellerEngine | travellerEngine}
 * adapter for its 2d6-plus
 * behaviour. Bump the JSON's `version` when editing it so the cached copy in
 * IndexedDB refreshes.
 */
export const travellerSystem: SystemDefinition = systemData as SystemDefinition;

export * from './travellerMath';
