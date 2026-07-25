import systemData from './system.json';
import type { SystemDefinition } from '../../types/system';

/**
 * The bundled Savage Worlds (SWADE) ruleset, loaded from `system.json`.
 *
 * @remarks
 * The third bundled system, and the one that forces the engine's trait-die,
 * level-wound and live-condition generalisations. Registered in
 * `systems/registry.ts` and paired with the `savageWorldsEngine` adapter. Bump
 * the JSON's `version` when editing it so the cached copy in IndexedDB refreshes.
 */
export const savageWorldsSystem: SystemDefinition = systemData as SystemDefinition;

export * from './savageMath';
