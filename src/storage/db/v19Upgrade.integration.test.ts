import { describe, it, expect, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

/**
 * Opens the real database against a pre-existing v18 one.
 *
 * @remarks
 * The unit test beside this runs the v19 upgrade function directly, which
 * proves the backfill is correct but not that the database still *opens*. A
 * migration that throws during `upgrade` leaves Dexie unable to open at all,
 * and because the same failing upgrade re-runs on every load the app is bricked
 * with no in-UI recovery — the exact failure the v8 backup writer documents
 * guarding against.
 *
 * So: build a v18-shaped database under the real name, close it, then import
 * the real client and let Dexie walk it up. The import is dynamic and inside
 * the test file's `beforeAll` because `db` is constructed at module scope.
 */

const DB_NAME = 'skaldbok-db';

let db: typeof import('./client').db;

beforeAll(async () => {
  await Dexie.delete(DB_NAME);

  // A minimal v18: enough tables to be a real database, with a reference note
  // in the pre-v7 shape that the v19 backfill is meant to repair.
  const old = new Dexie(DB_NAME);
  old.version(18).stores({
    characters: 'id, name, systemId, deletedAt',
    notes: 'id, campaignId, sessionId, type, status, pinned, visibility, scope, deletedAt',
    referenceSections: 'id, category, groupId, order, updatedAt, deletedAt',
    referenceGroups: 'id, title, order, updatedAt, deletedAt',
    metadata: 'id, key',
  });
  await old.open();
  expect(old.verno).toBe(18);
  await old.table('notes').bulkPut([
    // Promoted out of referenceNotes before v7 and never backfilled.
    { id: 'legacy', title: 'Old Reference', type: 'reference', content: 'Legacy body' },
    // Already complete: must come through untouched.
    {
      id: 'current',
      campaignId: 'c1',
      title: 'Current',
      type: 'generic',
      body: 'Body',
      status: 'active',
      pinned: true,
    },
  ]);
  await old.table('referenceSections').put({
    id: 's1', title: 'Initiative', category: 'Combat', groupId: 'g1', order: 0,
    type: 'rules_text', createdAt: 'x', updatedAt: 'x',
  });
  old.close();

  ({ db } = await import('./client'));
  await db.open();
});

describe('opening a v18 database with the shipped schema', () => {
  it('upgrades without throwing', () => {
    expect(db.isOpen()).toBe(true);
    expect(db.verno).toBe(19);
  });

  it('backfills the legacy reference note', async () => {
    const note = await db.notes.get('legacy');
    expect(note).toBeDefined();
    expect(note?.campaignId).toBe('');
    expect(note?.status).toBe('active');
    expect(note?.pinned).toBe(false);
    expect((note as unknown as { body?: string }).body).toBe('Legacy body');
  });

  it('leaves an already-complete note alone', async () => {
    const note = await db.notes.get('current');
    expect(note?.campaignId).toBe('c1');
    expect(note?.pinned).toBe(true);
    expect((note as unknown as { body?: string }).body).toBe('Body');
  });

  it('keeps existing rows in other tables', async () => {
    expect(await db.referenceSections.get('s1')).toBeDefined();
  });

  it('exposes the softDeletedBy index restoreGroup queries', async () => {
    // The whole point of the version bump: this throws SchemaError on v18.
    await expect(
      db.referenceSections.where('softDeletedBy').equals('tx-1').toArray(),
    ).resolves.toEqual([]);
  });
});
