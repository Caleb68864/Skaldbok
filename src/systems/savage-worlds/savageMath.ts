/**
 * Savage Worlds (SWADE) dice math — exploding ("acing") trait dice, the Wild
 * Die, and the raise tier ladder. Pure functions, mirroring
 * {@link ../traveller/travellerMath} so the engine adapter and any odds display
 * share one tested source of truth.
 *
 * @remarks
 * SWADE rolls a single trait die (d4–d12), Wild Cards also roll a d6 Wild Die and
 * keep the higher; a maximum face **explodes** (rerolls and adds, open-ended), so
 * the success distribution is unbounded and has no closed form over a fixed range
 * — the recursion below is the closed form. Success is meeting a Target Number
 * (usually 4); every +4 over the TN is one **raise**.
 */

/**
 * Probability that a single exploding `dSides` die totals **at least** `target`.
 *
 * @remarks
 * For `target <= sides` the die succeeds outright on any face ≥ target (a max
 * face counts and also explodes, but is already a success). For `target > sides`
 * the only way through is to roll the max (probability `1/sides`) and then need
 * `target - sides` more on the open-ended reroll — hence the recursion.
 */
export function explodingChance(sides: number, target: number): number {
  if (sides <= 0) return 0;
  if (target <= 1) return 1;
  if (target <= sides) return (sides - target + 1) / sides;
  return (1 / sides) * explodingChance(sides, target - sides);
}

/** Options shared by the trait-roll helpers. */
export interface TraitRollOpts {
  /** Wild Cards roll a d6 Wild Die alongside the trait die and keep the higher. */
  wild?: boolean;
  /** Net flat bonus applied to the roll (die bonus like d12+1, plus situational modifiers, stacked and signed). */
  bonus?: number;
}

/**
 * Probability that a trait roll succeeds against `targetNumber`.
 *
 * @remarks
 * A flat `bonus` on the roll is equivalent to lowering the target. Wild Cards
 * (`wild: true`) take the higher of the trait die and a d6 Wild Die, so success
 * is `1 - (1 - pTrait)(1 - pWild)`; Extras use the trait die alone.
 */
export function traitChance(sides: number, targetNumber: number, opts: TraitRollOpts = {}): number {
  const target = targetNumber - (opts.bonus ?? 0);
  const pTrait = explodingChance(sides, target);
  if (!opts.wild) return pTrait;
  const pWild = explodingChance(6, target);
  return 1 - (1 - pTrait) * (1 - pWild);
}

/**
 * Probability of clearing the target by **at least `raises` raises** (each raise
 * is +4 over the Target Number). `raises = 0` is a plain success.
 */
export function raiseChance(sides: number, targetNumber: number, raises: number, opts: TraitRollOpts = {}): number {
  return traitChance(sides, targetNumber + 4 * Math.max(0, raises), opts);
}

/**
 * Formats a die code for display: `dieCode(8)` → `"d8"`, `dieCode(12, 1)` →
 * `"d12+1"`, `dieCode(4, -2)` → `"d4-2"` (an untrained/penalised die).
 */
export function dieCode(sides: number, bonus = 0): string {
  const suffix = bonus > 0 ? `+${bonus}` : bonus < 0 ? `${bonus}` : '';
  return `d${sides}${suffix}`;
}
