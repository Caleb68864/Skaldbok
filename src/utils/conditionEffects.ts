import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

/**
 * Whether an active condition imposes a bane on a skill linked to
 * `linkedAttributeId`.
 *
 * @remarks
 * The rule is pure system data: a condition declares a `linkedAttributeId`, and
 * while that condition is active, skills linked to the same attribute roll at a
 * bane (Dragonbane's condition model). A system whose conditions declare no
 * linked attribute — or a skill with no linked attribute — simply gets `false`.
 * Shared by the Sheet's Skills screen and the Play SkillModule so both surfaces
 * show the same condition-adjusted odds (previously only the Sheet did). E6/E16.
 */
export function conditionImposesBane(
  system: SystemDefinition | null | undefined,
  character: CharacterRecord | null | undefined,
  linkedAttributeId: string | undefined,
): boolean {
  if (!system || !character || !linkedAttributeId) return false;
  return system.conditions.some(
    c => character.conditions[c.id] && c.linkedAttributeId === linkedAttributeId,
  );
}
