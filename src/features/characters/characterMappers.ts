import type { CharacterRecord } from '../../types/character';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import blankTemplate from '../../../sample-data/classic-fantasy.blank.character.json';
import travellerBlankTemplate from '../../../sample-data/traveller.blank.character.json';
import savageWorldsBlankTemplate from '../../../sample-data/savage-worlds.blank.character.json';

/**
 * Blank-character templates by system id.
 *
 * @remarks
 * A map rather than a `systemId === 'traveller'` branch so an unknown system
 * fails loudly (see below) instead of silently handing back a Dragonbane sheet.
 */
const BLANK_TEMPLATES: Record<string, unknown> = {
  'classic-fantasy': blankTemplate,
  traveller: travellerBlankTemplate,
  'savage-worlds': savageWorldsBlankTemplate,
};

/**
 * Whether a bundled blank template exists for `systemId`.
 *
 * @remarks
 * `BLANK_TEMPLATES` is a third hand-maintained list of system ids, next to
 * `registry.ts` and `baseEngineFor`. `characterMappers.test.ts` asserts every
 * registered system answers true here, so a system added to the registry
 * without a template fails the build instead of silently minting Dragonbane
 * characters.
 */
export function hasBlankTemplate(systemId: string): boolean {
  return systemId in BLANK_TEMPLATES;
}

/**
 * Builds a fresh blank character for a system from its bundled template.
 *
 * @remarks
 * The template JSON is a module singleton shared across every call, so it is
 * deep-cloned to keep nested objects (attributes, resources, weapons, inventory,
 * systemData) from being aliased across characters. An unrecognised system id
 * falls back to the classic-fantasy template.
 */
export function createBlankCharacter(systemId: string): CharacterRecord {
  const template = BLANK_TEMPLATES[systemId] ?? blankTemplate;
  // Deep clone: the imported JSON is a module singleton shared by every call.
  // A shallow spread would alias its nested objects (attributes, resources,
  // weapons, inventory, systemData) across every character created — an
  // in-place mutation on one would corrupt the others and the template itself.
  const cloned = structuredClone(template) as CharacterRecord;
  return {
    ...cloned,
    id: generateId(),
    systemId,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}
