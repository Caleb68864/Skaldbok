// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import type { ReferenceNote } from '../db/client';
import { getAll, getDeleted, save, softDelete, restore, hardDelete } from './referenceNoteRepository';

/**
 * The Reference screen's Notes tab deletes user content, and this covers the
 * round trip out of and back into the library.
 *
 * @remarks
 * That delete button used to call `db.referenceNotes.delete` through a function
 * named `remove` — irreversible, from a confirmation dialog, with no Trash
 * entry. It was the only user-facing control in the app that destroyed content
 * outright, in an app whose whole convention is soft delete, and in a
 * local-first one where the row exists in exactly one browser.
 *
 * The table is legacy — its content was folded into `notes` at schema v7 — but
 * it is still *written*: `ReferenceScreen.handleNoteSave` mints new rows here.
 */

const NOW = '2026-01-01T00:00:00.000Z';

function note(id: string, title: string): ReferenceNote {
  return { id, title, content: 'body', createdAt: NOW, updatedAt: NOW };
}

beforeEach(async () => {
  await db.referenceNotes.clear();
});

describe('referenceNoteRepository soft delete', () => {
  it('hides a deleted note from getAll but keeps the row', async () => {
    await save(note('a', 'Keep'));
    await save(note('b', 'Delete'));

    await softDelete('b');

    expect((await getAll()).map(n => n.id)).toEqual(['a']);
    // The row itself must survive, or there is nothing to restore.
    expect(await db.referenceNotes.get('b')).toBeDefined();
  });

  it('lists the deleted note for the Trash and restores it', async () => {
    await save(note('b', 'Delete'));
    await softDelete('b');

    const deleted = await getDeleted();
    expect(deleted.map(n => n.id)).toEqual(['b']);
    expect(deleted[0].deletedAt).toBeTruthy();
    expect(deleted[0].softDeletedBy).toBeTruthy();

    await restore('b');

    expect((await getAll()).map(n => n.id)).toEqual(['b']);
    expect(await getDeleted()).toEqual([]);
  });

  it('does not re-stamp softDeletedBy on an already-deleted note', async () => {
    await save(note('b', 'Delete'));
    await softDelete('b', 'tx-1');
    await softDelete('b', 'tx-2');

    // A second delete overwriting the transaction id would orphan whatever else
    // went down under tx-1: restore brings back the row and not its siblings.
    expect((await db.referenceNotes.get('b'))?.softDeletedBy).toBe('tx-1');
  });

  it('no-ops on a missing id rather than throwing', async () => {
    await expect(softDelete('nope')).resolves.toBeUndefined();
    await expect(restore('nope')).resolves.toBeUndefined();
  });

  it('still offers a permanent removal for purge jobs', async () => {
    await save(note('b', 'Delete'));
    await hardDelete('b');
    expect(await db.referenceNotes.get('b')).toBeUndefined();
  });
});
