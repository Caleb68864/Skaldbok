import { describe, it, expect } from 'vitest';
import {
  abilityRows,
  attackRows,
  rowsToAbilities,
  rowsToAttacks,
  rowsToSkills,
  skillRows,
} from './creatureRows';

describe('round-tripping the list fields', () => {
  it('returns an attack unchanged through rows and back', () => {
    const attacks = [
      { name: 'Bite', damage: '2d6', range: 'Melee', skill: 'Melee (natural)', special: 'Knockdown' },
    ];
    expect(rowsToAttacks(attackRows(attacks))).toEqual(attacks);
  });

  it('returns abilities and skills unchanged', () => {
    const abilities = [{ name: 'Pack hunter', description: '+1 DM when flanking' }];
    const skills = [{ name: 'Survival', value: 2 }];
    expect(rowsToAbilities(abilityRows(abilities))).toEqual(abilities);
    expect(rowsToSkills(skillRows(skills))).toEqual(skills);
  });

  it('keeps an attack with only a name and damage — the imported shape', () => {
    const attacks = [{ name: 'Claw', damage: '3d6', range: '', skill: '' }];
    expect(rowsToAttacks(attackRows(attacks))).toEqual([
      { name: 'Claw', damage: '3d6', range: '', skill: '', special: undefined },
    ]);
  });
});

describe('rows that should not be stored', () => {
  it('drops a row added and then abandoned', () => {
    // The normal way to use an add/remove list: tap Add, change your mind.
    expect(rowsToAttacks([{ name: 'Bite', damage: '2d6' }, {}])).toHaveLength(1);
    expect(rowsToAbilities([{}, { name: 'Keen nose' }])).toHaveLength(1);
    expect(rowsToSkills([{ name: '', value: '3' }])).toEqual([]);
  });

  it('drops a row whose name is only whitespace', () => {
    expect(rowsToAttacks([{ name: '   ', damage: '2d6' }])).toEqual([]);
  });

  it('trims what it keeps', () => {
    expect(rowsToAttacks([{ name: '  Bite  ', damage: ' 2d6 ' }])[0]).toMatchObject({
      name: 'Bite',
      damage: '2d6',
    });
  });
});

describe('skill levels', () => {
  it('stores a blank level as 0 rather than NaN', () => {
    // NaN passes the type, serialises to null in an export and renders as "NaN"
    // on the stat block — a corrupt record that type-checks.
    expect(rowsToSkills([{ name: 'Survival', value: '' }])).toEqual([{ name: 'Survival', value: 0 }]);
  });

  it('stores an unparseable level as 0', () => {
    expect(rowsToSkills([{ name: 'Survival', value: 'two' }])).toEqual([{ name: 'Survival', value: 0 }]);
  });

  it('truncates a fractional level and keeps a negative one', () => {
    // Negative levels are real in Traveller — an unskilled check is DM-3.
    expect(rowsToSkills([{ name: 'A', value: '2.7' }, { name: 'B', value: '-3' }])).toEqual([
      { name: 'A', value: 2 },
      { name: 'B', value: -3 },
    ]);
  });
});

describe('optional fields', () => {
  it('omits an empty special rather than storing an empty string', () => {
    // The stat block prints `special` in brackets; an empty string prints "[]".
    expect(rowsToAttacks([{ name: 'Bite', special: '' }])[0].special).toBeUndefined();
  });
});
