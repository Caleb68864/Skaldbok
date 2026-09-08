import { describe, it, expect } from 'vitest';
import { normalizeCharacter } from './characterNormalization';
import { createBlankCharacter } from '../features/characters/characterMappers';
import type { SystemDefinition } from '../types/system';
import type { CharacterRecord } from '../types/character';

/**
 * Normalisation runs on every save. It used to clamp attributes to `1..30` and
 * default them to `10` — Dragonbane's range and a Dragonbane starting value,
 * applied to every character in every system.
 */

function withAttributes(attributes: Record<string, unknown>): CharacterRecord {
  return { ...createBlankCharacter('classic-fantasy'), attributes } as unknown as CharacterRecord;
}

const TRAVELLER = {
  id: 'traveller',
  attributes: [
    { id: 'str', name: 'Strength', abbreviation: 'STR', min: 0, max: 15 },
    { id: 'edu', name: 'Education', abbreviation: 'EDU', min: 0, max: 15 },
  ],
} as unknown as SystemDefinition;

const SAVAGE = {
  id: 'savage-worlds',
  attributes: [
    {
      id: 'agility',
      name: 'Agility',
      abbreviation: 'AGI',
      min: 4,
      max: 12,
      scale: { kind: 'die-ladder', ladder: [4, 6, 8, 10, 12], allowsPlus: true },
    },
  ],
} as unknown as SystemDefinition;

describe('normalizeCharacter attributes', () => {
  it('keeps a legal zero when the system allows it', () => {
    // The regression: Traveller declares min 0, and a characteristic of 0 is a
    // real state (unconscious, or a wound track emptied). It became 1 on save.
    const out = normalizeCharacter(withAttributes({ str: 0 }), { system: TRAVELLER });
    expect(out.attributes.str).toBe(0);
  });

  it('clamps to the system range, not to 1..30', () => {
    const out = normalizeCharacter(withAttributes({ str: 40, edu: -5 }), { system: TRAVELLER });
    expect(out.attributes.str).toBe(15);
    expect(out.attributes.edu).toBe(0);
  });

  it('falls back to the declared minimum, not to 10', () => {
    const out = normalizeCharacter(withAttributes({ str: 'nonsense' }), { system: TRAVELLER });
    expect(out.attributes.str).toBe(0);
  });

  it('snaps an off-ladder die to the rung below', () => {
    // A d7 from a bad import is a value the stepper cannot move off.
    const out = normalizeCharacter(withAttributes({ agility: 7 }), { system: SAVAGE });
    expect(out.attributes.agility).toBe(6);
  });

  it('leaves a value on the ladder alone', () => {
    const out = normalizeCharacter(withAttributes({ agility: 10 }), { system: SAVAGE });
    expect(out.attributes.agility).toBe(10);
  });

  it('keeps a d12+ value when the ladder allows the extension', () => {
    const out = normalizeCharacter(withAttributes({ agility: 12 }), { system: SAVAGE });
    expect(out.attributes.agility).toBe(12);
  });

  it('only coerces to a finite integer when the system is unknown', () => {
    // Better than imposing bounds from a ruleset this character does not use.
    const out = normalizeCharacter(withAttributes({ str: 0, mystery: 99, bad: 'x' }));
    expect(out.attributes.str).toBe(0);
    expect(out.attributes.mystery).toBe(99);
    expect(out.attributes.bad).toBe(0);
  });

  it('rounds a fractional score', () => {
    const out = normalizeCharacter(withAttributes({ str: 7.6 }), { system: TRAVELLER });
    expect(out.attributes.str).toBe(8);
  });

  it('leaves an attribute the system does not declare uncoerced by other ranges', () => {
    const out = normalizeCharacter(withAttributes({ psi: 0 }), { system: TRAVELLER });
    expect(out.attributes.psi).toBe(0);
  });
});

describe('normalizeCharacter skills', () => {
  const wideSkill = (value: number): CharacterRecord => ({
    ...createBlankCharacter('classic-fantasy'),
    skills: { axes: { value, trained: false, dragonMarked: false, demonMarked: false } },
  } as unknown as CharacterRecord);

  it('clamps to the range the caller supplies', () => {
    expect(normalizeCharacter(wideSkill(99), { skillRange: { min: 0, max: 5 } }).skills.axes.value).toBe(5);
  });

  it('leaves a value alone when no ruleset declares a range', () => {
    // The default used to be `0..20` — Dragonbane's ladder, applied on every
    // save. A user-authored percentile system was truncated from 75 to 20 with
    // no message, in the app whose headline feature is authoring your own
    // system.
    expect(normalizeCharacter(wideSkill(75)).skills.axes.value).toBe(75);
  });

  it('still coerces a malformed skill value to a number', () => {
    const character = {
      ...createBlankCharacter('classic-fantasy'),
      skills: { axes: { value: 'not a number', trained: false, dragonMarked: false, demonMarked: false } },
    } as unknown as CharacterRecord;
    expect(normalizeCharacter(character).skills.axes.value).toBe(0);
  });
});

describe('normalizeCharacter wealth', () => {
  const withWealth = (wealth: Record<string, unknown>): CharacterRecord =>
    ({ ...createBlankCharacter('classic-fantasy'), wealth } as unknown as CharacterRecord);

  it('keeps an amount past the old six-digit ceiling', () => {
    // 999,999 is a plausible Dragonbane hoard and roughly one Traveller trade
    // run. The literal truncated the purse on every save, silently.
    expect(normalizeCharacter(withWealth({ credits: 2_400_000 })).wealth.credits).toBe(2_400_000);
  });

  it('still rejects negatives and non-numbers', () => {
    const out = normalizeCharacter(withWealth({ credits: -50, silver: 'lots' }));
    expect(out.wealth.credits).toBe(0);
    expect(out.wealth.silver).toBe(0);
  });
});

describe('normalizeCharacter resources', () => {
  const withResources = (resources: Record<string, unknown>): CharacterRecord =>
    ({ ...createBlankCharacter('classic-fantasy'), resources } as unknown as CharacterRecord);

  it('keeps a pool past the old three-digit ceiling', () => {
    const out = normalizeCharacter(withResources({ hp: { current: 4000, max: 5000 } }));
    expect(out.resources.hp).toEqual({ current: 4000, max: 5000 });
  });

  it('holds current inside the pair, which is structural rather than a ruleset rule', () => {
    const out = normalizeCharacter(withResources({ hp: { current: 99, max: 10 } }));
    expect(out.resources.hp).toEqual({ current: 10, max: 10 });
  });

  it('takes the floor from the resource definition when the system declares one', () => {
    const system = {
      id: 'custom',
      attributes: [],
      resources: [{ id: 'morale', name: 'Morale', min: 5, defaultMax: 20 }],
    } as unknown as SystemDefinition;
    const out = normalizeCharacter(withResources({ morale: { current: 0, max: 20 } }), { system });
    expect(out.resources.morale).toEqual({ current: 5, max: 20 });
  });
});
