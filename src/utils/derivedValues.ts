import type { CharacterRecord } from '../types/character';
import type { SystemDefinition } from '../types/system';

export interface DerivedValues {
  hpMax: number;
  wpMax: number;
  movement: number;
  damageBonus: string;
  aglDamageBonus: string;
  encumbranceLimit: number;
}

export interface DerivedValueResult {
  computed: number | string;
  override: number | string | null;
  effective: number | string;
}

/** HP Max = CON attribute value. Dragonbane Core Rules p. 26. */
export function computeHPMax(character: CharacterRecord): number {
  return character.attributes['con'] ?? 10;
}

/** WP Max = WIL attribute value. Dragonbane Core Rules p. 26. */
export function computeWPMax(character: CharacterRecord): number {
  return character.attributes['wil'] ?? 10;
}

/** Base movement = 10. Dragonbane Core Rules p. 44. */
export function computeMovement(_character: CharacterRecord): number {
  return 10;
}

/**
 * Damage Bonus: STR 17+ → +D6, STR 13-16 → +D4, STR ≤12 → +0. Dragonbane Core Rules p. 40.
 * Note: thresholds >=17 and >=13 match core rules (STR 13-16 → +D4, STR 17+ → +D6).
 * The NPC attribute guidelines use a reverse lookup (inferring STR from damage bonus) — not used here.
 */
export function computeDamageBonus(character: CharacterRecord): string {
  const str = character.attributes['str'] ?? 10;
  if (str >= 17) return '+D6';
  if (str >= 13) return '+D4';
  return '+0';
}

/**
 * AGL Damage Bonus: AGL 17+ → +D6, AGL 13-16 → +D4, AGL ≤12 → +0.
 * Uses the same threshold logic as STR damage bonus. Dragonbane Core Rules p. 40.
 */
export function computeAGLDamageBonus(character: CharacterRecord): string {
  const agl = character.attributes['agl'] ?? 10;
  if (agl >= 17) return '+D6';
  if (agl >= 13) return '+D4';
  return '+0';
}

/** Encumbrance Limit = STR / 2 (rounded up). Dragonbane Core Rules p. 46. */
export function computeEncumbranceLimit(character: CharacterRecord): number {
  const str = character.attributes['str'] ?? 10;
  return Math.ceil(str / 2);
}

/**
 * Skill base chance by attribute value.
 * Dragonbane Reference Sheet: skill_level_base_chance table.
 *   Attribute 1-5 → base chance 3
 *   Attribute 6-8 → base chance 4
 *   Attribute 9-12 → base chance 5
 *   Attribute 13-15 → base chance 6
 *   Attribute 16-18 → base chance 7
 */
export function getSkillBaseChance(attributeValue: number): number {
  if (attributeValue <= 5) return 3;
  if (attributeValue <= 8) return 4;
  if (attributeValue <= 12) return 5;
  if (attributeValue <= 15) return 6;
  return 7;
}

/**
 * Max prepared spells = INT base chance (3–7). Dragonbane Core Rules.
 * Uses the standard skill base chance table applied to the INT attribute.
 * Defaults to 5 (equivalent to INT 10) if INT is undefined.
 */
export function computeMaxPreparedSpells(character: CharacterRecord): number {
  const int = character.attributes['int'];
  if (int === undefined || int === null) return 5;
  return getSkillBaseChance(int);
}

export function computeDerivedValues(character: CharacterRecord, _system?: SystemDefinition): DerivedValues {
  return {
    hpMax: computeHPMax(character),
    wpMax: computeWPMax(character),
    movement: computeMovement(character),
    damageBonus: computeDamageBonus(character),
    aglDamageBonus: computeAGLDamageBonus(character),
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
