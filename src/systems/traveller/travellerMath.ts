/**
 * Converts a Traveller characteristic score into its Dice Modifier (DM).
 *
 * Table: 0 -> -3, 1-2 -> -2, 3-5 -> -1, 6-8 -> 0, 9-11 -> +1, 12-14 -> +2, 15+ -> +3.
 */
export function characteristicToDM(score: number): number {
  if (score <= 0) return -3;
  if (score <= 2) return -2;
  if (score <= 5) return -1;
  if (score <= 8) return 0;
  if (score <= 11) return 1;
  if (score <= 14) return 2;
  return 3;
}

const TWO_D6_OUTCOME_COUNTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

/**
 * Probability of rolling 2d6 + modifier >= target, clamped to [0, 1].
 */
export function twoD6SuccessProbability(target: number, modifier = 0): number {
  const needed = target - modifier;
  let favorable = 0;
  for (let roll = 2; roll <= 12; roll++) {
    if (roll >= needed) {
      favorable += TWO_D6_OUTCOME_COUNTS[roll];
    }
  }
  return Math.min(1, Math.max(0, favorable / 36));
}

/**
 * Probability of success under a Boon or Bane: roll 3d6 and keep the best two
 * (Boon) or the worst two (Bane), then add the modifier and compare to target.
 *
 * @remarks
 * Enumerates all 216 ordered 3d6 outcomes rather than approximating. This
 * replaces the previous fallback that reused plain 2d6 odds and therefore
 * reported the same chance with or without a Boon.
 */
export function threeD6KeepTwoProbability(
  target: number,
  modifier = 0,
  keep: 'best' | 'worst',
): number {
  const needed = target - modifier;
  let favorable = 0;
  for (let a = 1; a <= 6; a++) {
    for (let b = 1; b <= 6; b++) {
      for (let c = 1; c <= 6; c++) {
        const sorted = [a, b, c].sort((x, y) => x - y);
        // sorted[0] <= sorted[1] <= sorted[2]
        const total = keep === 'best' ? sorted[1] + sorted[2] : sorted[0] + sorted[1];
        if (total >= needed) favorable++;
      }
    }
  }
  return Math.min(1, Math.max(0, favorable / 216));
}
