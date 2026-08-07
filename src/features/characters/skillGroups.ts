import type { CharacterSkill } from '../../types/character';
import type { SkillCategory, SkillDefinition, SkillGroupDefinition } from '../../types/system';

/** Every skill belonging to `groupId`, in definition order. */
export function groupMembers(categories: SkillCategory[], groupId: string): SkillDefinition[] {
  return categories.flatMap(category => category.skills.filter(skill => skill.groupId === groupId));
}

/** The group a skill belongs to, or `undefined` for a standalone skill. */
export function groupFor(
  groups: SkillGroupDefinition[] | undefined,
  skill: SkillDefinition,
): SkillGroupDefinition | undefined {
  if (!skill.groupId) return undefined;
  return groups?.find(group => group.id === skill.groupId);
}

/**
 * Adds the level-0 baseline a Traveller speciality group grants, without
 * touching any speciality the character already has.
 *
 * @remarks
 * Gaining a specialised skill at level 0 gives level 0 in *every* speciality of
 * that group; levels 1+ apply to one. Entered by hand that is five near-identical
 * rows per group, and the app's own skill list is where the omissions show up as
 * a -3 unskilled DM the character should not be taking.
 *
 * Deliberately additive. Members that already have an entry are returned
 * untouched, so pressing this can never overwrite a level, clear a trained flag,
 * or undo a mark — the action is safe to press twice and safe to press on a
 * finished character. That also makes it idempotent.
 *
 * Returns a whole new skills bag rather than a patch so the caller can hand it
 * straight to `updateCharacter`, and returns the *same* bag when nothing changed
 * so a caller can skip a pointless save.
 */
export function trainGroupAtZero(
  characterSkills: Record<string, CharacterSkill>,
  members: SkillDefinition[],
): Record<string, CharacterSkill> {
  const missing = members.filter(member => !characterSkills[member.id]);
  if (missing.length === 0) return characterSkills;

  const next = { ...characterSkills };
  for (const member of missing) {
    next[member.id] = { value: 0, trained: true };
  }
  return next;
}

/**
 * Whether every speciality in the group already has an entry.
 *
 * @remarks
 * Drives the disabled state of the group action. Asks only whether an entry
 * *exists*, matching what {@link trainGroupAtZero} would actually do — a member
 * stored as untrained-at-0 still counts, because the action would not change it
 * and offering a button that does nothing is worse than greying it out.
 */
export function groupHasEveryMember(
  characterSkills: Record<string, CharacterSkill>,
  members: SkillDefinition[],
): boolean {
  return members.length > 0 && members.every(member => !!characterSkills[member.id]);
}
