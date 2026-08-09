import { describe, it, expect } from 'vitest';
import { readNumericField, totalDistance, reorder } from './routeMath';
import type { RouteStop } from '../types/routeStop';

function stop(name: string, order: number, values: Record<string, string> = {}): RouteStop {
  return {
    id: `s-${name}`,
    campaignId: 'c1',
    name,
    order,
    values,
    schemaVersion: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('readNumericField', () => {
  it('reads a plain number', () => {
    expect(readNumericField({ jump: '2' }, 'jump')).toBe(2);
  });

  it('reads a decimal', () => {
    expect(readNumericField({ jump: '2.5' }, 'jump')).toBe(2.5);
  });

  it('returns 0 for a missing field', () => {
    expect(readNumericField({}, 'jump')).toBe(0);
  });

  it('returns 0 for a blank field', () => {
    expect(readNumericField({ jump: '' }, 'jump')).toBe(0);
    expect(readNumericField({ jump: '   ' }, 'jump')).toBe(0);
  });

  it('returns 0 rather than NaN for unparseable text', () => {
    const result = readNumericField({ jump: 'about three' }, 'jump');
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(readNumericField({ jump: ' 3 ' }, 'jump')).toBe(3);
  });
});

describe('totalDistance', () => {
  it('sums the declared distance field', () => {
    const route = [
      stop('Regina', 0, { jump: '2' }),
      stop('Efate', 1, { jump: '1' }),
      stop('Jenghe', 2, { jump: '3' }),
    ];
    expect(totalDistance(route, 'jump')).toBe(6);
  });

  it('stays finite when a leg has not been measured yet', () => {
    const route = [stop('Regina', 0, { jump: '2' }), stop('Unknown', 1, {})];
    const total = totalDistance(route, 'jump');
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBe(2);
  });

  it('returns 0 when the system declares no distance field', () => {
    expect(totalDistance([stop('Regina', 0, { jump: '2' })], undefined)).toBe(0);
  });

  it('returns 0 for an empty route', () => {
    expect(totalDistance([], 'jump')).toBe(0);
  });
});

describe('reorder', () => {
  const five = () => [stop('a', 0), stop('b', 1), stop('c', 2), stop('d', 3), stop('e', 4)];

  it('moves a stop and renumbers densely', () => {
    const next = reorder(five(), 0, 3);
    expect(next.map(s => s.name)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(next.map(s => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('moves a stop backwards', () => {
    const next = reorder(five(), 4, 0);
    expect(next.map(s => s.name)).toEqual(['e', 'a', 'b', 'c', 'd']);
    expect(next.map(s => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('never produces duplicate order values', () => {
    const orders = reorder(five(), 1, 3).map(s => s.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('is a no-op when from and to match', () => {
    expect(reorder(five(), 2, 2).map(s => s.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('clamps out-of-range indices instead of dropping a stop', () => {
    const next = reorder(five(), 0, 99);
    expect(next).toHaveLength(5);
    expect(next.map(s => s.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles a single-stop route without throwing', () => {
    expect(reorder([stop('only', 0)], 0, 0).map(s => s.order)).toEqual([0]);
  });

  it('handles an empty route without throwing', () => {
    expect(reorder([], 0, 1)).toEqual([]);
  });

  it('repairs gappy orders it was handed', () => {
    const gappy = [stop('a', 5), stop('b', 9)];
    expect(reorder(gappy, 0, 0).map(s => s.order)).toEqual([0, 1]);
  });

  it('does not mutate the array it was given', () => {
    const input = five();
    reorder(input, 0, 4);
    expect(input.map(s => s.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
