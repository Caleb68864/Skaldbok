import { describe, it, expect } from 'vitest';
import { containerWealth, inventoryContainerSchema } from './inventoryContainer';

/**
 * Containers carry no `schemaVersion`, so instead of a migration ladder they are
 * normalised on read. These tests pin that behaviour, since a regression would
 * silently zero a party coffer.
 */
describe('containerWealth', () => {
  it('returns denomination-keyed wealth when present', () => {
    expect(containerWealth({ wealth: { credits: 500 } })).toEqual({ credits: 500 });
  });

  it('folds a legacy coin purse into the denomination shape', () => {
    expect(containerWealth({ coins: { gold: 2, silver: 3, copper: 4 } }))
      .toEqual({ gold: 2, silver: 3, copper: 4 });
  });

  it('prefers wealth over a stale legacy purse', () => {
    expect(containerWealth({ wealth: { gold: 9 }, coins: { gold: 1, silver: 1, copper: 1 } }))
      .toEqual({ gold: 9 });
  });

  it('returns an empty purse when the container has neither', () => {
    expect(containerWealth({})).toEqual({});
  });

  it('treats an empty wealth object as "fall back to legacy coins"', () => {
    // A container written by the new code with no money has {}, but one migrated
    // from legacy data must not lose its coins to that empty object.
    expect(containerWealth({ wealth: {}, coins: { gold: 5, silver: 0, copper: 0 } }))
      .toEqual({ gold: 5, silver: 0, copper: 0 });
  });
});

describe('inventoryContainerSchema', () => {
  const base = {
    id: 'c1',
    campaignId: 'camp1',
    name: 'Party Coffer',
    kind: 'coffer' as const,
    capacity: null,
    items: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('accepts a container with no money at all', () => {
    const parsed = inventoryContainerSchema.parse(base);
    expect(parsed.wealth).toEqual({});
  });

  it('accepts a legacy container that still carries coins', () => {
    const parsed = inventoryContainerSchema.parse({
      ...base,
      coins: { gold: 1, silver: 2, copper: 3 },
    });
    expect(containerWealth(parsed)).toEqual({ gold: 1, silver: 2, copper: 3 });
  });

  it('accepts a system-specific denomination', () => {
    const parsed = inventoryContainerSchema.parse({ ...base, wealth: { credits: 1200 } });
    expect(parsed.wealth).toEqual({ credits: 1200 });
  });
});
