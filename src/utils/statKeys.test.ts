import { describe, it, expect } from 'vitest';
import { statKey, parseStatKey, isNamespaced, attrKey, resKey } from './statKeys';
import { getEffectiveValue } from './derivedValues';
import type { CharacterRecord } from '../types/character';

describe('statKeys', () => {
  it('round-trips a namespaced key', () => {
    const key = statKey('attr', 'str');
    expect(key).toBe('attr:str');
    expect(parseStatKey(key)).toEqual({ namespace: 'attr', id: 'str' });
  });

  it('treats an unprefixed key as legacy', () => {
    expect(parseStatKey('str')).toEqual({ namespace: null, id: 'str' });
    expect(isNamespaced('str')).toBe(false);
    expect(isNamespaced('attr:str')).toBe(true);
  });

  it('does not mistake an unknown prefix for a namespace', () => {
    // A skill genuinely named "foo:bar" must not be parsed as namespace "foo".
    expect(parseStatKey('foo:bar')).toEqual({ namespace: null, id: 'foo:bar' });
  });
});

/**
 * A Traveller-shaped character: its damage-track resources deliberately share
 * ids with its characteristics, which is exactly the collision namespacing exists
 * to resolve.
 */
function travellerCharacter(): CharacterRecord {
  return {
    id: 'c1',
    schemaVersion: 3,
    systemId: 'traveller',
    name: 'Kestrel',
    createdAt: '', updatedAt: '',
    metadata: {},
    attributes: { str: 12, dex: 9, end: 7 },
    conditions: {},
    // Same ids as the attributes above, different values.
    resources: { str: { current: 4, max: 12 }, dex: { current: 2, max: 9 }, end: { current: 1, max: 7 } },
    skills: {},
    weapons: [], armor: null, helmet: null, inventory: [], tinyItems: [], memento: '',
    wealth: {}, abilities: [], derivedOverrides: {},
    uiState: { expandedSections: [] },
  } as unknown as CharacterRecord;
}

describe('getEffectiveValue with colliding resource and attribute ids', () => {
  it('resolves attr:str to the characteristic', () => {
    expect(getEffectiveValue(attrKey('str'), travellerCharacter()).base).toBe(12);
  });

  it('resolves res:str to the damage-track resource, not the characteristic', () => {
    // Before namespacing this returned 12 — the attribute always won.
    expect(getEffectiveValue(resKey('str'), travellerCharacter()).base).toBe(4);
  });

  it('keeps the two independent across every colliding id', () => {
    const c = travellerCharacter();
    expect([attrKey('dex'), resKey('dex'), attrKey('end'), resKey('end')].map(k => getEffectiveValue(k, c).base))
      .toEqual([9, 2, 7, 1]);
  });

  it('still resolves a legacy unprefixed key by the historic precedence', () => {
    // Attributes won before, and unmigrated data must keep doing so.
    expect(getEffectiveValue('str', travellerCharacter()).base).toBe(12);
  });

  it('applies temp modifiers to the namespaced target only', () => {
    const c = travellerCharacter();
    c.tempModifiers = [
      { id: 'm', label: 'Wound', duration: 'scene', createdAt: '', effects: [{ stat: resKey('end'), delta: -1 }] },
    ];
    expect(getEffectiveValue(resKey('end'), c).effective).toBe(0);
    // The characteristic is untouched.
    expect(getEffectiveValue(attrKey('end'), c).effective).toBe(7);
  });
});
