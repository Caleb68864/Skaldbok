import systemData from './system.json';
import type { SystemDefinition } from '../../types/system';

/**
 * The bundled Dragonbane-like ruleset, loaded from `system.json`.
 *
 * @remarks
 * The definition is pure data — fields, skills, abilities, and resources — so
 * most content changes are a JSON edit, not a code change. Bump the JSON's
 * `version` when editing it, or the cached copy in IndexedDB will shadow the
 * change for anyone who has already run the app.
 */
export const classicFantasySystem: SystemDefinition = systemData as SystemDefinition;
