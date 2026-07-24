import type { Spell } from '../types/character';

/**
 * Whether a spell is a rank-0 magic trick.
 *
 * @remarks
 * Tricks are identified either by an explicit `powerLevel` of 0 or by "trick"
 * appearing in the school name, so user-authored data that only sets one of the
 * two is still classified correctly.
 */
export function isMagicTrick(spell: Spell): boolean {
  return spell.powerLevel === 0 || spell.school.toLowerCase().includes('trick');
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
