import type { CharacterRecord, StatKey } from '../types/character';
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

/**
 * Base chance from attribute value. Dragonbane Core Rules p. 28.
 * Attr 1-5 → 3, 6-8 → 4, 9-12 → 5, 13-15 → 6, 16-18 → 7.
 */
export function computeBaseChance(attributeValue: number): number {
  if (attributeValue <= 5) return 3;
  if (attributeValue <= 8) return 4;
  if (attributeValue <= 12) return 5;
  if (attributeValue <= 15) return 6;
  return 7;
}

/**
 * Compute skill value from attribute and training status.
 * Untrained = base chance. Trained = 2x base chance.
 */
export function computeSkillValue(attributeValue: number, trained: boolean): number {
  const base = computeBaseChance(attributeValue);
  return trained ? base * 2 : base;
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

export interface EffectiveValueResult {
  base: number;
  modifiers: Array<{ label: string; delta: number }>;
  effective: number;
  isModified: boolean;
}

const ATTRIBUTE_KEYS = new Set(['str', 'con', 'agl', 'int', 'wil', 'cha']);
const DERIVED_KEYS = new Set(['movement', 'hpMax', 'wpMax']);

function resolveBase(stat: StatKey, character: CharacterRecord): number {
  if (ATTRIBUTE_KEYS.has(stat)) return character.attributes[stat] ?? 0;
  if (stat === 'armor') return character.armor?.rating ?? 0;
  if (stat === 'helmet') return character.helmet?.rating ?? 0;
  if (DERIVED_KEYS.has(stat)) {
    const dv = getDerivedValue(character, stat);
    return typeof dv.effective === 'number' ? dv.effective : 0;
  }
  // Skill IDs
  if (character.skills?.[stat]) return character.skills[stat].value ?? 0;
  console.warn('getEffectiveValue: unknown stat key', stat);
  return 0;
}

/**
 * Resolves a stat's effective value by summing base + all active temp modifier deltas.
 * Pure function — no side effects, no mutations.
 */
export function getEffectiveValue(stat: StatKey, character: CharacterRecord): EffectiveValueResult {
  const base = resolveBase(stat, character);
  const active = character.tempModifiers ?? [];
  const modifiers = active.flatMap(m =>
    m.effects
      .filter(e => e.stat === stat)
      .map(e => ({ label: m.label, delta: e.delta })),
  );
  const sum = modifiers.reduce((acc, m) => acc + m.delta, 0);
  return {
    base,
    modifiers,
    effective: base + sum,
    isModified: modifiers.length > 0,
  };
}
