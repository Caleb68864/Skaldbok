import { describe, it, expect } from 'vitest';
import { getDerivedValue, getEffectiveValue, resolveDerivedField } from './derivedValues';
import type { CharacterRecord } from '../types/character';
import { derivedKey } from './statKeys';

/**
 * The derived block is an open map keyed by whatever the active engine computes,
 * not a fixed six Dragonbane keys.
 *
 * @remarks
 * Two things follow, and both are the point of the change: a ruleset can carry
 * derived stats Dragonbane never heard of, and a stat a ruleset does *not*
 * compute is absent rather than a plausible zero.
 */

const character = (overrides: Partial<CharacterRecord> = {}): CharacterRecord =>
  ({
    id: 'c1',
    name: 'Rurik',
    systemId: 'traveller',
    attributes: { str: 7, dex: 8, end: 6 },
    resources: {},
    skills: {},
    wealth: {},
    abilities: [],
    derivedOverrides: {},
    tempModifiers: [],
    ...overrides,
  }) as unknown as CharacterRecord;

describe('a ruleset-specific derived stat', () => {
  const travellerish = { initiativeDM: 2, encumbranceLimit: 84 };

  it('resolves through resolveDerivedField', () => {
    const resolved = resolveDerivedField(character(), travellerish, { key: 'initiativeDM' });
    expect(resolved.computed).toBe(2);
    expect(resolved.effective).toBe(2);
  });

  it('resolves through getDerivedValue when the engine block is supplied', () => {
    expect(getDerivedValue(character(), 'initiativeDM', travellerish).effective).toBe(2);
  });

  it('resolves through getEffectiveValue when the engine block is supplied', () => {
    // Without the block this key is unknown to Dragonbane's computation and
    // would resolve to 0 — the "every other ruleset's derived target is inert"
    // failure the open shape exists to end.
    expect(getEffectiveValue(derivedKey('initiativeDM'), character(), travellerish).effective).toBe(2);
    expect(getEffectiveValue(derivedKey('initiativeDM'), character()).effective).toBe(0);
  });

  it('carries temp modifiers on top of the engine value', () => {
    const buffed = character({
      tempModifiers: [
        { id: 'm1', label: 'Alert', effects: [{ stat: derivedKey('initiativeDM'), delta: 1 }] },
      ],
    } as Partial<CharacterRecord>);
    expect(getEffectiveValue(derivedKey('initiativeDM'), buffed, travellerish).effective).toBe(3);
    expect(resolveDerivedField(buffed, travellerish, { key: 'initiativeDM' }).effective).toBe(3);
  });
});

describe('a stat the ruleset does not compute', () => {
  it('is undefined rather than a plausible zero', () => {
    // Traveller has no willpower maximum. It used to return `wpMax: 0` because
    // the shape demanded it, and before that `hpMax: END` — which would print
    // as max HP for any system cloned from it.
    expect(getDerivedValue(character(), 'wpMax', { initiativeDM: 2 }).computed).toBeUndefined();
    expect(resolveDerivedField(character(), { initiativeDM: 2 }, { key: 'wpMax' }).computed)
      .toBeUndefined();
  });

  it('does not let a lookup table reach a sheet cell', () => {
    // An adapter may publish tables (Traveller's per-characteristic DMs) in the
    // same block. They are data for its own screens, never a field — rendering
    // one would print "[object Object]".
    const withTable = { characteristicDMs: { str: 0, dex: 1 } };
    expect(getDerivedValue(character(), 'characteristicDMs', withTable).computed).toBeUndefined();
    expect(resolveDerivedField(character(), withTable, { key: 'characteristicDMs' }).computed)
      .toBeUndefined();
  });
});
