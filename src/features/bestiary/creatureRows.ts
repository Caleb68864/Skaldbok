import type {
  CreatureAbility,
  CreatureAttack,
  CreatureSkill,
} from '../../types/creatureTemplate';

/**
 * Conversions between a creature's typed list fields and the string rows
 * `RepeatableRows` edits.
 *
 * @remarks
 * Extracted from the form because this is the half that can corrupt a saved
 * creature: a row abandoned half-typed, or a skill level left blank, becomes a
 * stored record either way. The rendering around it is verified by running the
 * app; these rules are worth pinning.
 */

/** Typed attacks → editable rows. */
export function attackRows(attacks: CreatureAttack[]): Record<string, string>[] {
  return attacks.map(a => ({
    name: a.name,
    damage: a.damage,
    range: a.range,
    skill: a.skill,
    special: a.special ?? '',
  }));
}

/** Typed abilities → editable rows. */
export function abilityRows(abilities: CreatureAbility[]): Record<string, string>[] {
  return abilities.map(a => ({ name: a.name, description: a.description }));
}

/** Typed skills → editable rows. */
export function skillRows(skills: CreatureSkill[]): Record<string, string>[] {
  return skills.map(s => ({ name: s.name, value: String(s.value) }));
}

/** Trimmed cell value, tolerating a column the row never had. */
function cell(row: Record<string, string>, key: string): string {
  return (row[key] ?? '').trim();
}

/**
 * Whether a row carries anything worth storing.
 *
 * @remarks
 * Keyed on the name alone: adding a row and thinking better of it is the normal
 * way to use an add/remove list, and a nameless attack stores as a blank line
 * that cannot be identified afterwards — only deleted by position.
 */
function named(row: Record<string, string>): boolean {
  return cell(row, 'name') !== '';
}

/** Editable rows → typed attacks, dropping unnamed rows. */
export function rowsToAttacks(rows: Record<string, string>[]): CreatureAttack[] {
  return rows.filter(named).map(row => ({
    name: cell(row, 'name'),
    damage: cell(row, 'damage'),
    range: cell(row, 'range'),
    skill: cell(row, 'skill'),
    // Absent rather than empty: the stat block prints `special` in brackets, and
    // an empty string would print an empty pair of them.
    special: cell(row, 'special') || undefined,
  }));
}

/** Editable rows → typed abilities, dropping unnamed rows. */
export function rowsToAbilities(rows: Record<string, string>[]): CreatureAbility[] {
  return rows.filter(named).map(row => ({
    name: cell(row, 'name'),
    description: cell(row, 'description'),
  }));
}

/**
 * Editable rows → typed skills, dropping unnamed rows.
 *
 * @remarks
 * A blank or unparseable level stores as 0 rather than `NaN`. `NaN` survives
 * the type (it is a number), serialises to `null` in an export, and renders as
 * "NaN" on the stat block — a corrupt record that type-checks.
 */
export function rowsToSkills(rows: Record<string, string>[]): CreatureSkill[] {
  return rows.filter(named).map(row => {
    const parsed = Math.trunc(Number(cell(row, 'value')));
    return { name: cell(row, 'name'), value: Number.isFinite(parsed) ? parsed : 0 };
  });
}
