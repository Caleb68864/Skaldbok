import { describe, it, expect } from 'vitest';
import { readCounter, readSpec, summariseCounters, vehicleSubtitle } from './vehicleView';
import type { Ship } from '../../types/ship';
import type { VehicleModel } from '../../types/system';
import { travellerSystem } from '../../systems/traveller';

const ship = (overrides: Partial<Ship> = {}): Ship => ({
  id: 's1',
  campaignId: 'c1',
  name: 'Nomad',
  counters: {
    hull: { current: 30, max: 40 },
    fuel: { current: 2, max: 22 },
    cargo: { current: 0, max: 82 },
  },
  specs: { shipClass: 'Free Trader' },
  weapons: [],
  crew: [],
  notes: '',
  schemaVersion: 2,
  createdAt: 'x',
  updatedAt: 'x',
  ...overrides,
});

const model: VehicleModel = {
  label: 'Ships',
  singular: 'Ship',
  counters: [
    { id: 'hull', label: 'Hull' },
    { id: 'fuel', label: 'Fuel' },
    { id: 'cargo', label: 'Cargo', unit: 't' },
  ],
  summaryCounterIds: ['hull', 'cargo', 'fuel'],
  subtitleSpecId: 'shipClass',
};

describe('summariseCounters', () => {
  it('renders the declared summary counters in declared order', () => {
    expect(summariseCounters(ship(), model)).toBe('Hull 30/40 · Cargo 0/82t · Fuel 2/22');
  });

  it('falls back to every declared counter when no summary is declared', () => {
    const { summaryCounterIds: _omitted, ...noSummary } = model;
    expect(summariseCounters(ship(), noSummary)).toBe('Hull 30/40 · Fuel 2/22 · Cargo 0/82t');
  });

  it('reads a counter the vehicle has not recorded as 0/0', () => {
    expect(summariseCounters(ship({ counters: {} }), model)).toBe('Hull 0/0 · Cargo 0/0t · Fuel 0/0');
  });

  it('summarises to nothing when the ruleset declares no vehicles', () => {
    // Callers join this into a line; a stray separator is the failure it avoids.
    expect(summariseCounters(ship(), null)).toBe('');
  });

  it('ignores a summary id that names no declared counter', () => {
    const broken = { ...model, summaryCounterIds: ['hull', 'shields'] };
    expect(summariseCounters(ship(), broken)).toBe('Hull 30/40');
  });
});

describe('vehicleSubtitle', () => {
  it('reads the declared subtitle spec', () => {
    expect(vehicleSubtitle(ship(), model)).toBe('Free Trader');
  });

  it('is empty when nothing is recorded under it', () => {
    expect(vehicleSubtitle(ship({ specs: {} }), model)).toBe('');
  });

  it('is empty when the ruleset declares no subtitle', () => {
    const { subtitleSpecId: _omitted, ...noSubtitle } = model;
    expect(vehicleSubtitle(ship(), noSubtitle)).toBe('');
  });
});

describe('readers', () => {
  it('defaults a missing counter and a missing spec', () => {
    expect(readCounter(ship({ counters: {} }), 'hull')).toEqual({ current: 0, max: 0 });
    expect(readSpec(ship({ specs: {} }), 'shipClass')).toBe('');
  });

  it('renders a numeric spec as a string', () => {
    expect(readSpec(ship({ specs: { jump: 2 } }), 'jump')).toBe('2');
  });
});

describe('the bundled Traveller declaration', () => {
  it('still declares every counter and spec the screen used to hardcode', () => {
    const declared = travellerSystem.vehicles;
    expect(declared?.counters?.map(c => c.id)).toEqual(['hull', 'fuel', 'cargo']);
    expect(declared?.specs?.map(s => s.id)).toEqual([
      'shipClass',
      'tl',
      'armor',
      'jump',
      'thrust',
      'power',
      'upkeep',
    ]);
    // The roster a new ship starts with, which used to be a const in types/ship.
    expect(declared?.crewRoles).toEqual([
      'Pilot',
      'Navigator',
      'Engineer',
      'Gunner',
      'Sensors',
      'Steward',
    ]);
  });
});
