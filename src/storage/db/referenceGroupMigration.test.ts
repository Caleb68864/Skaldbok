import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { upgradeReferenceGroupsToV14 } from './client';

/**
 * Upgrade test for schema v14, which gives reference sections a stable
 * `groupId` and both reference tables soft-delete columns.
 *
 * @remarks
 * Builds a real **v13** database, closes it, then runs the **exported** upgrade
 * function from `client.ts` — not a copy of it, since a duplicated migration in
 * a test passes happily while the shipped one drifts. A fresh install creates v14 directly and
 * never exercises this path, so nothing else covers it — and the failure mode it
 * guards against (sections silently losing their group) is invisible until a
 * user opens the Reference screen and finds their cards empty.
 */

const DB_NAME = 'skaldbok-v14-upgrade-test';

/** Opens a v13-shaped database with the two reference tables as they were. */
async function seedV13(): Promise<void> {
  const db = new Dexie(DB_NAME);
  db.version(13).stores({
    referenceSections: 'id, category, order, updatedAt',
    referenceGroups: 'id, title, order, updatedAt',
  });
  await db.open();
  await db.table('referenceGroups').bulkPut([
    { id: 'g-combat', title: 'Combat', order: 0, createdAt: 'x', updatedAt: 'x' },
    // Two cards sharing a title — the exact collision v14 exists to end.
    { id: 'g-dup-a', title: 'New Card', order: 1, createdAt: 'x', updatedAt: 'x' },
    { id: 'g-dup-b', title: 'New Card', order: 2, createdAt: 'x', updatedAt: 'x' },
  ]);
  await db.table('referenceSections').bulkPut([
    { id: 's1', title: 'Initiative', category: 'Combat', order: 0, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
    { id: 's2', title: 'Cover', category: 'New Card', order: 1, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
    // A category with no group row at all — the screen used to synthesise a
    // throwaway "orphan" group for these at render time.
    { id: 's3', title: 'Travel', category: 'Overland', order: 2, type: 'rules_text', createdAt: 'x', updatedAt: 'x' },
  ]);
  db.close();
}

/** Applies the real v14 upgrade from `client.ts`. */
async function openV14(): Promise<Dexie> {
  const db = new Dexie(DB_NAME);
  db.version(13).stores({
    referenceSections: 'id, category, order, updatedAt',
    referenceGroups: 'id, title, order, updatedAt',
  });
  db.version(14).stores({
    referenceSections: 'id, category, groupId, order, updatedAt, deletedAt',
    referenceGroups: 'id, title, order, updatedAt, deletedAt',
  }).upgrade(upgradeReferenceGroupsToV14);
  await db.open();
  return db;
}

describe('schema v14 — reference groupId backfill', () => {
  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
    await seedV13();
  });

  it('stamps every section with the id of its group', async () => {
    const db = await openV14();
    const sections = await db.table('referenceSections').toArray();
    const byId = new Map(sections.map(s => [s.id, s]));
    expect(byId.get('s1')?.groupId).toBe('g-combat');
    db.close();
  });

  it('resolves a duplicated title to exactly one group', async () => {
    const db = await openV14();
    const s2 = await db.table('referenceSections').get('s2');
    // Either card is a defensible answer; sharing both is not. First writer wins.
    expect(s2.groupId).toBe('g-dup-a');
    db.close();
  });

  it('materialises a group for a category that had none', async () => {
    const db = await openV14();
    const s3 = await db.table('referenceSections').get('s3');
    expect(s3.groupId).toBeTruthy();
    const group = await db.table('referenceGroups').get(s3.groupId);
    expect(group?.title).toBe('Overland');
    db.close();
  });

  it('leaves no section without a group', async () => {
    const db = await openV14();
    const sections = await db.table('referenceSections').toArray();
    expect(sections.every(s => typeof s.groupId === 'string' && s.groupId.length > 0)).toBe(true);
    db.close();
  });

  it('is idempotent — reopening does not re-run or duplicate groups', async () => {
    const first = await openV14();
    const groupsAfterFirst = (await first.table('referenceGroups').toArray()).length;
    first.close();
    const second = await openV14();
    const groupsAfterSecond = (await second.table('referenceGroups').toArray()).length;
    expect(groupsAfterSecond).toBe(groupsAfterFirst);
    second.close();
  });

  it('preserves fields it does not touch', async () => {
    const db = await openV14();
    const s1 = await db.table('referenceSections').get('s1');
    expect(s1.title).toBe('Initiative');
    expect(s1.category).toBe('Combat');
    expect(s1.order).toBe(0);
    db.close();
  });
});
