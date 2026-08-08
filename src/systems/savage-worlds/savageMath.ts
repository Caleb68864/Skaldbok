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
  // Guard non-finite first: `NaN <= 0` is false, so a NaN `sides`/`target` would
  // slip past the range checks and recurse on `target - NaN` (= NaN) forever.
  if (!Number.isFinite(sides) || sides <= 0) return 0; // degenerate die — no face can be rolled
  if (!Number.isFinite(target)) return 0;
  if (target <= 1) return 1; // every die face is >= 1, so target ≤ 1 is met automatically
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

/** The top rung of the standard trait ladder; values above it are `d12+N`. */
export const SAVAGE_TOP_DIE = 12;

/** A trait die split into the die actually rolled and its flat bonus. */
export interface TraitDie {
  sides: number;
  bonus: number;
}

/**
 * Decodes a stored trait value into the die rolled and its flat bonus.
 *
 * @remarks
 * SWADE advances past d12 by adding a flat bonus, not a bigger die: d12+1, then
 * d12+2. Storing that as a single number (13, 14) keeps the record shape and the
 * ladder stepper simple, but every *reader* has to know 13 means "d12, +1" —
 * otherwise it rolls a d13 — a die that does not exist, with a distribution
 * that is neither reliably better nor reliably worse than the rule's. A flat +1
 * shifts the whole curve while a bigger die dilutes the probability per face,
 * so at TN 8 a d12+1 beats the d13 it was rolled as, and at other targets it
 * loses to it. That is what makes the error hard to notice: the displayed odds
 * are always plausible and always for the wrong die.
 *
 * Values at or below the top rung pass through with no bonus, so every existing
 * character is unaffected.
 */
export function decodeTraitDie(value: number): TraitDie {
  if (!Number.isFinite(value) || value <= SAVAGE_TOP_DIE) {
    return { sides: Number.isFinite(value) ? value : SAVAGE_TOP_DIE, bonus: 0 };
  }
  return { sides: SAVAGE_TOP_DIE, bonus: value - SAVAGE_TOP_DIE };
}

/**
 * The ladder a system's trait stepper offers, extended past d12 when the
 * definition allows it.
 *
 * @remarks
 * Encoded as `12 + N` so the existing "snap to the nearest rung" logic keeps
 * working — without the extra rungs a stored 13 snaps straight back to 12 the
 * first time the field is touched, silently undoing a Legendary advance.
 */
export function traitLadder(base: number[], allowsPlus: boolean, maxPlus = 2): number[] {
  if (!allowsPlus) return base;
  const top = Math.max(...base);
  return [...base, ...Array.from({ length: maxPlus }, (_, i) => top + i + 1)];
}
