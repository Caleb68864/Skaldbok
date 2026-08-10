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
