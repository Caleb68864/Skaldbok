import type { CharacterRecord, CharacterResource, CharacterSkill } from '../types/character';
import type { AttributeDefinition, SystemDefinition } from '../types/system';

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

/**
 * Coerces one attribute against its own definition.
 *
 * @remarks
 * These bounds used to be the literals `1..30`, defaulting to `10` — Dragonbane's
 * range, applied to every system on every save. A Traveller characteristic
 * legitimately at 0 was rewritten to 1, and 10 is not a rung on a Savage Worlds
 * die ladder. With no definition to measure against, the value is made finite
 * and integral and otherwise left alone: normalisation exists to stop a
 * malformed field crashing the sheet, not to enforce a ruleset nobody declared.
 *
 * A `die-ladder` attribute snaps to the nearest rung at or below the value, so a
 * d7 written by a bad import reads as d6 rather than as an off-ladder number the
 * stepper cannot move.
 */
function normalizeAttribute(value: unknown, definition: AttributeDefinition | undefined): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!definition) return Number.isFinite(num) ? Math.round(num) : 0;
  if (!Number.isFinite(num)) return definition.min;

  const clamped = clampNumber(num, definition.min, definition.max, definition.min);
  const ladder = definition.scale?.kind === 'die-ladder' ? definition.scale.ladder : null;
  if (!ladder || ladder.length === 0 || ladder.includes(clamped)) return clamped;

  // `allowsPlus` extends past the top rung (d12+1, d12+2), so anything above it
  // stays as written rather than being snapped back down to d12.
  const top = Math.max(...ladder);
  if (definition.scale?.allowsPlus && clamped > top) return clamped;

  const below = ladder.filter(rung => rung <= clamped);
  return below.length > 0 ? Math.max(...below) : Math.min(...ladder);
}

function normalizeResource(resource: CharacterResource | undefined): CharacterResource {
  const max = clampNumber(resource?.max, 0, 999, 0);
  const current = clampNumber(resource?.current, 0, max, 0);
  return { current, max };
}

function normalizeSkill(skill: CharacterSkill | undefined, max: number): CharacterSkill {
  return {
    value: clampNumber(skill?.value, 0, max, 0),
    trained: skill?.trained === true,
    dragonMarked: skill?.dragonMarked === true,
    demonMarked: skill?.demonMarked === true,
  };
}

/**
 * Coerces a character record into well-formed, in-range values without changing
 * its identity.
 *
 * @remarks
 * A defensive pass run so a malformed field — a string where a number belongs, a
 * `current` above its `max`, a missing array — cannot crash the sheet. Every
 * clamp is generic over whatever keys are present (metadata, attributes,
 * resources, wealth) rather than assuming one ruleset's field set, so a
 * Traveller or user-authored character is normalised as safely as a Dragonbane
 * one. Unrelated fields are spread through untouched.
 *
 * Pass the character's `SystemDefinition` and attribute bounds come from it.
 * Without one the range cannot be known, so a value is only made finite —
 * better than silently rewriting a legal score to fit a ruleset the character
 * does not use.
 *
 * `skillMax` is a separate option because the skill range lives on the
 * `SystemEngine`, and importing the engine here would close a cycle back
 * through `ActiveCharacterContext`. Callers that hold an engine should pass
 * `engine.skill.range.max`; the default matches the widest bundled system.
 *
 * @param character - The record to normalise.
 * @param options - The character's system definition, and its skill ceiling.
 */
export function normalizeCharacter(
  character: CharacterRecord,
  options?: { system?: SystemDefinition | null; skillMax?: number },
): CharacterRecord {
  const system = options?.system;
  const metadata = character.metadata ?? {};
  const attributeDefs = new Map((system?.attributes ?? []).map(a => [a.id, a]));
  const skillMax = options?.skillMax ?? 20;
  const resources = Object.fromEntries(
    Object.entries(character.resources ?? {}).map(([id, resource]) => [id, normalizeResource(resource)]),
  );
  const skills = Object.fromEntries(
    Object.entries(character.skills ?? {}).map(([id, skill]) => [id, normalizeSkill(skill, skillMax)]),
  );

  return {
    ...character,
    // Identity fields are declared per-system, so normalise whatever keys are
    // present rather than forcing one ruleset's field set onto every character.
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([id, value]) => [id, typeof value === 'string' ? value : '']),
    ),
    attributes: Object.fromEntries(
      Object.entries(character.attributes ?? {}).map(([id, value]) => [
        id,
        normalizeAttribute(value, attributeDefs.get(id)),
      ]),
    ),
    conditions: character.conditions ?? {},
    resources,
    skills,
    weapons: Array.isArray(character.weapons) ? character.weapons : [],
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    tinyItems: Array.isArray(character.tinyItems) ? character.tinyItems : [],
    storyBank: Array.isArray(character.storyBank) ? character.storyBank : [],
    abilities: Array.isArray(character.abilities) ? character.abilities : [],
    // Money is keyed by the system's own denomination ids, so clamp each entry
    // generically instead of assuming gold/silver/copper.
    wealth: Object.fromEntries(
      Object.entries(character.wealth ?? {}).map(([id, amount]) => [
        id,
        clampNumber(amount, 0, 999999, 0),
      ]),
    ),
    // Custom skill definitions are rendered as rows like any declared skill, so
    // an entry missing its id or name would surface as a nameless, unfixable
    // row. Dropping it loses the definition but never the stored value, which
    // stays in `skills` and can be re-declared.
    ...(character.customSkills
      ? {
          customSkills: character.customSkills.filter(
            skill =>
              !!skill &&
              typeof skill.id === 'string' && skill.id.length > 0 &&
              typeof skill.name === 'string' && skill.name.length > 0 &&
              typeof skill.categoryId === 'string',
          ),
        }
      : {}),
    derivedOverrides: character.derivedOverrides ?? {},
    uiState: character.uiState ?? { expandedSections: [] },
  };
}
