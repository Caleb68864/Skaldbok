import type { CharacterRecord, CharacterResource, CharacterSkill } from '../types/character';

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeResource(resource: CharacterResource | undefined): CharacterResource {
  const max = clampNumber(resource?.max, 0, 999, 0);
  const current = clampNumber(resource?.current, 0, max, 0);
  return { current, max };
}

function normalizeSkill(skill: CharacterSkill | undefined): CharacterSkill {
  return {
    value: clampNumber(skill?.value, 0, 20, 0),
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
 */
export function normalizeCharacter(character: CharacterRecord): CharacterRecord {
  const metadata = character.metadata ?? {};
  const resources = Object.fromEntries(
    Object.entries(character.resources ?? {}).map(([id, resource]) => [id, normalizeResource(resource)]),
  );
  const skills = Object.fromEntries(
    Object.entries(character.skills ?? {}).map(([id, skill]) => [id, normalizeSkill(skill)]),
  );

  return {
    ...character,
    // Identity fields are declared per-system, so normalise whatever keys are
    // present rather than forcing one ruleset's field set onto every character.
    metadata: Object.fromEntries(
      Object.entries(metadata).map(([id, value]) => [id, typeof value === 'string' ? value : '']),
    ),
    attributes: Object.fromEntries(
      Object.entries(character.attributes ?? {}).map(([id, value]) => [id, clampNumber(value, 1, 30, 10)]),
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
    derivedOverrides: character.derivedOverrides ?? {},
    uiState: character.uiState ?? { expandedSections: [] },
  };
}
