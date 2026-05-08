import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

export interface PlayModuleProps {
  character: CharacterRecord;
  system: SystemDefinition | null;
  updateCharacter: (partial: Partial<CharacterRecord> | ((prev: CharacterRecord) => Partial<CharacterRecord>)) => void;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
