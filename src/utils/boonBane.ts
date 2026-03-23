/**
 * Boon/Bane probability calculation utilities.
 * All functions are pure with no side effects.
 *
 * Value parameter is on a 0–20 scale (d20 roll target).
 * Return values are fractions (0–1) representing probabilities.
 * Multiply by 100 to display as a percentage.
 */

export type BoonBaneState = 'boon' | 'none' | 'bane';

/** Normal probability: P = value / 20 */
export function calcNormalProb(value: number): number {
  return value / 20;
}

/** Boon probability (roll twice, take best): P = 1 - (1 - value/20)^2 */
export function calcBoonProb(value: number): number {
  return 1 - (1 - value / 20) ** 2;
}

/** Bane probability (roll twice, take worst): P = (value/20)^2 */
export function calcBaneProb(value: number): number {
  return (value / 20) ** 2;
}

/**
 * Resolve the effective boon/bane state for a skill given:
 *  - global: the global selector value
 *  - skillOverride: per-skill override (undefined = inherit global)
 *  - hasAutoConditionBane: whether the skill's linked attribute has an active debilitating condition
 *
 * Auto-bane cancellation rules:
 *  - boon + auto-bane = normal
 *  - none + auto-bane = bane
 *  - bane + auto-bane = single bane (no stacking)
 */
export function resolveEffectiveBoonBane(
  global: BoonBaneState,
  skillOverride: 'boon' | 'bane' | undefined,
  hasAutoConditionBane: boolean,
): BoonBaneState {
  const base: BoonBaneState = skillOverride ?? global;

  if (!hasAutoConditionBane) return base;

  if (base === 'boon') return 'none';
  return 'bane';
}

/** Format a probability fraction as a display string (e.g. "70%") */
export function formatProb(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}
