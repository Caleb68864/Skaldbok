import { describe, it, expect } from 'vitest';
import { remakeCurrency } from './currency';
import type { CurrencyDenomination } from './../features/systems/engine/types';

const coins: CurrencyDenomination[] = [
  { id: 'gold', label: 'Gold', abbr: 'g', value: 100 },
  { id: 'silver', label: 'Silver', abbr: 's', value: 10 },
  { id: 'copper', label: 'Copper', abbr: 'c', value: 1 },
];
const credits: CurrencyDenomination[] = [{ id: 'credits', label: 'Credits', abbr: 'Cr', value: 1 }];

describe('remakeCurrency', () => {
  it('degenerates to plain addition for a single unit denomination', () => {
    expect(remakeCurrency(credits, { credits: 905 }, 'credits', -100)).toEqual({ credits: 805 });
    expect(remakeCurrency(credits, { credits: 5 }, 'credits', 1000)).toEqual({ credits: 1005 });
  });

  it('blocks a spend that would go negative (returns null)', () => {
    expect(remakeCurrency(credits, { credits: 5 }, 'credits', -10)).toBeNull();
    expect(remakeCurrency(coins, { gold: 0, silver: 0, copper: 3 }, 'copper', -5)).toBeNull();
  });

  it('re-makes change across denominations, keeping the compact form', () => {
    // 3 gold, spend 1 silver → 2 gold, 9 silver, 0 copper.
    expect(remakeCurrency(coins, { gold: 3, silver: 0, copper: 0 }, 'silver', -1)).toEqual({
      gold: 2,
      silver: 9,
      copper: 0,
    });
  });

  it('carries up when a lower denomination overflows', () => {
    // 9 silver + gain 1 silver = 100 copper-value → 1 gold.
    expect(remakeCurrency(coins, { gold: 0, silver: 9, copper: 0 }, 'silver', 1)).toEqual({
      gold: 1,
      silver: 0,
      copper: 0,
    });
  });

  it('returns null for an unknown denomination', () => {
    expect(remakeCurrency(credits, { credits: 10 }, 'gold', 5)).toBeNull();
  });
});
