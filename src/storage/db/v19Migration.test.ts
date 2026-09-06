import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { upgradeNotesAndClearBackupsToV19 } from './client';

/**
 * Upgrade test for schema v19.
 *
 * @remarks
 * v19 exists to re-run a backfill that most databases never got. The
 * `campaignId`/`body`/`status`/`pinned` fill for notes promoted out of
 * `referenceNotes` was added to the **v7** block in commit `1b5e70a`, at which
 * point the schema was already at v14 — Dexie runs an upgrade once, on the way
 * past that version, so every database already above v7 skipped it and kept
 * reference notes that the schema drops fields from on read.
 *
 * Runs the exported upgrade function rather than a copy, for the same reason
 * the v14 test does.
 */

const DB_NAME = 'skaldbok-v19-upgrade-test';

/**
 * Minimal localStorage for the node test environment.
 *
 * @remarks
 * The suite has no DOM setup, so `localStorage` is absent. The migration is
 * written to survive that (the accessor throws in a browser that blocks site
 * data, and aborting the upgrade transaction would lock the user out), which
 * means the cleanup is a silent no-op here unless one is provided.
 */
function installLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() { return store.size; },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
}

installLocalStorage();

/** Opens a small database holding notes in the states the backfill has to handle. */
async function seedNotes(rows: Record<string, unknown>[]): Promise<Dexie> {
  const db = new Dexie(DB_NAME);
  db.version(1).stores({ notes: 'id, campaignId' });
  await db.open();
  await db.table('notes').bulkPut(rows);
  return db;
}

beforeEach(async () => {
  await Dexie.delete(DB_NAME);
  localStorage.clear();
});

describe('upgradeNotesAndClearBackupsToV19', () => {
  it('fills the fields a pre-v7 reference note is missing', async () => {
    const db = await seedNotes([
      { id: 'n1', title: 'Old Reference', type: 'reference', content: 'Legacy body text' },
    ]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));

    const note = await db.table('notes').get('n1');
    expect(note.campaignId).toBe('');
    expect(note.body).toBe('Legacy body text');
    expect(note.status).toBe('active');
    expect(note.pinned).toBe(false);
    db.close();
  });

  it('leaves an already-complete note untouched', async () => {
    const complete = {
      id: 'n2',
      campaignId: 'c1',
      title: 'Current',
      type: 'generic',
      body: 'Written by the user',
      status: 'archived',
      pinned: true,
    };
    const db = await seedNotes([complete]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));

    expect(await db.table('notes').get('n2')).toEqual(complete);
    db.close();
  });

  it('is idempotent', async () => {
    const db = await seedNotes([{ id: 'n3', title: 'Old', type: 'reference', content: 'Body' }]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));
    const first = await db.table('notes').get('n3');
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));
    expect(await db.table('notes').get('n3')).toEqual(first);
    db.close();
  });

  it('preserves fields the backfill does not name', async () => {
    const db = await seedNotes([
      { id: 'n4', title: 'Old', type: 'reference', content: 'Body', tags: ['lore'], scope: 'shared' },
    ]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));

    const note = await db.table('notes').get('n4');
    expect(note.tags).toEqual(['lore']);
    expect(note.scope).toBe('shared');
    db.close();
  });

  it('treats a note with no body and no legacy content as empty, not undefined', async () => {
    const db = await seedNotes([{ id: 'n5', title: 'Bare', type: 'reference' }]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));

    const note = await db.table('notes').get('n5');
    expect(note.body).toBeNull();
    db.close();
  });

  it('removes the v8 pre-rework dump from localStorage', async () => {
    // Written by the v8 upgrade as a safety net and never cleaned up. It holds
    // every table verbatim, survives campaign deletion and "clear all data",
    // and sits outside the soft-delete model.
    localStorage.setItem('forge:backup:pre-encounter-rework-2026-01-01.json', '{"notes":[]}');
    localStorage.setItem('forge:backup:pre-encounter-rework-2026-02-02.json', '{"notes":[]}');
    localStorage.setItem('skaldbok:theme', 'dark');

    const db = await seedNotes([]);
    await db.transaction('rw', db.table('notes'), tx => upgradeNotesAndClearBackupsToV19(tx));

    expect(localStorage.getItem('forge:backup:pre-encounter-rework-2026-01-01.json')).toBeNull();
    expect(localStorage.getItem('forge:backup:pre-encounter-rework-2026-02-02.json')).toBeNull();
    // Unrelated keys are not collateral.
    expect(localStorage.getItem('skaldbok:theme')).toBe('dark');
    db.close();
  });
});
