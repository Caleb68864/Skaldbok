import { describe, it, expect } from 'vitest';
import { groupMembers, groupFor, trainGroupAtZero, groupHasEveryMember } from './skillGroups';
import type { CharacterSkill } from '../../types/character';
import type { SkillCategory, SkillGroupDefinition } from '../../types/system';

const groups: SkillGroupDefinition[] = [
  { id: 'gunCombat', name: 'Gun Combat' },
  { id: 'drive', name: 'Drive' },
];

const categories: SkillCategory[] = [
  {
    id: 'combat',
    name: 'Combat',
    skills: [
      { id: 'gunCombat', name: 'Gun Combat (Slug)', baseChance: 0, groupId: 'gunCombat' },
      { id: 'gunCombatEnergy', name: 'Gun Combat (Energy)', baseChance: 0, groupId: 'gunCombat' },
      { id: 'gunCombatArchaic', name: 'Gun Combat (Archaic)', baseChance: 0, groupId: 'gunCombat' },
      { id: 'medic', name: 'Medic', baseChance: 0 },
    ],
  },
  {
    id: 'vehicles',
    name: 'Space & Vehicles',
    skills: [
      { id: 'drive', name: 'Drive (Wheeled)', baseChance: 0, groupId: 'drive' },
      { id: 'driveTracked', name: 'Drive (Tracked)', baseChance: 0, groupId: 'drive' },
    ],
  },
];

const gunCombat = groupMembers(categories, 'gunCombat');

describe('groupMembers', () => {
  it('collects a group in definition order', () => {
    expect(gunCombat.map(s => s.id)).toEqual(['gunCombat', 'gunCombatEnergy', 'gunCombatArchaic']);
  });

  it('spans categories', () => {
    // Groups are declared flat on the system precisely so they need not nest
    // inside one category.
    const spanning: SkillCategory[] = [
      { id: 'a', name: 'A', skills: [{ id: 'x', name: 'X (One)', baseChance: 0, groupId: 'g' }] },
      { id: 'b', name: 'B', skills: [{ id: 'y', name: 'X (Two)', baseChance: 0, groupId: 'g' }] },
    ];
    expect(groupMembers(spanning, 'g').map(s => s.id)).toEqual(['x', 'y']);
  });

  it('returns nothing for an unknown group', () => {
    expect(groupMembers(categories, 'nope')).toEqual([]);
  });
});

describe('groupFor', () => {
  it('resolves a skill to its group', () => {
    expect(groupFor(groups, categories[0].skills[0])?.name).toBe('Gun Combat');
  });

  it('is undefined for a standalone skill', () => {
    expect(groupFor(groups, categories[0].skills[3])).toBeUndefined();
  });

  it('is undefined when the system declares no groups', () => {
    // A system predating skill groups must render exactly as before.
    expect(groupFor(undefined, categories[0].skills[0])).toBeUndefined();
  });
});

describe('trainGroupAtZero', () => {
  it('adds every missing speciality at level 0, trained', () => {
    const out = trainGroupAtZero({}, gunCombat);
    expect(out).toEqual({
      gunCombat: { value: 0, trained: true },
      gunCombatEnergy: { value: 0, trained: true },
      gunCombatArchaic: { value: 0, trained: true },
    });
  });

  it('never overwrites a speciality the character already has', () => {
    // The whole risk of a bulk action: silently flattening a real level.
    const existing: Record<string, CharacterSkill> = { gunCombat: { value: 3, trained: true } };
    const out = trainGroupAtZero(existing, gunCombat);
    expect(out.gunCombat).toEqual({ value: 3, trained: true });
    expect(out.gunCombatEnergy).toEqual({ value: 0, trained: true });
  });

  it('leaves an untrained-at-0 entry alone rather than training it', () => {
    // An explicit "I do not have this" must not be flipped by a bulk action.
    const existing: Record<string, CharacterSkill> = { gunCombatEnergy: { value: 0, trained: false } };
    expect(trainGroupAtZero(existing, gunCombat).gunCombatEnergy).toEqual({ value: 0, trained: false });
  });

  it('preserves skills outside the group', () => {
    const existing: Record<string, CharacterSkill> = { medic: { value: 2, trained: true } };
    expect(trainGroupAtZero(existing, gunCombat).medic).toEqual({ value: 2, trained: true });
  });

  it('is idempotent', () => {
    const once = trainGroupAtZero({}, gunCombat);
    expect(trainGroupAtZero(once, gunCombat)).toEqual(once);
  });

  it('returns the same bag when nothing is missing, so a no-op skips the save', () => {
    const full = trainGroupAtZero({}, gunCombat);
    expect(trainGroupAtZero(full, gunCombat)).toBe(full);
  });

  it('does not mutate the bag it was given', () => {
    const existing: Record<string, CharacterSkill> = {};
    trainGroupAtZero(existing, gunCombat);
    expect(existing).toEqual({});
  });
});

describe('groupHasEveryMember', () => {
  it('is false while a speciality is missing', () => {
    expect(groupHasEveryMember({ gunCombat: { value: 1, trained: true } }, gunCombat)).toBe(false);
  });

  it('is true once every speciality has an entry', () => {
    expect(groupHasEveryMember(trainGroupAtZero({}, gunCombat), gunCombat)).toBe(true);
  });

  it('counts an untrained entry as present, matching what the action would do', () => {
    const skills: Record<string, CharacterSkill> = {
      gunCombat: { value: 0, trained: false },
      gunCombatEnergy: { value: 0, trained: false },
      gunCombatArchaic: { value: 0, trained: false },
    };
    expect(groupHasEveryMember(skills, gunCombat)).toBe(true);
  });

  it('is false for an empty group rather than vacuously true', () => {
    // [].every() is true; a group with no members must not read as complete.
    expect(groupHasEveryMember({}, [])).toBe(false);
  });
});
