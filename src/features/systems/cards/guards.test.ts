import { describe, it, expect } from 'vitest';
import { GUARDS } from './guards';
import type { SystemEngine } from '../engine/types';

function fakeEngine(overrides: Partial<SystemEngine> = {}): SystemEngine {
  return {
    hasMagic: false,
    rest: null,
    damageTrack: null,
    currency: { mode: 'coins', label: 'Coins', denominations: [], read: () => ({}), write: () => ({}) },
    ...overrides,
  } as unknown as SystemEngine;
}

describe('GUARDS', () => {
  it('has a predicate for every CardGuard value', () => {
    expect(Object.keys(GUARDS).sort()).toEqual(
      ['always', 'hasMagic', 'hasRest', 'hasDamageTrack', 'hasCurrency', 'hasStoryBank'].sort(),
    );
  });

  it('always is always true', () => {
    expect(GUARDS.always(fakeEngine())).toBe(true);
  });

  it('hasMagic reflects engine.hasMagic', () => {
    expect(GUARDS.hasMagic(fakeEngine({ hasMagic: true }))).toBe(true);
    expect(GUARDS.hasMagic(fakeEngine({ hasMagic: false }))).toBe(false);
  });

  it('hasRest is true only when engine.rest is non-null', () => {
    expect(GUARDS.hasRest(fakeEngine({ rest: null }))).toBe(false);
    expect(GUARDS.hasRest(fakeEngine({ rest: [] }))).toBe(true);
  });

  it('hasDamageTrack is true only when engine.damageTrack is non-null', () => {
    expect(GUARDS.hasDamageTrack(fakeEngine({ damageTrack: null }))).toBe(false);
    expect(
      GUARDS.hasDamageTrack(fakeEngine({ damageTrack: {} as SystemEngine['damageTrack'] })),
    ).toBe(true);
  });

  it('hasCurrency is true only when there are denominations', () => {
    expect(
      GUARDS.hasCurrency(
        fakeEngine({
          currency: { mode: 'coins', label: 'Coins', denominations: [], read: () => ({}), write: () => ({}) },
        }),
      ),
    ).toBe(false);
    expect(
      GUARDS.hasCurrency(
        fakeEngine({
          currency: {
            mode: 'coins',
            label: 'Coins',
            denominations: [{ id: 'gold', label: 'Gold' }] as SystemEngine['currency']['denominations'],
            read: () => ({}),
            write: () => ({}),
          },
        }),
      ),
    ).toBe(true);
  });

  it('hasStoryBank is always true', () => {
    expect(GUARDS.hasStoryBank(fakeEngine())).toBe(true);
  });
});
