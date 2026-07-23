import { describe, it, expect } from 'vitest';
import {
  migrateCharacter,
  migrateCharacterV1ToV2,
  migrateCharacterV2ToV3,
  upgradeCharacter,
  CURRENT_SCHEMA_VERSION,
} from './migrations';

/**
 * Migrations rewrite persisted character records, so a bug here is silent and
 * destructive rather than a compile error. These tests assert the actual
 * before/after shape rather than just that the code runs.
 */

/** A v1 Dragonbane character as it would have been stored before v2. */
function v1Dragonbane(overrides: Record<string, unknown> = {}) {
  return {
    id: 'char-1',
    schemaVersion: 1,
    systemId: 'classic-fantasy',
    name: 'Bram',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    metadata: { kin: 'Dwarf', profession: 'Knight', age: '40', weakness: 'Greedy', appearance: '', notes: '' },
    attributes: { str: 14, con: 12, agl: 10, int: 9, wil: 11, cha: 8 },
    conditions: { exhausted: false },
    resources: { hp: { current: 8, max: 12 }, wp: { current: 5, max: 11 } },
    skills: { axes: { value: 12, trained: true } },
    weapons: [],
    armor: null,
    helmet: null,
    inventory: [],
    tinyItems: ['chalk'],
    memento: 'A carved ring',
    coins: { gold: 3, silver: 7, copper: 11 },
    spells: [],
    heroicAbilities: [],
    derivedOverrides: {},
    uiState: { expandedSections: [] },
    ...overrides,
  };
}

/** A v1 Traveller character, whose money lived inside the system-specific bag. */
function v1Traveller(overrides: Record<string, unknown> = {}) {
  return {
    ...v1Dragonbane(),
    id: 'char-2',
    systemId: 'traveller',
    name: 'Kestrel',
    attributes: { str: 7, dex: 9, end: 7, int: 7, edu: 7, soc: 7 },
    resources: { str: { current: 7, max: 7 }, dex: { current: 9, max: 9 }, end: { current: 7, max: 7 } },
    coins: { gold: 0, silver: 0, copper: 0 },
    travellerData: {
      credits: 2500,
      careers: 'Scout, 2 terms',
      financeNotes: 'Ship mortgage',
      species: 'Human',
      speciesTraits: '',
      augments: '',
    },
    ...overrides,
  };
}

describe('migrateCharacterV1ToV2', () => {
  it('moves coins into wealth keyed by denomination', () => {
    const out = migrateCharacterV1ToV2(v1Dragonbane()) as Record<string, unknown>;
    expect(out.wealth).toEqual({ gold: 3, silver: 7, copper: 11 });
    expect(out).not.toHaveProperty('coins');
  });

  it('moves traveller credits into wealth and the rest into systemData', () => {
    const out = migrateCharacterV1ToV2(v1Traveller()) as Record<string, unknown>;
    expect((out.wealth as Record<string, number>).credits).toBe(2500);
    expect(out.systemData).toEqual({
      careers: 'Scout, 2 terms',
      financeNotes: 'Ship mortgage',
      species: 'Human',
      speciesTraits: '',
      augments: '',
    });
    expect(out).not.toHaveProperty('travellerData');
    // credits belong to wealth now, not the system bag
    expect(out.systemData).not.toHaveProperty('credits');
  });

  it('stamps the new schema version', () => {
    const out = migrateCharacterV1ToV2(v1Dragonbane()) as Record<string, unknown>;
    expect(out.schemaVersion).toBe(2);
  });

  it('preserves every unrelated field', () => {
    const input = v1Dragonbane();
    const out = migrateCharacterV1ToV2(input) as Record<string, unknown>;
    expect(out.name).toBe('Bram');
    expect(out.attributes).toEqual(input.attributes);
    expect(out.skills).toEqual(input.skills);
    expect(out.tinyItems).toEqual(['chalk']);
    expect(out.memento).toBe('A carved ring');
    expect(out.resources).toEqual(input.resources);
  });

  it('is idempotent — re-running does not clobber migrated data', () => {
    const once = migrateCharacterV1ToV2(v1Traveller());
    const twice = migrateCharacterV1ToV2(once);
    expect(twice).toEqual(once);
  });

  it('handles a record with no money at all', () => {
    const bare = v1Dragonbane({ coins: undefined });
    delete (bare as Record<string, unknown>).coins;
    const out = migrateCharacterV1ToV2(bare) as Record<string, unknown>;
    expect(out.wealth).toEqual({});
  });
});

describe('migrateCharacter (full ladder + validation)', () => {
  it('migrates a v1 Dragonbane record and validates it', () => {
    const out = migrateCharacter(v1Dragonbane());
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.wealth).toEqual({ gold: 3, silver: 7, copper: 11 });
    expect(out.metadata.kin).toBe('Dwarf');
  });

  it('migrates a v1 Traveller record and validates it', () => {
    const out = migrateCharacter(v1Traveller());
    expect(out.wealth.credits).toBe(2500);
    expect(out.systemData?.careers).toBe('Scout, 2 terms');
  });

  it('accepts a record missing every Dragonbane-only collection', () => {
    const lean = v1Traveller();
    for (const key of ['spells', 'heroicAbilities', 'tinyItems', 'memento', 'weapons', 'inventory']) {
      delete (lean as Record<string, unknown>)[key];
    }
    const out = migrateCharacter(lean);
    // Defaults fill in, so consumers still see the non-optional shape.
    expect(out.spells).toEqual([]);
    expect(out.heroicAbilities).toEqual([]);
    expect(out.tinyItems).toEqual([]);
    expect(out.memento).toBe('');
  });

  it('accepts metadata with system-specific identity fields', () => {
    const out = migrateCharacter(
      v1Traveller({ metadata: { species: 'Aslan', homeworld: 'Regina' } }),
    );
    expect(out.metadata.species).toBe('Aslan');
    expect(out.metadata.homeworld).toBe('Regina');
  });

  it('leaves an already-v2 record alone', () => {
    const v2 = migrateCharacter(v1Dragonbane());
    const again = migrateCharacter(v2);
    expect(again.wealth).toEqual({ gold: 3, silver: 7, copper: 11 });
    expect(again.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('throws a descriptive error on genuinely invalid data', () => {
    expect(() => migrateCharacter({ schemaVersion: 1, id: '', name: 5 })).toThrow(/Invalid character data/);
  });
});

describe('migrateCharacterV2ToV3 (namespaced stat keys)', () => {
  const v2WithModifiers = () => ({
    ...v1Dragonbane(),
    schemaVersion: 2,
    wealth: { gold: 1 },
    tempModifiers: [
      {
        id: 'm1',
        label: 'Blessing',
        duration: 'stretch',
        createdAt: '2026-01-01T00:00:00.000Z',
        effects: [
          { stat: 'str', delta: 2 },
          { stat: 'armor', delta: 1 },
          { stat: 'movement', delta: -2 },
          { stat: 'hpMax', delta: 3 },
        ],
      },
    ],
    spells: [
      { id: 's1', name: 'Shield', school: 'Protection', powerLevel: 1, wpCost: 2, range: 'Self', duration: 'Round', summary: '', effects: [{ stat: 'helmet', delta: 2, duration: 'round' }] },
    ],
  });

  it('namespaces attribute, armour and derived targets', () => {
    const out = migrateCharacterV2ToV3(v2WithModifiers()) as Record<string, unknown>;
    const effects = (out.tempModifiers as Array<{ effects: Array<{ stat: string }> }>)[0].effects;
    expect(effects.map(e => e.stat)).toEqual([
      'attr:str',
      'armor:armor',
      'derived:movement',
      'derived:hpMax',
    ]);
  });

  it('namespaces spell effect templates too', () => {
    const out = migrateCharacterV2ToV3(v2WithModifiers()) as Record<string, unknown>;
    const spell = (out.spells as Array<{ effects: Array<{ stat: string }> }>)[0];
    expect(spell.effects[0].stat).toBe('armor:helmet');
  });

  it('leaves already-namespaced keys untouched and is idempotent', () => {
    const once = migrateCharacterV2ToV3(v2WithModifiers());
    const twice = migrateCharacterV2ToV3(once);
    expect(twice).toEqual(once);
  });

  it('preserves delta values and modifier metadata', () => {
    const out = migrateCharacterV2ToV3(v2WithModifiers()) as Record<string, unknown>;
    const mod = (out.tempModifiers as Array<Record<string, unknown>>)[0];
    expect(mod.label).toBe('Blessing');
    expect(mod.duration).toBe('stretch');
    expect((mod.effects as Array<{ delta: number }>).map(e => e.delta)).toEqual([2, 1, -2, 3]);
  });

  it('tolerates a character with no modifiers or spells', () => {
    const bare = { ...v1Dragonbane(), schemaVersion: 2, wealth: {} };
    delete (bare as Record<string, unknown>).spells;
    expect(() => migrateCharacterV2ToV3(bare)).not.toThrow();
  });
});

describe('upgradeCharacter (read path)', () => {
  it('brings a stored v1 record forward without validating', () => {
    const out = upgradeCharacter(v1Dragonbane());
    expect(out.wealth).toEqual({ gold: 3, silver: 7, copper: 11 });
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('does not throw on a record the strict schema would reject', () => {
    // A single malformed field must not stop the whole library from loading.
    const damaged = v1Dragonbane({ resources: 'not-an-object' });
    expect(() => upgradeCharacter(damaged)).not.toThrow();
    expect(() => migrateCharacter(damaged)).toThrow();
  });

  it('leaves an already-current record untouched', () => {
    const v2 = upgradeCharacter(v1Traveller());
    expect(upgradeCharacter(v2)).toEqual(v2);
  });
});
