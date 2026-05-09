import type { Spell } from '../types/character';

export function isMagicTrick(spell: Spell): boolean {
  return spell.powerLevel === 0 || spell.school.toLowerCase().includes('trick');
}

export function getSpellRank(spell: Spell): number {
  if (isMagicTrick(spell)) return 0;
  return spell.rank ?? spell.powerLevel ?? 1;
}

export function compareSpellsByRankThenName(a: Spell, b: Spell): number {
  const rankDiff = getSpellRank(a) - getSpellRank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function formatCastingTime(castingTime?: Spell['castingTime']): string {
  if (!castingTime) return 'Action';
  return castingTime.charAt(0).toUpperCase() + castingTime.slice(1);
}

export function formatRequirements(requirements?: string[]): string {
  return requirements?.filter(Boolean).join(', ') ?? '';
}
