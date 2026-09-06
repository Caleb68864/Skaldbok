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
  it('clamps to the ceiling the caller supplies', () => {
    const character = {
      ...createBlankCharacter('classic-fantasy'),
      skills: { axes: { value: 99, trained: false, dragonMarked: false, demonMarked: false } },
    } as unknown as CharacterRecord;

    expect(normalizeCharacter(character, { skillMax: 5 }).skills.axes.value).toBe(5);
    expect(normalizeCharacter(character).skills.axes.value).toBe(20);
  });
});
