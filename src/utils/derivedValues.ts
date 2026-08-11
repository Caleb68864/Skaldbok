import type { CharacterRecord, StatKey } from '../types/character';
import { parseStatKey, statKey, type StatNamespace } from './statKeys';
import type { SystemDefinition } from '../types/system';

/**
 * The Dragonbane-derived stat block computed from a character's attributes and gear.
 *
 * @remarks
 * The classic-fantasy engine's `derivedStats` returns this shape; other systems
 * extend it (see {@link features/systems/engine/travellerEngine!TravellerDerivedValues | TravellerDerivedValues}). Damage bonuses are strings
 * because they are dice expressions (`+D6`), not numbers.
 */
/**
 * A value a ruleset's derived block may carry.
 *
 * @remarks
 * A derived *field* — the kind that appears on a sheet and can be overridden or
 * modified — is a number, or a string when it is a dice expression (`+D6`). The
 * map form exists because an adapter may also expose lookup tables to its own
 * screens: Traveller publishes per-characteristic DMs and scores in the same
 * block. Those are data for that system's UI, never a sheet field, and the
 * resolvers below treat them as absent rather than trying to render one.
 */
export type DerivedFieldValue = number | string | Record<string, number> | undefined;

export interface DerivedValues {
  /** Every derived stat a ruleset computes, keyed by the id it declares. */
  [key: string]: DerivedFieldValue;

  // The well-known Dragonbane keys, named so classic-fantasy's own consumers
  // keep their types. **Optional**: a ruleset that has no concept of a willpower
  // maximum should return a map without one, not a dummy zero. Traveller
  // returning `hpMax: END` was the landmine this shape created — a fourth system
  // cloned from it would have printed END as max HP.
  hpMax?: number;
  wpMax?: number;
  movement?: number;
  damageBonus?: string;
  aglDamageBonus?: string;
  encumbranceLimit?: number;
}

/** A single derived stat with its computed value, any manual override, and the effective result. */
export interface DerivedValueResult {
  /**
   * Value the rules produce from the character's stats, or `undefined` when
   * this ruleset computes no such stat — which is now expressible, since a
   * derived block is whatever the active engine returns rather than a fixed
   * six Dragonbane keys.
   */
  computed: number | string | undefined;
  /** User-entered override, or `null` when the computed value stands. */
  override: number | string | null;
  /** The value actually used: `override` when set, otherwise `computed`. */
  effective: number | string | undefined;
}

/**
 * Base chance from attribute value.
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

/** HP Max = CON attribute value. */
export function computeHPMax(character: CharacterRecord): number {
  return character.attributes['con'] ?? 10;
}

/** WP Max = WIL attribute value. */
export function computeWPMax(character: CharacterRecord): number {
  return character.attributes['wil'] ?? 10;
}

/** Base movement = 10. */
export function computeMovement(_character: CharacterRecord): number {
  return 10;
}

/**
 * Damage Bonus: STR 17+ → +D6, STR 13-16 → +D4, STR ≤12 → +0.
 */
export function computeDamageBonus(character: CharacterRecord): string {
  const str = character.attributes['str'] ?? 10;
  if (str >= 17) return '+D6';
  if (str >= 13) return '+D4';
  return '+0';
}

/**
 * AGL Damage Bonus: AGL 17+ → +D6, AGL 13-16 → +D4, AGL ≤12 → +0.
 * Uses the same threshold logic as STR damage bonus.
 */
export function computeAGLDamageBonus(character: CharacterRecord): string {
  const agl = character.attributes['agl'] ?? 10;
  if (agl >= 17) return '+D6';
  if (agl >= 13) return '+D4';
  return '+0';
}

/**
 * Encumbrance Limit = ceil(STR / 2) plus capacity bonuses from carried items
 * (e.g. backpacks). Each item contributes `capacityBonus * quantity`.
 */
export function computeEncumbranceLimit(character: CharacterRecord): number {
  const str = character.attributes['str'] ?? 10;
  const base = Math.ceil(str / 2);
  const bonus = (character.inventory ?? []).reduce(
    (sum, i) => sum + (i.capacityBonus ?? 0) * (i.quantity ?? 0),
    0,
  );
  return base + bonus;
}

/**
 * Skill base chance by attribute value.
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
 * Max prepared spells = INT base chance (3–7).
 * Uses the standard skill base chance table applied to the INT attribute.
 * Defaults to 5 (equivalent to INT 10) if INT is undefined.
 */
export function computeMaxPreparedSpells(character: CharacterRecord): number {
  const int = character.attributes['int'];
  if (int === undefined || int === null) return 5;
  return getSkillBaseChance(int);
}

/**
 * Computes the full Dragonbane derived-stat block for a character.
 *
 * @remarks
 * The classic-fantasy engine delegates its `derivedStats` here. `system` is
 * accepted for signature parity with the engine surface but unused — the
 * Dragonbane formulas read attributes directly.
 */
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

/**
 * Resolves one derived stat by key, folding in any user override.
 *
 * @remarks
 * `derived` is the active engine's already-computed stat block. Without it this
 * falls back to the classic-fantasy computation, which is the historical
 * behaviour and correct only for Dragonbane — every other ruleset's derived key
 * resolved to `undefined`, and therefore to 0, wherever the caller had an engine
 * available and did not pass it. Callers that hold an engine should pass
 * `engine.derivedStats(character)`.
 */
export function getDerivedValue(
  character: CharacterRecord,
  key: string,
  derived?: DerivedValues,
): DerivedValueResult {
  const all = derived ?? computeDerivedValues(character);
  const raw = all[key];
  // A lookup table is not a field: report it as absent rather than letting an
  // object reach a sheet cell as "[object Object]".
  const computed = typeof raw === 'number' || typeof raw === 'string' ? raw : undefined;
  const overrideRaw = character.derivedOverrides?.[key] ?? null;
  const override = overrideRaw !== null && overrideRaw !== undefined ? overrideRaw : null;
  return {
    computed,
    override,
    effective: override !== null ? override : computed,
  };
}

/** A stat's base value plus the temp modifiers acting on it and the resulting effective total. */
export interface EffectiveValueResult {
  /** Value before any temporary modifiers. */
  base: number;
  /** The active modifiers touching this stat, each with its label and signed delta. */
  modifiers: Array<{ label: string; delta: number }>;
  /** `base` plus the sum of every modifier delta. */
  effective: number;
  /** True when at least one modifier applies. */
  isModified: boolean;
}

const DERIVED_KEYS = new Set(['movement', 'hpMax', 'wpMax']);

/** Resolves an explicitly namespaced key against exactly one part of the record. */
function resolveNamespaced(
  namespace: StatNamespace,
  id: string,
  character: CharacterRecord,
  derived?: DerivedValues,
): number {
  switch (namespace) {
    case 'attr':
      return character.attributes?.[id] ?? 0;
    case 'res':
      return character.resources?.[id]?.current ?? 0;
    case 'derived': {
      const dv = getDerivedValue(character, id, derived);
      return typeof dv.effective === 'number' ? dv.effective : 0;
    }
    case 'armor':
      if (id === 'armor') return character.armor?.rating ?? 0;
      if (id === 'helmet') return character.helmet?.rating ?? 0;
      return 0;
    case 'skill':
      return character.skills?.[id]?.value ?? 0;
  }
}

/**
 * Resolves an unprefixed key by the historical precedence order.
 *
 * @remarks
 * Kept so temp modifiers written before stat keys were namespaced still resolve
 * to what they always did, whether or not they have been migrated. New keys
 * should always carry a namespace — see {@link statKey}.
 */
function resolveLegacy(stat: string, character: CharacterRecord, derived?: DerivedValues): number {
  if (Object.prototype.hasOwnProperty.call(character.attributes ?? {}, stat)) {
    return character.attributes[stat] ?? 0;
  }
  if (stat === 'armor') return character.armor?.rating ?? 0;
  if (stat === 'helmet') return character.helmet?.rating ?? 0;
  if (DERIVED_KEYS.has(stat)) {
    const dv = getDerivedValue(character, stat, derived);
    return typeof dv.effective === 'number' ? dv.effective : 0;
  }
  if (character.skills?.[stat]) return character.skills[stat].value ?? 0;
  console.warn('getEffectiveValue: unknown stat key', stat);
  return 0;
}

/**
 * Resolves a stat key against a character.
 *
 * @remarks
 * A namespaced key (`attr:str`, `res:str`) resolves against exactly that part
 * of the record, which is what lets a system name a resource after an
 * attribute — Traveller's damage track does exactly that. Unprefixed keys fall
 * back to the legacy precedence order.
 */
function resolveBase(stat: StatKey, character: CharacterRecord, derived?: DerivedValues): number {
  const { namespace, id } = parseStatKey(stat);
  return namespace === null
    ? resolveLegacy(id, character, derived)
    : resolveNamespaced(namespace, id, character, derived);
}

/**
 * Resolves a stat's effective value by summing base + all active temp modifier deltas.
 * Pure function — no side effects, no mutations.
 */
export function getEffectiveValue(
  stat: StatKey,
  character: CharacterRecord,
  derived?: DerivedValues,
): EffectiveValueResult {
  const base = resolveBase(stat, character, derived);
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

/**
 * An armour slot's rating after temp modifiers.
 *
 * @remarks
 * `engine.modifiableStats` offers `armor:armor` and `armor:helmet` as targets —
 * a shield spell, a damaged plate, a powered exoskeleton — but every reader took
 * `character.armor.rating` raw, so those modifiers did nothing. Three surfaces
 * read the rating (the gear screen, the printed sheet, and Savage Worlds'
 * Toughness formula, which is a real calculation rather than a display), so the
 * fold belongs in one place.
 *
 * Floors at 0: a penalty large enough to invert the rating would otherwise turn
 * armour into a bonus to incoming damage.
 */
export function resolveArmorRating(character: CharacterRecord, slot: 'armor' | 'helmet'): number {
  const piece = slot === 'armor' ? character.armor : character.helmet;
  if (!piece) return 0;
  return Math.max(0, getEffectiveValue(statKey('armor', slot), character).effective);
}

/**
 * A skill's value after temp modifiers.
 *
 * @remarks
 * "+1 Gun Combat while the scope is on", "−2 Stealth in this armour" — a
 * scene-long adjustment to one skill is among the most common things a GM calls
 * for, and `skill:<id>` was the one stat namespace with no producer and no
 * consumer. Every surface read `character.skills[id].value` directly.
 *
 * Takes the already-resolved stored value so the caller keeps whatever fallback
 * it uses for a skill with no entry (`engine.skill.computeValue`), which differs
 * per system and is not this function's business.
 *
 * Floors at 0: no ruleset here has a meaningful negative skill value, and a
 * roll-under target below 0 is unrollable.
 */
export function resolveSkillValue(
  character: CharacterRecord,
  skillId: string,
  storedValue: number,
): EffectiveValueResult {
  const active = character.tempModifiers ?? [];
  const key = statKey('skill', skillId);
  const modifiers = active.flatMap(m =>
    m.effects.filter(e => e.stat === key).map(e => ({ label: m.label, delta: e.delta })),
  );
  const sum = modifiers.reduce((acc, m) => acc + m.delta, 0);
  return {
    base: storedValue,
    modifiers,
    effective: Math.max(0, storedValue + sum),
    isModified: modifiers.length > 0,
  };
}

/** One derived field resolved through override, then temp modifiers. */
export interface ResolvedDerivedField extends EffectiveValueResult {
  /** Value the engine computed from the character's stats. */
  computed: number | string | undefined;
  /** User-entered override, or `null` when the computed value stands. */
  override: number | null;
  /**
   * The value to display: `override` when set, otherwise `computed`, plus every
   * temp modifier aimed at this field. A non-numeric field (a `+D6` damage
   * bonus) is returned unchanged.
   */
  display: number | string | undefined;
}

/**
 * Resolves one derived field the way every surface should: computed value,
 * then a manual override, then any temporary modifiers aimed at it.
 *
 * @remarks
 * Four surfaces render derived stats — the sheet's Derived Values panel, the
 * play dashboard, the gear screen's encumbrance, and the printed sheet — and
 * each had reimplemented the override fold slightly differently. **None of them
 * folded temp modifiers.** `engine.modifiableStats` offers `derived:movement`,
 * `derived:hpMax` and `derived:wpMax` as targets, the picker writes them, the
 * buff bar lists them, and every one of those modifiers was inert: nothing in
 * the app read a `derived:` key. Only `attr:` targets ever did anything.
 *
 * Order matters and is deliberate. An override *replaces* the computed value —
 * it is the player saying "the rules say 10, mine is 12" — while a modifier
 * *adjusts* whatever the current value is. So a +2 boots buff on an overridden
 * Movement of 12 gives 14, not 12.
 *
 * Takes the already-computed derived map rather than the engine so the caller
 * computes it once for the whole panel, and so this stays a pure function over
 * plain data.
 *
 * A string-valued field (Dragonbane's `+D6` damage bonus) cannot take a numeric
 * delta, so modifiers aimed at one are reported in `modifiers` but leave
 * `display` untouched — visible to the user rather than silently dropped.
 */
export function resolveDerivedField(
  character: CharacterRecord,
  derived: Record<string, DerivedFieldValue>,
  field: { key: string; overridable?: boolean },
): ResolvedDerivedField {
  const raw = derived[field.key];
  const computed = typeof raw === 'number' || typeof raw === 'string' ? raw : undefined;
  const overrideRaw = character.derivedOverrides?.[field.key];
  const override = field.overridable && typeof overrideRaw === 'number' ? overrideRaw : null;

  const base = override ?? computed;
  const active = character.tempModifiers ?? [];
  const key = statKey('derived', field.key);
  const modifiers = active.flatMap(m =>
    m.effects.filter(e => e.stat === key).map(e => ({ label: m.label, delta: e.delta })),
  );
  const sum = modifiers.reduce((acc, m) => acc + m.delta, 0);

  const numericBase = typeof base === 'number' ? base : null;
  return {
    computed,
    override,
    modifiers,
    base: numericBase ?? 0,
    effective: (numericBase ?? 0) + sum,
    display: numericBase !== null ? numericBase + sum : base,
    isModified: modifiers.length > 0,
  };
}
