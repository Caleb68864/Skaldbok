import type { CharacterRecord, CharacterSkill } from '../../types/character';
import type { SkillCategory } from '../../types/system';
import type { AdvancementModel } from '../systems/engine/types';

/** One marked skill, ready to be rolled for. */
export interface AdvancementCandidate {
  id: string;
  name: string;
  /** The skill's current value — what the advancement roll is made against. */
  value: number;
  /** True when the skill is already at the system's ceiling and cannot rise. */
  atCeiling: boolean;
  /** System-authored copy describing the roll, from `advancement.rollPrompt`. */
  prompt: string;
}

/**
 * Whether a skill carries an advancement mark.
 *
 * @remarks
 * **Either** mark counts. The app tracks a dragon (critical success) and a demon
 * (critical failure) as distinct states because they mean different things at
 * the moment they happen, but Dragonbane marks a skill for advancement on both —
 * you learn from a triumph and from a disaster alike. `AdvancementModel` speaks
 * of "marks" generically for the same reason.
 *
 * If a table plays it as dragons only, this predicate is the one place to say so.
 */
export function isMarkedForAdvancement(skill: CharacterSkill | undefined): boolean {
  return !!skill && (skill.dragonMarked === true || skill.demonMarked === true);
}

/**
 * The marked skills an end-of-session advancement roll applies to.
 *
 * @remarks
 * Empty when the system's advancement is not mark-driven (`usesMarks: false`),
 * so a ruleset that advances some other way gets the session checklist without a
 * roll list it has no use for.
 *
 * Takes resolved categories rather than the system definition, so a
 * player-authored custom skill can be marked and advanced like any other — see
 * `resolveSkillCategories`.
 */
export function advancementCandidates(
  categories: SkillCategory[],
  character: Pick<CharacterRecord, 'skills'>,
  advancement: AdvancementModel | null | undefined,
): AdvancementCandidate[] {
  if (!advancement?.usesMarks) return [];

  return categories
    .flatMap(category => category.skills)
    .filter(skill => isMarkedForAdvancement(character.skills?.[skill.id]))
    .map(skill => {
      const value = character.skills?.[skill.id]?.value ?? 0;
      return {
        id: skill.id,
        name: skill.name,
        value,
        atCeiling: value >= advancement.maxSkillValue,
        prompt: advancement.rollPrompt(value),
      };
    });
}

/** How many session-checklist boxes are ticked. */
export function countEarnedMarks(
  character: Pick<CharacterRecord, 'advancementChecks'>,
  advancement: AdvancementModel | null | undefined,
): number {
  const checks = character.advancementChecks ?? {};
  return (advancement?.sessionEvents ?? []).filter(event => checks[event.id] === true).length;
}

/** Ticks or unticks one session-checklist box. */
export function toggleSessionEvent(
  character: Pick<CharacterRecord, 'advancementChecks'>,
  eventId: string,
): Pick<CharacterRecord, 'advancementChecks'> {
  const checks = { ...(character.advancementChecks ?? {}) };
  if (checks[eventId]) delete checks[eventId];
  else checks[eventId] = true;
  return { advancementChecks: checks };
}

/**
 * Applies a successful advancement roll: the skill rises by one and its mark
 * clears.
 *
 * @remarks
 * Capped at `advancement.maxSkillValue`. A skill already at the ceiling keeps
 * its value and still loses the mark — the roll happened, it simply cannot
 * raise the skill further, and leaving the mark would offer the same dead roll
 * again next session.
 *
 * Returns `null` when the skill has no mark, so a double-tap or a stale render
 * cannot advance a skill twice.
 */
export function applyAdvance(
  character: Pick<CharacterRecord, 'skills'>,
  skillId: string,
  advancement: AdvancementModel,
): Pick<CharacterRecord, 'skills'> | null {
  const existing = character.skills?.[skillId];
  if (!isMarkedForAdvancement(existing)) return null;

  const value = Math.min((existing?.value ?? 0) + 1, advancement.maxSkillValue);
  return {
    skills: {
      ...character.skills,
      [skillId]: { ...existing!, value, dragonMarked: false, demonMarked: false },
    },
  };
}

/**
 * Clears a skill's mark without changing its value — a failed advancement roll.
 *
 * @remarks
 * Returns `null` when there is no mark to clear, so the caller can skip a write
 * that would only bump `updatedAt`.
 */
export function clearMark(
  character: Pick<CharacterRecord, 'skills'>,
  skillId: string,
): Pick<CharacterRecord, 'skills'> | null {
  const existing = character.skills?.[skillId];
  if (!isMarkedForAdvancement(existing)) return null;

  return {
    skills: {
      ...character.skills,
      [skillId]: { ...existing!, dragonMarked: false, demonMarked: false },
    },
  };
}

/**
 * Empties the session checklist, ready for the next session.
 *
 * @remarks
 * Separate from resolving the marks on purpose: the checklist earns marks that
 * the player then spends on the Skills screen, and clearing it is what ends the
 * session's accounting. Returns `null` when it is already empty.
 */
export function resetAdvancementChecks(
  character: Pick<CharacterRecord, 'advancementChecks'>,
): Pick<CharacterRecord, 'advancementChecks'> | null {
  const checks = character.advancementChecks ?? {};
  if (Object.keys(checks).length === 0) return null;
  return { advancementChecks: {} };
}
