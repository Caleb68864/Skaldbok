import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../db/client';
import {
  create,
  insertBetween,
  listByCampaign,
  reorder,
  softDelete,
  restore,
  update,
} from './routeRepository';
import { resetDatabase } from '../../test-utils/resetDatabase';

/**
 * Route ordering is dense — `order` runs 0..n-1 with no gaps — and every
 * operation that can disturb it has to leave it dense. A duplicate index does
 * not throw; it just renders the route in an order nobody chose, which is the
 * kind of defect that survives a code review and gets noticed at the table.
 */

async function names(campaignId = 'c1'): Promise<string[]> {
  return (await listByCampaign(campaignId)).map(s => s.name);
}

async function orders(campaignId = 'c1'): Promise<number[]> {
  return (await listByCampaign(campaignId)).map(s => s.order);
}

async function seedRoute(): Promise<string[]> {
  const ids: string[] = [];
  for (const name of ['Regina', 'Extolay', 'Knorbes', 'Zila']) {
    ids.push((await create({ campaignId: 'c1', name })).id);
  }
  return ids;
}

describe('routeRepository', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('appends each new stop at the end, densely', async () => {
    await seedRoute();
    expect(await names()).toEqual(['Regina', 'Extolay', 'Knorbes', 'Zila']);
    expect(await orders()).toEqual([0, 1, 2, 3]);
  });

  it('keeps campaigns separate', async () => {
    await create({ campaignId: 'c1', name: 'Regina' });
    await create({ campaignId: 'c2', name: 'Pixie' });
    expect(await names('c1')).toEqual(['Regina']);
    expect(await names('c2')).toEqual(['Pixie']);
  });

  it('persists a new order and stays dense', async () => {
    const ids = await seedRoute();
    // Move Zila (last) to third.
    await reorder('c1', [ids[0], ids[1], ids[3], ids[2]]);
    expect(await names()).toEqual(['Regina', 'Extolay', 'Zila', 'Knorbes']);
    expect(await orders()).toEqual([0, 1, 2, 3]);
  });

  it('never leaves two stops sharing an index', async () => {
    const ids = await seedRoute();
    await reorder('c1', [ids[3], ids[2], ids[1], ids[0]]);
    const seen = await orders();
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('ignores ids that do not belong to the campaign', async () => {
    const ids = await seedRoute();
    await reorder('c1', [...ids, 'not-a-real-id']);
    expect(await orders()).toEqual([0, 1, 2, 3]);
    expect(await names()).toHaveLength(4);
  });

  it('closes the gap when a stop is soft-deleted', async () => {
    const ids = await seedRoute();
    await softDelete(ids[1]); // Extolay, index 1
    expect(await names()).toEqual(['Regina', 'Knorbes', 'Zila']);
    expect(await orders()).toEqual([0, 1, 2]);
  });

  it('hides a soft-deleted stop from reads but keeps the row', async () => {
    const ids = await seedRoute();
    await softDelete(ids[0]);
    expect(await names()).not.toContain('Regina');
    const row = await db.routeStops.get(ids[0]);
    expect(row).toBeDefined();
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.softDeletedBy).toBeTruthy();
  });

  it('surfaces a soft-deleted stop again when opted in', async () => {
    const ids = await seedRoute();
    await softDelete(ids[0]);
    const all = await listByCampaign('c1', { includeDeleted: true });
    expect(all.map(s => s.id)).toContain(ids[0]);
  });

  it('restores a stop to the end rather than reclaiming its old index', async () => {
    const ids = await seedRoute();
    await softDelete(ids[0]); // Regina was 0
    await restore(ids[0]);
    // The route moved on; forcing it back to 0 would renumber everything.
    expect(await names()).toEqual(['Extolay', 'Knorbes', 'Zila', 'Regina']);
    expect(await orders()).toEqual([0, 1, 2, 3]);
  });

  it('round-trips declared field values as strings', async () => {
    const stop = await create({
      campaignId: 'c1',
      name: 'Regina',
      values: { uwp: 'A788899-C', hex: '1910', jump: '2' },
    });
    await update(stop.id, { values: { ...stop.values, jump: '3' } });
    const [reread] = await listByCampaign('c1');
    expect(reread.values).toEqual({ uwp: 'A788899-C', hex: '1910', jump: '3' });
  });

  it('inserts suggested hops into one leg while preserving the existing stop identities and notes', async () => {
    const ids = await seedRoute();
    await update(ids[2], { values: { notes: 'Keep this note', jump: '4' } });
    await insertBetween('c1', ids[1], ids[2], [
      { name: 'Pysadi', values: { sector: 'Spinward Marches', hex: '3008', jump: '1' } },
      { name: 'Lewis', values: { sector: 'Spinward Marches', hex: '3107', jump: '2' } },
    ], { jump: '1' });
    const route = await listByCampaign('c1');
    expect(route.map(stop => stop.name)).toEqual(['Regina', 'Extolay', 'Pysadi', 'Lewis', 'Knorbes', 'Zila']);
    expect(route.map(stop => stop.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(route[4].id).toBe(ids[2]);
    expect(route[4].values).toEqual({ notes: 'Keep this note', jump: '1' });
  });

  it('refuses to apply a stale route suggestion when the selected leg has changed', async () => {
    const ids = await seedRoute();
    await expect(insertBetween('c1', ids[0], ids[2], [{ name: 'Pysadi', values: {} }])).rejects.toThrow('route changed');
    expect(await names()).toEqual(['Regina', 'Extolay', 'Knorbes', 'Zila']);
  });

  it('is a no-op on an already-deleted stop', async () => {
    const ids = await seedRoute();
    await softDelete(ids[0]);
    const before = await orders();
    await softDelete(ids[0]);
    expect(await orders()).toEqual(before);
  });
});
