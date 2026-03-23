import type { CharacterRecord } from '../types/character';

export interface RoundRestResult {
  newWpCurrent: number;
  recovered: number;
  alreadyFull: boolean;
}

export interface StretchRestResult {
  newWpCurrent: number;
  newHpCurrent: number;
  wpRecovered: number;
  hpRecovered: number;
  conditionCleared?: string;
  alreadyFullWp: boolean;
  alreadyFullHp: boolean;
}

/**
 * Applies a round rest to the character.
 * Adds wpRoll to WP.current, capped at WP.max.
 * Pure function — no side effects.
 */
export function applyRoundRest(character: CharacterRecord, wpRoll: number): RoundRestResult {
  const wp = character.resources['wp'] ?? { current: 0, max: 0 };
  const alreadyFull = wp.current >= wp.max;
  const newWpCurrent = Math.min(wp.max, wp.current + wpRoll);
  const recovered = newWpCurrent - wp.current;
  return { newWpCurrent, recovered, alreadyFull };
}

/**
 * Applies a stretch rest to the character.
 * Sets WP to max, adds hpRoll to HP.current (capped at HP.max),
 * and optionally clears a condition.
 * Pure function — no side effects.
 */
export function applyStretchRest(
  character: CharacterRecord,
  _wpRoll: number,
  hpRoll: number,
  conditionToClear?: string,
): StretchRestResult {
  const wp = character.resources['wp'] ?? { current: 0, max: 0 };
  const hp = character.resources['hp'] ?? { current: 0, max: 0 };

  const alreadyFullWp = wp.current >= wp.max;
  const alreadyFullHp = hp.current >= hp.max;

  // Stretch rest: WP always restored to max (wpRoll is informational / for flavor)
  const newWpCurrent = wp.max;
  const wpRecovered = newWpCurrent - wp.current;

  // HP: add hpRoll, cap at max
  const newHpCurrent = Math.min(hp.max, hp.current + hpRoll);
  const hpRecovered = newHpCurrent - hp.current;

  const result: StretchRestResult = {
    newWpCurrent,
    newHpCurrent,
    wpRecovered,
    hpRecovered,
    alreadyFullWp,
    alreadyFullHp,
  };

  if (conditionToClear) {
    result.conditionCleared = conditionToClear;
  }

  return result;
}
