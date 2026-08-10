import { describe, it, expect } from 'vitest';
import { CURRENT_SHIP_SCHEMA_VERSION, upgradeShip, type Ship } from './ship';

/**
 * The v1 → v2 upgrade turns one game's starship columns into the open counter
 * and spec bags every ruleset now writes into. A vehicle built before the
 * change is somebody's actual ship, so losing a field here loses table data
 * with nothing to notice — hence the field-by-field assertions.
 */

/** A v1 row as it was stored, cast through `unknown` since the type no longer admits it. */
const legacyShip = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 's1',
    campaignId: 'c1',
    ownerCharacterId: null,
    name: 'Nomad',
    shipClass: 'Free Trader',
    tl: 12,
    hullCurrent: 30,
    hullMax: 40,
    armor: 2,
    fuelCurrent: 2,
    fuelMax: 22,
    cargoCurrent: 0,
    cargoMax: 82,
    jump: 2,
    thrust: 1,
    power: 'Fusion',
    upkeep: 201_335,
    weapons: ['Triple Turret'],
    crew: [{ role: 'Pilot', assignee: 'Rurik' }],
    notes: 'Scarred hull.',
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as unknown as Ship & Record<string, unknown>;

describe('upgradeShip', () => {
  it('moves the legacy counter columns into the counters bag', () => {
    const ship = upgradeShip(legacyShip());
    expect(ship.counters).toEqual({
      hull: { current: 30, max: 40 },
      fuel: { current: 2, max: 22 },
      cargo: { current: 0, max: 82 },
    });
  });

  it('moves the legacy spec columns into the specs bag', () => {
    const ship = upgradeShip(legacyShip());
    expect(ship.specs).toEqual({
      shipClass: 'Free Trader',
      tl: 12,
      armor: 2,
      jump: 2,
      thrust: 1,
      power: 'Fusion',
      upkeep: 201_335,
    });
  });

  it('keeps the fields that were never ruleset-specific', () => {
    const ship = upgradeShip(legacyShip());
    expect(ship.name).toBe('Nomad');
    expect(ship.weapons).toEqual(['Triple Turret']);
    expect(ship.crew).toEqual([{ role: 'Pilot', assignee: 'Rurik' }]);
    expect(ship.notes).toBe('Scarred hull.');
    expect(ship.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('stamps the current schema version', () => {
    expect(upgradeShip(legacyShip()).schemaVersion).toBe(CURRENT_SHIP_SCHEMA_VERSION);
  });

  it('is idempotent', () => {
    const once = upgradeShip(legacyShip());
    const twice = upgradeShip(once as Ship & Record<string, unknown>);
    expect(twice).toEqual(once);
  });

  it('leaves an already-upgraded row untouched', () => {
    const current: Ship = {
      id: 's2',
      campaignId: 'c1',
      name: 'Kestrel',
      counters: { hull: { current: 1, max: 2 } },
      specs: { shipClass: 'Scout' },
      weapons: [],
      crew: [],
      notes: '',
      schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
      createdAt: 'x',
      updatedAt: 'x',
    };
    expect(upgradeShip(current as Ship & Record<string, unknown>)).toBe(current);
  });

  it('omits a counter the legacy row never carried rather than writing 0/0', () => {
    const { hullCurrent: _c, hullMax: _m, ...withoutHull } = legacyShip() as Record<string, unknown>;
    const ship = upgradeShip(withoutHull as unknown as Ship & Record<string, unknown>);
    expect(ship.counters.hull).toBeUndefined();
    expect(ship.counters.fuel).toEqual({ current: 2, max: 22 });
  });

  it('drops a blank legacy string rather than storing an empty spec', () => {
    // A ship that never had a power plant recorded should not gain an empty
    // "Power Plant" line the moment it is opened.
    const ship = upgradeShip(legacyShip({ power: '', shipClass: '' }));
    expect(ship.specs.power).toBeUndefined();
    expect(ship.specs.shipClass).toBeUndefined();
  });

  it('does not overwrite bags a partially-upgraded row already holds', () => {
    const ship = upgradeShip(
      legacyShip({ counters: { hull: { current: 5, max: 5 } }, specs: { shipClass: 'Yacht' } }),
    );
    expect(ship.counters.hull).toEqual({ current: 5, max: 5 });
    expect(ship.specs.shipClass).toBe('Yacht');
    // …while still filling in what the bags were missing.
    expect(ship.counters.fuel).toEqual({ current: 2, max: 22 });
  });
});
