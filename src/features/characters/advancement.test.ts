import { describe, it, expect } from 'vitest';
import {
  isMarkedForAdvancement,
  advancementCandidates,
  countEarnedMarks,
  toggleSessionEvent,
  applyAdvance,
  clearMark,
  resetAdvancementChecks,
} from './advancement';
import type { CharacterRecord } from '../../types/character';
import type { SkillCategory } from '../../types/system';
import type { AdvancementModel } from '../systems/engine/types';

const advancement: AdvancementModel = {
  sessionEvents: [
    { id: 'combat', label: 'Participated in combat' },
    { id: 'explore', label: 'Explored a new location' },
  ],
  usesMarks: true,
  maxSkillValue: 18,
  rollPrompt: value => `Roll above ${value} on a d20 to advance`,
};

const categories: SkillCategory[] = [
  {
    id: 'core',
    name: 'Core',
    skills: [
      { id: 'axes', name: 'Axes', baseChance: 0 },
      { id: 'sneaking', name: 'Sneaking', baseChance: 0 },
      { id: 'healing', name: 'Healing', baseChance: 0 },
    ],
  },
];

const character = (skills: Record<string, Partial<CharacterRecord['skills'][string]>> = {}, checks = {}) =>
  ({ skills, advancementChecks: checks }) as unknown as CharacterRecord;

describe('isMarkedForAdvancement', () => {
  it('counts a dragon mark', () => {
    expect(isMarkedForAdvancement({ value: 10, trained: true, dragonMarked: true })).toBe(true);
  });

  it('counts a demon mark too', () => {
    // Dragonbane marks a skill on a critical failure as well as a critical
    // success — you learn from a disaster as much as a triumph.
    expect(isMarkedForAdvancement({ value: 10, trained: true, demonMarked: true })).toBe(true);
  });

  it('is false for an unmarked or missing skill', () => {
    expect(isMarkedForAdvancement({ value: 10, trained: true })).toBe(false);
    expect(isMarkedForAdvancement(undefined)).toBe(false);
  });
});

describe('advancementCandidates', () => {
  it('lists only marked skills, with the system\'s roll prompt', () => {
    const c = character({
      axes: { value: 12, trained: true, dragonMarked: true },
      sneaking: { value: 8, trained: true },
    });
    const out = advancementCandidates(categories, c, advancement);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'axes', value: 12, atCeiling: false });
    expect(out[0].prompt).toBe('Roll above 12 on a d20 to advance');
  });

  it('flags a skill already at the ceiling', () => {
    const c = character({ axes: { value: 18, trained: true, dragonMarked: true } });
    expect(advancementCandidates(categories, c, advancement)[0].atCeiling).toBe(true);
  });

  it('is empty when the system does not advance by marks', () => {
    // A ruleset that advances some other way gets the checklist without a roll
    // list it has no use for.
    const c = character({ axes: { value: 12, trained: true, dragonMarked: true } });
    expect(advancementCandidates(categories, c, { ...advancement, usesMarks: false })).toEqual([]);
  });

  it('is empty when the system has no advancement model at all', () => {
    const c = character({ axes: { value: 12, trained: true, dragonMarked: true } });
    expect(advancementCandidates(categories, c, null)).toEqual([]);
  });

  it('ignores a marked skill the categories do not declare', () => {
    // Callers pass resolved categories, so a custom skill IS declared there;
    // an id in neither is stale data and must not render a nameless row.
    const c = character({ ghost: { value: 5, trained: true, dragonMarked: true } });
    expect(advancementCandidates(categories, c, advancement)).toEqual([]);
  });
});

describe('countEarnedMarks', () => {
  it('counts ticked boxes', () => {
    expect(countEarnedMarks(character({}, { combat: true }), advancement)).toBe(1);
    expect(countEarnedMarks(character({}, { combat: true, explore: true }), advancement)).toBe(2);
  });

  it('ignores a stored key the system does not declare', () => {
    // A system edit that drops an event must not leave a phantom mark earned.
    expect(countEarnedMarks(character({}, { retired: true }), advancement)).toBe(0);
  });

  it('is 0 with no checklist and no model', () => {
    expect(countEarnedMarks(character(), advancement)).toBe(0);
    expect(countEarnedMarks(character({}, { combat: true }), null)).toBe(0);
  });
});

describe('toggleSessionEvent', () => {
  it('ticks an unticked box and unticks a ticked one', () => {
    const on = toggleSessionEvent(character(), 'combat');
    expect(on.advancementChecks).toEqual({ combat: true });
    expect(toggleSessionEvent({ advancementChecks: on.advancementChecks }, 'combat').advancementChecks).toEqual({});
  });

  it('leaves other boxes alone', () => {
    const out = toggleSessionEvent(character({}, { explore: true }), 'combat');
    expect(out.advancementChecks).toEqual({ explore: true, combat: true });
  });

  it('does not mutate the character it was given', () => {
    const c = character({}, { explore: true });
    toggleSessionEvent(c, 'combat');
    expect(c.advancementChecks).toEqual({ explore: true });
  });
});

describe('applyAdvance', () => {
  it('raises the skill by one and clears the mark', () => {
    const c = character({ axes: { value: 12, trained: true, dragonMarked: true } });
    const patch = applyAdvance(c, 'axes', advancement)!;
    expect(patch.skills.axes).toMatchObject({ value: 13, dragonMarked: false, demonMarked: false });
  });

  it('clears a demon mark on success too', () => {
    const c = character({ axes: { value: 12, trained: true, demonMarked: true } });
    expect(applyAdvance(c, 'axes', advancement)!.skills.axes).toMatchObject({ value: 13, demonMarked: false });
  });

  it('never exceeds the ceiling, but still clears the mark', () => {
    // Leaving the mark would offer the same dead roll again next session.
    const c = character({ axes: { value: 18, trained: true, dragonMarked: true } });
    const patch = applyAdvance(c, 'axes', advancement)!;
    expect(patch.skills.axes).toMatchObject({ value: 18, dragonMarked: false });
  });

  it('returns null for an unmarked skill, so a double-tap cannot advance twice', () => {
    const c = character({ axes: { value: 12, trained: true } });
    expect(applyAdvance(c, 'axes', advancement)).toBeNull();
  });

  it('returns null for a skill the character does not have', () => {
    expect(applyAdvance(character(), 'axes', advancement)).toBeNull();
  });

  it('preserves the trained flag and other skills', () => {
    const c = character({
      axes: { value: 12, trained: true, dragonMarked: true },
      healing: { value: 5, trained: false },
    });
    const patch = applyAdvance(c, 'axes', advancement)!;
    expect(patch.skills.axes.trained).toBe(true);
    expect(patch.skills.healing).toEqual({ value: 5, trained: false });
  });

  it('does not mutate the character it was given', () => {
    const c = character({ axes: { value: 12, trained: true, dragonMarked: true } });
    applyAdvance(c, 'axes', advancement);
    expect(c.skills.axes).toMatchObject({ value: 12, dragonMarked: true });
  });
});

describe('clearMark', () => {
  it('clears both marks without changing the value', () => {
    const c = character({ axes: { value: 12, trained: true, dragonMarked: true } });
    const patch = clearMark(c, 'axes')!;
    expect(patch.skills.axes).toMatchObject({ value: 12, dragonMarked: false, demonMarked: false });
  });

  it('returns null when there is no mark, so no pointless write happens', () => {
    expect(clearMark(character({ axes: { value: 12, trained: true } }), 'axes')).toBeNull();
  });
});

describe('resetAdvancementChecks', () => {
  it('empties the checklist', () => {
    expect(resetAdvancementChecks(character({}, { combat: true }))!.advancementChecks).toEqual({});
  });

  it('returns null when already empty', () => {
    expect(resetAdvancementChecks(character())).toBeNull();
    expect(resetAdvancementChecks(character({}, {}))).toBeNull();
  });
});
