import type { CharacterRecord, CustomSkillDefinition } from '../../types/character';
import type { SkillCategory, SystemDefinition } from '../../types/system';

/** Category that holds custom skills whose own category no longer exists. */
export const ORPHAN_CUSTOM_CATEGORY_ID = 'customSkills';

/**
 * The skill categories a character actually has: the system's, with the
 * character's own custom skills merged in.
 *
 * @remarks
 * Traveller's Language, Profession, Art and Science are open-ended — the book
 * prints some specialities and expects the table to invent the rest. Before
 * this, a skill the definition did not declare was invisible: `SkillsScreen`
 * and the play dashboard both iterate `system.skillCategories` and never saw it,
 * and the printed sheet showed it only as a raw id in one of six "secondary"
 * slots. Merging here means every one of those surfaces treats a custom skill
 * exactly like a declared one, without any of them knowing custom skills exist.
 *
 * Custom skills append *after* the declared ones within their category, so the
 * book's own order is never disturbed.
 *
 * A custom skill whose `categoryId` matches nothing — a system edited or
 * swapped underneath the character — is not dropped. It lands in a trailing
 * "Custom" category instead, because a skill the user cannot see is one they
 * cannot delete or re-file either.
 *
 * Returns the system's own array unchanged when the character has no custom
 * skills, so the overwhelmingly common case allocates nothing.
 */
export function resolveSkillCategories(
  system: SystemDefinition | null | undefined,
  character: Pick<CharacterRecord, 'customSkills'> | null | undefined,
): SkillCategory[] {
  const declared = system?.skillCategories ?? [];
  const custom = character?.customSkills ?? [];
  if (custom.length === 0) return declared;

  const known = new Set(declared.map(category => category.id));

  const merged = declared.map(category => {
    const extra = custom.filter(skill => skill.categoryId === category.id);
    if (extra.length === 0) return category;
    return { ...category, skills: [...category.skills, ...extra.map(toSkillDefinition)] };
  });

  const orphans = custom.filter(skill => !known.has(skill.categoryId));
  if (orphans.length === 0) return merged;

  return [
    ...merged,
    { id: ORPHAN_CUSTOM_CATEGORY_ID, name: 'Custom', skills: orphans.map(toSkillDefinition) },
  ];
}

/**
 * Widens a custom skill to the shape every skill consumer expects.
 *
 * @remarks
 * `baseChance` is 0 because it means nothing outside roll-under systems, and a
 * custom skill in a roll-under system is authored with an explicit level
 * anyway. `categoryId` is dropped — it is placement metadata, and leaving it on
 * the definition would invite a consumer to branch on "is this custom?", which
 * is exactly what merging exists to prevent.
 */
function toSkillDefinition(skill: CustomSkillDefinition) {
  return {
    id: skill.id,
    name: skill.name,
    baseChance: 0,
    linkedAttributeId: skill.linkedAttributeId,
    groupId: skill.groupId,
  };
}

/** True when `id` belongs to a skill the character authored. */
export function isCustomSkill(character: Pick<CharacterRecord, 'customSkills'>, id: string): boolean {
  return (character.customSkills ?? []).some(skill => skill.id === id);
}

/**
 * Removes a custom skill's definition *and* its stored value.
 *
 * @remarks
 * Both, or the value is orphaned: it would survive in `skills` under an id no
 * category declares, which is the invisible state this whole feature exists to
 * end. Returns a patch, so the caller hands it straight to `updateCharacter`.
 */
export function removeCustomSkill(
  character: Pick<CharacterRecord, 'customSkills' | 'skills'>,
  id: string,
): Pick<CharacterRecord, 'customSkills' | 'skills'> {
  const skills = { ...character.skills };
  delete skills[id];
  return {
    customSkills: (character.customSkills ?? []).filter(skill => skill.id !== id),
    skills,
  };
}

/**
 * Whether `name` is free for a new custom skill on this character.
 *
 * @remarks
 * Compared case-insensitively against declared *and* custom names. Two rows
 * reading "Language (Zhodani)" with different ids is a trap — the player edits
 * one and the other keeps its old value, silently.
 */
export function isSkillNameAvailable(
  system: SystemDefinition | null | undefined,
  character: Pick<CharacterRecord, 'customSkills'> | null | undefined,
  name: string,
): boolean {
  const candidate = name.trim().toLowerCase();
  if (candidate.length === 0) return false;
  return !resolveSkillCategories(system, character)
    .flatMap(category => category.skills)
    .some(skill => skill.name.trim().toLowerCase() === candidate);
}
