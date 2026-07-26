import type { Ability, HeroicAbility, Spell } from '../types/character';

/**
 * Typed views over the unified {@link Ability} collection.
 *
 * @remarks
 * Storage is system-agnostic — one `abilities` array, with ruleset-specific
 * fields in each entry's `systemFields`. The Dragonbane UI still thinks in
 * spells and heroic abilities, so rather than rewriting every field access in
 * those screens, they read and write through these projections.
 *
 * A system with its own ability types (talents, psionic powers) works with
 * `Ability` directly and never touches this module.
 */

/** Ability type ids used by the classic-fantasy ruleset. */
export const ABILITY_TYPE = {
  spell: 'spell',
  heroic: 'heroic',
} as const;

/** Reads a string out of an ability's system-specific bag. */
function str(ability: Ability, key: string, fallback = ''): string {
  const raw = ability.systemFields?.[key];
  return typeof raw === 'string' ? raw : fallback;
}

/** Reads a number out of an ability's system-specific bag. */
function num(ability: Ability, key: string, fallback = 0): number {
  const raw = ability.systemFields?.[key];
  return typeof raw === 'number' ? raw : fallback;
}

/** Projects the spell-typed abilities into the {@link Spell} shape. */
export function toSpells(abilities: Ability[] | undefined): Spell[] {
  return (abilities ?? [])
    .filter(a => a.type === ABILITY_TYPE.spell)
    .map(a => ({
      id: a.id,
      name: a.name,
      summary: a.summary,
      school: str(a, 'school'),
      powerLevel: num(a, 'powerLevel', 1),
      wpCost: a.cost?.wp ?? 0,
      range: str(a, 'range'),
      duration: str(a, 'duration'),
      prepared: a.prepared,
      pinnedAsStamp: a.pinnedAsStamp,
      effects: a.effects,
      rank: a.systemFields?.rank as number | undefined,
      requirements: a.systemFields?.requirements as string[] | undefined,
      castingTime: a.systemFields?.castingTime as Spell['castingTime'],
      powerScaling: a.systemFields?.powerScaling as Spell['powerScaling'],
    }));
}

/** Projects the heroic-typed abilities into the {@link HeroicAbility} shape. */
export function toHeroicAbilities(abilities: Ability[] | undefined): HeroicAbility[] {
  return (abilities ?? [])
    .filter(a => a.type === ABILITY_TYPE.heroic)
    .map(a => ({
      id: a.id,
      name: a.name,
      summary: a.summary,
      wpCost: a.cost?.wp,
      pinnedAsStamp: a.pinnedAsStamp,
      requirement: (a.systemFields?.requirement as string | null | undefined) ?? null,
      requirementSkillId: a.systemFields?.requirementSkillId as string | null | undefined,
      requirementSkillLevel: a.systemFields?.requirementSkillLevel as number | null | undefined,
    }));
}

/** Drops keys whose value is `undefined`, so bags stay free of empty entries. */
function compact(bag: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(bag)) {
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Converts one {@link Spell} back into storage form. */
export function fromSpell(spell: Spell): Ability {
  return {
    id: spell.id,
    type: ABILITY_TYPE.spell,
    name: spell.name,
    summary: spell.summary,
    cost: { wp: spell.wpCost },
    prepared: spell.prepared,
    pinnedAsStamp: spell.pinnedAsStamp,
    effects: spell.effects,
    systemFields: compact({
      school: spell.school,
      powerLevel: spell.powerLevel,
      range: spell.range,
      duration: spell.duration,
      rank: spell.rank,
      requirements: spell.requirements,
      castingTime: spell.castingTime,
      powerScaling: spell.powerScaling,
    }),
  };
}

/** Converts one {@link HeroicAbility} back into storage form. */
export function fromHeroicAbility(ability: HeroicAbility): Ability {
  return {
    id: ability.id,
    type: ABILITY_TYPE.heroic,
    name: ability.name,
    summary: ability.summary,
    cost: ability.wpCost === undefined ? undefined : { wp: ability.wpCost },
    pinnedAsStamp: ability.pinnedAsStamp,
    systemFields: compact({
      requirement: ability.requirement ?? undefined,
      requirementSkillId: ability.requirementSkillId ?? undefined,
      requirementSkillLevel: ability.requirementSkillLevel ?? undefined,
    }),
  };
}

/** systemFields keys the typed Spell/HeroicAbility views round-trip explicitly. */
const MANAGED_SPELL_SYSTEM_FIELDS = new Set([
  'school', 'powerLevel', 'range', 'duration', 'rank', 'requirements', 'castingTime', 'powerScaling',
]);
const MANAGED_HEROIC_SYSTEM_FIELDS = new Set([
  'requirement', 'requirementSkillId', 'requirementSkillLevel',
]);

/**
 * Carries forward any systemFields the typed view does NOT enumerate, matched by
 * ability id — otherwise a community/JSON-authored custom field (e.g. `damage`,
 * `element`) would be silently dropped the first time the ability is edited and
 * re-serialized through fromSpell/fromHeroicAbility. Managed keys still win.
 */
function preserveExtras(converted: Ability, original: Ability | undefined, managed: Set<string>): Ability {
  const src = original?.systemFields;
  if (!src) return converted;
  const extras = Object.fromEntries(Object.entries(src).filter(([k]) => !managed.has(k)));
  if (Object.keys(extras).length === 0) return converted;
  return { ...converted, systemFields: { ...extras, ...(converted.systemFields ?? {}) } };
}

/**
 * Replaces just the spells within an abilities collection, leaving every other
 * ability type untouched.
 */
export function withSpells(abilities: Ability[] | undefined, spells: Spell[]): Ability[] {
  const byId = new Map((abilities ?? []).map(a => [a.id, a]));
  const others = (abilities ?? []).filter(a => a.type !== ABILITY_TYPE.spell);
  return [...others, ...spells.map(s => preserveExtras(fromSpell(s), byId.get(s.id), MANAGED_SPELL_SYSTEM_FIELDS))];
}

/** Replaces just the heroic abilities, leaving every other ability type alone. */
export function withHeroicAbilities(
  abilities: Ability[] | undefined,
  heroic: HeroicAbility[],
): Ability[] {
  const byId = new Map((abilities ?? []).map(a => [a.id, a]));
  const others = (abilities ?? []).filter(a => a.type !== ABILITY_TYPE.heroic);
  return [...others, ...heroic.map(h => preserveExtras(fromHeroicAbility(h), byId.get(h.id), MANAGED_HEROIC_SYSTEM_FIELDS))];
}
