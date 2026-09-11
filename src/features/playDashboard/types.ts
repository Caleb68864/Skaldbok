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
