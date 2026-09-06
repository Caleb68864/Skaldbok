import type { Spell } from '../types/character';

/**
 * Whether a spell is a rank-0 magic trick.
 *
 * @remarks
 * Tricks are identified either by an explicit `powerLevel` of 0 or by the
 * school being one this system calls a trick school, so user-authored data that
 * only sets one of the two is still classified correctly.
 *
 * `trickSchools` comes from `engine.magic.trickSchools`. Without it the test was
 * `school.includes('trick')` — a naming convention in the bundled content
 * treated as a rule, so a system whose cantrips are called something else got
 * none of the trick handling.
 */
export function isMagicTrick(spell: Spell, trickSchools?: string[]): boolean {
  if (spell.powerLevel === 0) return true;
  const school = spell.school.toLowerCase();
  // With no declared list this falls back to the old substring test, so
  // user-authored data that never named its trick schools still classifies.
  if (!trickSchools) return school.includes('trick');
  return trickSchools.some(name => school.includes(name.toLowerCase()));
}

/** The spell's rank for sorting/grouping: 0 for tricks, else its explicit `rank`, falling back to `powerLevel`. */
export function getSpellRank(spell: Spell): number {
  if (isMagicTrick(spell)) return 0;
  return spell.rank ?? spell.powerLevel ?? 1;
}

/** Comparator that orders spells by rank ascending, then case-insensitively by name. */
export function compareSpellsByRankThenName(a: Spell, b: Spell): number {
  const rankDiff = getSpellRank(a) - getSpellRank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

/** Formats a casting time for display, capitalised and defaulting to "Action" when unset. */
export function formatCastingTime(castingTime?: Spell['castingTime']): string {
  if (!castingTime) return 'Action';
  return castingTime.charAt(0).toUpperCase() + castingTime.slice(1);
}

/** Joins a spell's requirement list into a comma-separated string, dropping empties. */
export function formatRequirements(requirements?: string[]): string {
  return requirements?.filter(Boolean).join(', ') ?? '';
}
