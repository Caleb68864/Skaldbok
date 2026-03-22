import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

export interface DerivedValues {
  hpMax: number;
  wpMax: number;
  movement: number;
  damageBonus: string;
  encumbranceLimit: number;
}

export interface DerivedValueResult {
  computed: number | string;
  override: number | string | null;
  effective: number | string;
}

export function computeHPMax(character: CharacterRecord): number {
  return character.attributes['con'] ?? 10;
}

export function computeWPMax(character: CharacterRecord): number {
  return character.attributes['wil'] ?? 10;
}

export function computeMovement(_character: CharacterRecord): number {
  return 10;
}

export function computeDamageBonus(character: CharacterRecord): string {
  const str = character.attributes['str'] ?? 10;
  if (str >= 17) return '+D6';
  if (str >= 13) return '+D4';
  return '+0';
}

export function computeEncumbranceLimit(character: CharacterRecord): number {
  const str = character.attributes['str'] ?? 10;
  return Math.ceil(str / 2) + 5;
}

export function computeDerivedValues(character: CharacterRecord, _system?: SystemDefinition): DerivedValues {
  return {
    hpMax: computeHPMax(character),
    wpMax: computeWPMax(character),
    movement: computeMovement(character),
    damageBonus: computeDamageBonus(character),
    encumbranceLimit: computeEncumbranceLimit(character),
  };
}

export function getDerivedValue(character: CharacterRecord, key: string): DerivedValueResult {
  const all = computeDerivedValues(character);
  const computed = all[key as keyof DerivedValues];
  const overrideRaw = character.derivedOverrides?.[key] ?? null;
  const override = overrideRaw !== null && overrideRaw !== undefined ? overrideRaw : null;
  return {
    computed,
    override,
    effective: override !== null ? override : computed,
  };
}
