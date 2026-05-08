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
    metadata: {
      kin: metadata.kin ?? '',
      profession: metadata.profession ?? '',
      age: metadata.age ?? '',
      weakness: metadata.weakness ?? '',
      appearance: metadata.appearance ?? '',
      notes: metadata.notes ?? '',
    },
    attributes: Object.fromEntries(
      Object.entries(character.attributes ?? {}).map(([id, value]) => [id, clampNumber(value, 1, 30, 10)]),
    ),
    conditions: character.conditions ?? {},
    resources,
    skills,
    weapons: Array.isArray(character.weapons) ? character.weapons : [],
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    tinyItems: Array.isArray(character.tinyItems) ? character.tinyItems : [],
    spells: Array.isArray(character.spells) ? character.spells : [],
    heroicAbilities: Array.isArray(character.heroicAbilities) ? character.heroicAbilities : [],
    coins: {
      gold: clampNumber(character.coins?.gold, 0, 999999, 0),
      silver: clampNumber(character.coins?.silver, 0, 999999, 0),
      copper: clampNumber(character.coins?.copper, 0, 999999, 0),
    },
    derivedOverrides: character.derivedOverrides ?? {},
    uiState: character.uiState ?? { expandedSections: [] },
  };
}
