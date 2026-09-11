import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { CreatureStatField, SystemDefinition } from '../../types/system';

/**
 * The stat block a ruleset gets when it declares none.
 *
 * @remarks
 * Exactly the three columns `creatureTemplate.stats` used to hardcode, so a
 * system that declares nothing behaves as it always has and no stored creature
 * changes shape. Dragonbane deliberately does not declare `creatures` — this
 * *is* its stat block.
 */
export const DEFAULT_CREATURE_STAT_FIELDS: CreatureStatField[] = [
  { id: 'hp', label: 'HP', summary: true },
  { id: 'armor', label: 'Armor', summary: true },
  { id: 'movement', label: 'Movement', abbr: 'Mv', summary: true },
];

/**
 * The stat fields the active ruleset declares, or the default set.
 *
 * @remarks
 * Every bestiary surface must go through this — the list card, the detail view,
 * the form and the add-to-encounter flow — the same rule
 * `resolveSkillCategories` follows for skills. A surface that reads
 * `stats.hp` directly is naming one ruleset's stat block.
 */
export function resolveCreatureStatFields(
  system: SystemDefinition | null | undefined,
): CreatureStatField[] {
  const declared = system?.creatures?.statFields;
  return declared && declared.length > 0 ? declared : DEFAULT_CREATURE_STAT_FIELDS;
}

/**
 * The stat block a newly-created creature starts with, under the active
 * ruleset's own ids.
 *
 * @remarks
 * Every flow that stands up a creature needs this and three of them wrote it by
 * hand as `{ hp: …, armor: 0, movement: 0 }` — the mid-session NPC capture, the
 * encounter participant picker and the combat quick-create. Three Dragonbane ids
 * chosen by nothing, applied to every ruleset: a `systemId ===` branch with no
 * `systemId` in it, which is why no guard saw it. A Traveller NPC captured
 * during play was stored with a Dragonbane stat block, so the bestiary showed
 * its declared fields all reading 0 and filed the numbers that were actually
 * entered under "Other".
 *
 * Every declared field starts at 0, and the health stat is set explicitly even
 * if the ruleset leaves it out of `statFields` — `resolveCreatureHealthStatId`
 * is what every participant's starting HP is read from, so it must exist.
 *
 * @param system - The active definition, or `null`/`undefined` for the default block.
 * @param seed - Starting values; `health` lands on the ruleset's health stat.
 */
export function newCreatureStatBlock(
  system: SystemDefinition | null | undefined,
  seed?: { health?: number },
): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const field of resolveCreatureStatFields(system)) stats[field.id] = 0;
  stats[resolveCreatureHealthStatId(system)] = seed?.health ?? 0;
  return stats;
}

/**
 * The heading for one creature stat, from the fields the system declares.
 *
 * @remarks
 * There were two sources for these three headings and they disagreed. Traveller's
 * `statFields` said "Hits" / "Armour" / "Speed (m)" while the engine's
 * `labels.creatureHealth` / `creatureArmor` / `creatureMovement` said "END" /
 * "Armour" / "Mv" — for the same system, on adjacent screens. Savage Worlds had
 * the same split: "HP" on the bestiary card, "Wounds" in the encounter view.
 *
 * `statFields` wins because it is where the ruleset already describes its own
 * creature block, and because every other bestiary surface reads it.
 *
 * @param system - The active definition.
 * @param statId - Stat to label.
 * @param options - `short` prefers the compact form for dense rows.
 */
export function creatureStatLabel(
  system: SystemDefinition | null | undefined,
  statId: string,
  options?: { short?: boolean },
): string {
  const field = resolveCreatureStatFields(system).find(f => f.id === statId);
  if (!field) return statId.toUpperCase();
  return options?.short ? (field.abbr ?? field.label) : field.label;
}

/**
 * Id of the stat an encounter participant's health is seeded from.
 *
 * @remarks
 * Falls back to `hp` — the id the default stat block uses and the one every
 * creature stored before this existed carries.
 */
export function resolveCreatureHealthStatId(
  system: SystemDefinition | null | undefined,
): string {
  return system?.creatures?.healthStatId ?? 'hp';
}

/**
 * Id of the stat shown as a participant's armour on the combat list.
 *
 * @remarks
 * Falls back to `armor`, the default stat block's id.
 */
export function resolveCreatureArmorStatId(
  system: SystemDefinition | null | undefined,
): string {
  return system?.creatures?.armorStatId ?? 'armor';
}

/** Short form for a stat, for the places that only have room for one. */
export function statAbbr(field: CreatureStatField): string {
  return field.abbr ?? field.label;
}

/** Reads one stat off a creature; an unrecorded stat reads as 0. */
export function readCreatureStat(template: CreatureTemplate, statId: string): number {
  return template.stats?.[statId] ?? 0;
}

/** A stored stat with no matching declaration — see {@link partitionCreatureStats}. */
export interface UndeclaredStat {
  id: string;
  value: number;
}

/**
 * Splits a creature's stored stats into the ones this ruleset declares and the
 * ones it does not.
 *
 * @remarks
 * The undeclared ones are surfaced rather than dropped, in a trailing "Other"
 * group — the same treatment a custom skill gets when its category no longer
 * resolves. A number you cannot see is a number you cannot correct or delete,
 * and switching a campaign's ruleset must not silently hide a stat block
 * somebody typed in.
 */
export function partitionCreatureStats(
  template: CreatureTemplate,
  fields: CreatureStatField[],
): { declared: Array<{ field: CreatureStatField; value: number }>; undeclared: UndeclaredStat[] } {
  const declaredIds = new Set(fields.map(f => f.id));
  return {
    declared: fields.map(field => ({ field, value: readCreatureStat(template, field.id) })),
    undeclared: Object.entries(template.stats ?? {})
      .filter(([id]) => !declaredIds.has(id))
      .map(([id, value]) => ({ id, value })),
  };
}

/**
 * The one-line stat summary shown on a bestiary list card.
 *
 * @remarks
 * Fields flagged `summary` in declaration order, or every field when none is
 * flagged. The card previously printed a hardcoded "HP x · Armor y · Mv z"
 * regardless of ruleset — a leak the encounter screens' `vocabularyLeaks` test
 * never covered, because it only scans `features/encounters` and
 * `features/playDashboard`.
 */
export function summariseCreatureStats(
  template: CreatureTemplate,
  fields: CreatureStatField[],
): string {
  const shown = fields.some(f => f.summary) ? fields.filter(f => f.summary) : fields;
  return shown.map(f => `${statAbbr(f)} ${readCreatureStat(template, f.id)}`).join(' · ');
}
