import { describe, it, expect } from 'vitest';
import { resolveDerivedField } from './derivedValues';
import { derivedKey, attrKey } from './statKeys';
import type { CharacterRecord, TempModifier } from '../types/character';

function modifier(stat: string, delta: number, label = 'Buff'): TempModifier {
  return {
    id: `mod-${stat}-${delta}`,
    label,
    effects: [{ stat, delta }],
    duration: 'scene',
    createdAt: '2026-08-08T00:00:00.000Z',
  } as TempModifier;
}

function character(overrides: Partial<CharacterRecord> = {}): CharacterRecord {
  return { derivedOverrides: {}, tempModifiers: [], ...overrides } as CharacterRecord;
}

const derived = { movement: 10, encumbranceLimit: 14, damageBonus: '+D6' };
const movement = { key: 'movement', overridable: true };

describe('resolveDerivedField', () => {
  it('returns the computed value when nothing modifies it', () => {
    const out = resolveDerivedField(character(), derived, movement);
    expect(out.display).toBe(10);
    expect(out.isModified).toBe(false);
    expect(out.override).toBeNull();
  });

  it('applies a temp modifier aimed at the field', () => {
    // The whole point: `derived:` modifiers were offered by the picker,
    // written by the UI, listed in the buff bar, and read by nothing.
    const c = character({ tempModifiers: [modifier(derivedKey('movement'), 2)] });
    expect(resolveDerivedField(c, derived, movement).display).toBe(12);
  });

  it('sums several modifiers on the same field', () => {
    const c = character({
      tempModifiers: [modifier(derivedKey('movement'), 2, 'Boots'), modifier(derivedKey('movement'), -3, 'Mud')],
    });
    expect(resolveDerivedField(c, derived, movement).display).toBe(9);
  });

  it('reports each modifier with its label, so the UI can explain the number', () => {
    const c = character({ tempModifiers: [modifier(derivedKey('movement'), 2, 'Boots of Speed')] });
    expect(resolveDerivedField(c, derived, movement).modifiers).toEqual([
      { label: 'Boots of Speed', delta: 2 },
    ]);
  });

  it('ignores a modifier aimed at a different field', () => {
    const c = character({ tempModifiers: [modifier(derivedKey('encumbranceLimit'), 5)] });
    expect(resolveDerivedField(c, derived, movement).display).toBe(10);
  });

  it('ignores a modifier in a different namespace with the same id', () => {
    // `attr:movement` and `derived:movement` are distinct targets — the whole
    // reason stat keys are namespaced.
    const c = character({ tempModifiers: [modifier(attrKey('movement'), 5)] });
    expect(resolveDerivedField(c, derived, movement).display).toBe(10);
  });

  it('lets an override replace the computed value', () => {
    const c = character({ derivedOverrides: { movement: 12 } });
    const out = resolveDerivedField(c, derived, movement);
    expect(out.display).toBe(12);
    expect(out.override).toBe(12);
    expect(out.computed).toBe(10);
  });

  it('applies modifiers on top of an override, not instead of it', () => {
    // Order is the rule: an override *replaces* the computed value ("mine is
    // 12"), a modifier *adjusts* whatever the value currently is.
    const c = character({
      derivedOverrides: { movement: 12 },
      tempModifiers: [modifier(derivedKey('movement'), 2)],
    });
    expect(resolveDerivedField(c, derived, movement).display).toBe(14);
  });

  it('ignores an override on a field the engine does not mark overridable', () => {
    const c = character({ derivedOverrides: { movement: 99 } });
    expect(resolveDerivedField(c, derived, { key: 'movement' }).display).toBe(10);
  });

  it('ignores a non-numeric override', () => {
    const c = character({ derivedOverrides: { movement: 'fast' } } as unknown as Partial<CharacterRecord>);
    expect(resolveDerivedField(c, derived, movement).display).toBe(10);
  });

  it('leaves a string-valued field alone but still reports the modifier', () => {
    // A +D6 damage bonus cannot take a numeric delta. Reporting it rather than
    // silently dropping it is what lets the UI show the user it did nothing.
    const c = character({ tempModifiers: [modifier(derivedKey('damageBonus'), 2)] });
    const out = resolveDerivedField(c, derived, { key: 'damageBonus', overridable: true });
    expect(out.display).toBe('+D6');
    expect(out.isModified).toBe(true);
    expect(out.modifiers).toHaveLength(1);
  });

  it('reports undefined for a field the engine does not compute', () => {
    // Callers skip these rather than rendering a blank tile.
    expect(resolveDerivedField(character(), derived, { key: 'ghost' }).display).toBeUndefined();
  });

  it('survives a character with no modifiers or overrides at all', () => {
    const bare = {} as CharacterRecord;
    expect(resolveDerivedField(bare, derived, movement).display).toBe(10);
  });
});
