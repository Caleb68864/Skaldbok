import { describe, it, expect } from 'vitest';
import { getEngine } from './index';
import { classicFantasyEngine } from './classicFantasyEngine';
import { travellerSystem } from '../../../systems/traveller';
import { classicFantasySystem } from '../../../systems/classic-fantasy';
import type { SystemDefinition } from '../../../types/system';

/**
 * Covers the last two code→data moves on the engine roadmap: `panels` and
 * `currency.denominations` declared in system.json.
 *
 * @remarks
 * The interesting case is not that the values arrive — it is that `formatAmount`
 * moves with them. An adapter's formatter closes over its own hardcoded coin
 * list, so a declaration could otherwise change the purse and the inputs while
 * every total in the ledger kept decomposing against the adapter's coins.
 */

/**
 * classic-fantasy with `overrides` folded in — the adapter is unchanged.
 *
 * @remarks
 * Each variant gets its own version because `getEngine` memoises on
 * `id@version`. Reusing one version across variants silently returns the first
 * one's engine for all of them, which is a test that passes by not running.
 */
let variant = 0;
const withOverrides = (overrides: Partial<SystemDefinition>): SystemDefinition =>
  ({
    ...classicFantasySystem,
    ...overrides,
    version: classicFantasySystem.version + 1000 + ++variant,
  } as SystemDefinition);

describe('panels', () => {
  it('takes the adapter list when the system declares none', () => {
    expect(getEngine(classicFantasySystem).panels).toEqual(classicFantasyEngine.panels);
  });

  it('replaces the adapter list wholesale when declared', () => {
    const engine = getEngine(withOverrides({ panels: ['skills', 'notes'] }));
    expect(engine.panels).toEqual(['skills', 'notes']);
  });

  it('is what Traveller now ships from JSON', () => {
    // Moved out of the adapter; if the JSON is dropped the tab row empties.
    expect(travellerSystem.panels).toBeDefined();
    expect(getEngine(travellerSystem).panels).toEqual(travellerSystem.panels);
  });
});

describe('currency', () => {
  it('takes the adapter money when the system declares none', () => {
    const engine = getEngine(classicFantasySystem);
    expect(engine.currency.denominations).toEqual(classicFantasyEngine.currency.denominations);
    expect(engine.currency.formatAmount(123)).toBe(classicFantasyEngine.currency.formatAmount(123));
  });

  it('renames the purse without touching the coins', () => {
    const engine = getEngine(withOverrides({ currency: { label: 'Purse' } }));
    expect(engine.currency.label).toBe('Purse');
    expect(engine.currency.denominations).toEqual(classicFantasyEngine.currency.denominations);
  });

  it('rebuilds formatAmount around declared denominations', () => {
    // The trap this test exists for: without rebuilding, this would still
    // format as Dragonbane gold/silver/copper.
    const engine = getEngine(withOverrides({
      currency: {
        baseDenominationId: 'bit',
        denominations: [
          { id: 'slab', label: 'Slabs', abbr: 'sl', value: 20 },
          { id: 'bit', label: 'Bits', abbr: 'b', value: 1 },
        ],
      },
    }));
    expect(engine.currency.formatAmount(43)).toBe('2sl 3b');
    expect(engine.currency.baseDenominationId).toBe('bit');
  });

  it('keeps read and write from the adapter, which knows where money lives', () => {
    const engine = getEngine(withOverrides({
      currency: { denominations: [{ id: 'bit', label: 'Bits', abbr: 'b', value: 1 }] },
    }));
    expect(engine.currency.read).toBe(classicFantasyEngine.currency.read);
    expect(engine.currency.write).toBe(classicFantasyEngine.currency.write);
  });

  it('formats Traveller credits identically now they come from JSON', () => {
    // The adapter used to hand-write "Cr 15,000"; the shared builder derives the
    // space from the abbreviation being a word. A regression here is visible on
    // every ledger row.
    expect(getEngine(travellerSystem).currency.formatAmount(15_000)).toBe('Cr 15,000');
    expect(getEngine(travellerSystem).currency.formatAmount(-15_000)).toBe('-Cr 15,000');
  });

  it('keeps a symbol abbreviation tight against the number', () => {
    const engine = getEngine(withOverrides({
      currency: { denominations: [{ id: 'cash', label: 'Cash', abbr: '$', value: 1 }] },
    }));
    expect(engine.currency.formatAmount(1000)).toBe('$1,000');
  });
});
