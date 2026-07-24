import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

/** Common props every play-dashboard module receives: the character, its system, and the update callback. */
export interface PlayModuleProps {
  character: CharacterRecord;
  system: SystemDefinition | null;
  updateCharacter: (partial: Partial<CharacterRecord> | ((prev: CharacterRecord) => Partial<CharacterRecord>)) => void;
}

/** Rounds and clamps a value into `[min, max]`, returning `min` for non-finite input. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Rolls a single die with the given number of sides, returning 1..sides inclusive. */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
