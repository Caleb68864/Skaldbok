import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CREATURE_STAT_FIELDS,
  partitionCreatureStats,
  resolveCreatureArmorStatId,
  resolveCreatureHealthStatId,
  resolveCreatureStatFields,
  summariseCreatureStats,
} from './creatureStats';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import type { SystemDefinition } from '../../types/system';
import { travellerSystem } from '../../systems/traveller';
import { classicFantasySystem } from '../../systems/classic-fantasy';

const creature = (stats: Record<string, number>): CreatureTemplate =>
  ({
    id: 'c1',
    campaignId: 'camp1',
    name: 'Wolf',
    category: 'animal',
    stats,
    attacks: [],
    abilities: [],
    skills: [],
    tags: [],
    status: 'active',
    createdAt: 'x',
    updatedAt: 'x',
    schemaVersion: 1,
  }) as CreatureTemplate;

describe('resolveCreatureStatFields', () => {
  it('falls back to the default block for a ruleset that declares none', () => {
    // Dragonbane deliberately declares nothing — the default set IS its block,
    // so its bestiary must be unchanged by all of this.
    expect(resolveCreatureStatFields(classicFantasySystem)).toEqual(DEFAULT_CREATURE_STAT_FIELDS);
    expect(resolveCreatureStatFields(null)).toEqual(DEFAULT_CREATURE_STAT_FIELDS);
  });

  it('uses the declared block when there is one', () => {
    expect(resolveCreatureStatFields(travellerSystem).map(f => f.id)).toEqual([
      'hp', 'armor', 'movement', 'str', 'dex', 'end',
    ]);
  });

  it('ignores an empty declaration rather than rendering no stats at all', () => {
    const empty = { creatures: { statFields: [] } } as unknown as SystemDefinition;
    expect(resolveCreatureStatFields(empty)).toEqual(DEFAULT_CREATURE_STAT_FIELDS);
  });
});

describe('health and armour stat ids', () => {
  it('default to the ids every stored creature already carries', () => {
    expect(resolveCreatureHealthStatId(null)).toBe('hp');
    expect(resolveCreatureArmorStatId(null)).toBe('armor');
    expect(resolveCreatureHealthStatId(classicFantasySystem)).toBe('hp');
  });

  it('resolve for Traveller, whose stat ids are deliberately the same', () => {
    // Traveller renames the *labels* (Hits/Armour/Speed) but keeps the stored
    // ids, so no existing creature is orphaned by the declaration.
    expect(resolveCreatureHealthStatId(travellerSystem)).toBe('hp');
  });
});

describe('partitionCreatureStats', () => {
  const fields = resolveCreatureStatFields(travellerSystem);

  it('reports a declared stat the creature has not recorded as 0', () => {
    const { declared } = partitionCreatureStats(creature({ hp: 12 }), fields);
    expect(declared.find(d => d.field.id === 'hp')?.value).toBe(12);
    expect(declared.find(d => d.field.id === 'dex')?.value).toBe(0);
  });

  it('surfaces a stored stat this ruleset does not declare', () => {
    // The opposite of the import rule, and deliberately so: this is a number
    // somebody already entered, and one you cannot see is one you cannot fix.
    const { undeclared } = partitionCreatureStats(creature({ hp: 12, ferocity: 3 }), fields);
    expect(undeclared).toEqual([{ id: 'ferocity', value: 3 }]);
  });

  it('has nothing undeclared when the block matches', () => {
    expect(partitionCreatureStats(creature({ hp: 1, armor: 2 }), fields).undeclared).toEqual([]);
  });
});

describe('summariseCreatureStats', () => {
  it('shows the summary-flagged stats, in declaration order, with abbreviations', () => {
    expect(summariseCreatureStats(creature({ hp: 12, armor: 1, movement: 8, str: 7 }), resolveCreatureStatFields(travellerSystem)))
      .toBe('Hits 12 · Armour 1 · Spd 8');
  });

  it('keeps the Dragonbane line the bestiary card always printed', () => {
    expect(summariseCreatureStats(creature({ hp: 9, armor: 2, movement: 10 }), DEFAULT_CREATURE_STAT_FIELDS))
      .toBe('HP 9 · Armor 2 · Mv 10');
  });

  it('shows every stat when none is flagged for the summary', () => {
    expect(summariseCreatureStats(creature({ a: 1, b: 2 }), [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ])).toBe('A 1 · B 2');
  });
});
