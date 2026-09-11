import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CREATURE_STAT_FIELDS,
  newCreatureStatBlock,
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

describe('newCreatureStatBlock', () => {
  // The block every create flow starts from. Three of them wrote it by hand as
  // `{ hp, armor: 0, movement: 0 }` — Dragonbane's ids applied to every ruleset,
  // which is a `systemId ===` branch with no `systemId` in it.
  const authored = {
    creatures: {
      healthStatId: 'wounds',
      armorStatId: 'soak',
      statFields: [
        { id: 'wounds', label: 'Wounds' },
        { id: 'soak', label: 'Soak' },
        { id: 'pace', label: 'Pace' },
      ],
    },
  } as unknown as SystemDefinition;

  it('is the default block for a ruleset that declares none', () => {
    // Dragonbane behaviour is unchanged, which is what the default set is for.
    expect(newCreatureStatBlock(classicFantasySystem, { health: 7 })).toEqual({
      hp: 7, armor: 0, movement: 0,
    });
    expect(newCreatureStatBlock(null)).toEqual({ hp: 0, armor: 0, movement: 0 });
  });

  it("uses the ruleset's own ids, and none of Dragonbane's", () => {
    expect(newCreatureStatBlock(authored, { health: 3 })).toEqual({
      wounds: 3, soak: 0, pace: 0,
    });
    // Asserted separately because this is the live defect: an NPC captured under
    // an authored ruleset was stored with `hp`/`armor`/`movement`, which that
    // ruleset does not declare — so the bestiary showed its three declared stats
    // all reading 0 and filed the numbers actually entered under "Other".
    expect(Object.keys(newCreatureStatBlock(authored, { health: 3 }))).not.toContain('hp');
  });

  it('declares every field the ruleset names, not the first three', () => {
    expect(Object.keys(newCreatureStatBlock(travellerSystem))).toEqual([
      'hp', 'armor', 'movement', 'str', 'dex', 'end',
    ]);
  });

  it('always carries the health stat, even when statFields omits it', () => {
    // `resolveCreatureHealthStatId` is what a participant's starting health is
    // read from, so the key it names has to exist on a creature this app made.
    const odd = {
      creatures: { healthStatId: 'vitality', statFields: [{ id: 'soak', label: 'Soak' }] },
    } as unknown as SystemDefinition;
    expect(newCreatureStatBlock(odd, { health: 5 })).toEqual({ soak: 0, vitality: 5 });
  });
});
