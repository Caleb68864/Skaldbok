import { describe, it, expect } from 'vitest';
import { GUARDS } from './guards';
import type { SystemEngine } from '../engine/types';

function fakeEngine(overrides: Partial<SystemEngine> = {}): SystemEngine {
  return {
    hasMagic: false,
    rest: null,
    damageTrack: null,
    currency: {
      mode: 'coins',
      label: 'Coins',
      denominations: [],
      baseDenominationId: 'copper',
      formatAmount: () => '',
      read: () => ({}),
      write: () => ({}),
    },
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
          currency: {
            mode: 'coins',
            label: 'Coins',
            denominations: [],
            baseDenominationId: 'copper',
            formatAmount: () => '',
            read: () => ({}),
            write: () => ({}),
          },
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
            baseDenominationId: 'gold',
            formatAmount: () => '',
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

  it('has no inherited member that could pass as a guard', () => {
    // CardRenderer looks a template's `when` string up in this map. Plain
    // indexing reaches Object.prototype, so `when: "constructor"` resolved to
    // `Object`, and `Object(engine)` returns a truthy object — the guard that
    // exists to fail closed failed *open*, rendering a card the template said
    // to hide. Sheet templates are importable, so the string is untrusted.
    //
    // The renderer now checks own-property first. This asserts the shape that
    // makes the old bug reachable, so the risk stays visible here too.
    for (const key of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty']) {
      expect(
        Object.prototype.hasOwnProperty.call(GUARDS, key),
        `GUARDS must not own "${key}"`,
      ).toBe(false);
    }
    // The inherited value is callable and returns something truthy — which is
    // exactly why an own-property check, not a truthiness test, is required.
    const inherited = (GUARDS as unknown as Record<string, unknown>)['constructor'];
    expect(typeof inherited).toBe('function');
  });
});
