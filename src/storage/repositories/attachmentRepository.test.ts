// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/client';
import {
  getAttachmentsByNote,
  getDeleted,
  restoreAttachment,
  softDeleteAttachment,
} from './attachmentRepository';
import { softDeleteWithLinks, restore } from './noteRepository';
import { nowISO } from '../../utils/dates';

/**
 * Deleting a note used to hard-delete its attachments.
 *
 * @remarks
 * Trash restored the note and its edges; the photos were already gone. That is
 * unrecoverable loss inside the one feature whose entire promise is that the
 * deletion can be taken back — the worst shape a bug can have in a local-first
 * app with no server copy.
 *
 * These tests pin the cascade both ways: the Blob survives the delete, and the
 * restore brings it back.
 */

const NOW = '2026-01-01T00:00:00.000Z';

async function seedNoteWithAttachment(noteId: string, attachmentId: string) {
  await db.notes.add({
    id: noteId,
    campaignId: 'camp-1',
    title: 'Field sketch',
    body: null,
    type: 'general',
    status: 'active',
    pinned: false,
    scope: 'campaign',
    schemaVersion: 1,
    createdAt: NOW,
    updatedAt: NOW,
  } as never);

  await db.attachments.add({
    id: attachmentId,
    noteId,
    campaignId: 'camp-1',
    filename: 'sketch.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    blob: new Blob([new Uint8Array([9, 9, 9, 9])], { type: 'image/jpeg' }),
    createdAt: nowISO(),
  } as never);
}

describe('note deletion and its attachments', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('keeps the attachment row when the note is soft-deleted', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');

    await softDeleteWithLinks('note-1', 'tx-1');

    // The row must still exist — this is the assertion that fails against a
    // hard delete, and the photo is not recoverable once it does.
    const row = await db.attachments.get('att-1');
    expect(row).toBeDefined();
    expect(row?.blob).toBeInstanceOf(Blob);
    expect(row?.deletedAt).toBeTruthy();
    expect(row?.softDeletedBy).toBe('tx-1');
  });

  it('hides a cascaded attachment from the default reads', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteWithLinks('note-1', 'tx-1');

    expect(await getAttachmentsByNote('note-1')).toHaveLength(0);
    expect(await getAttachmentsByNote('note-1', { includeDeleted: true })).toHaveLength(1);
  });

  it('brings the attachment back when the note is restored', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteWithLinks('note-1', 'tx-1');

    await restore('note-1');

    const visible = await getAttachmentsByNote('note-1');
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('att-1');
    expect(visible[0].blob).toBeInstanceOf(Blob);
    const row = await db.attachments.get('att-1');
    expect(row?.deletedAt).toBeUndefined();
    expect(row?.softDeletedBy).toBeUndefined();
  });

  it('restores only what went down with this note, not an earlier removal', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');
    // A second photo the user deleted deliberately, under its own cascade id,
    // before the note was ever touched. Restoring the note must not resurrect it.
    await db.attachments.add({
      id: 'att-earlier',
      noteId: 'note-1',
      campaignId: 'camp-1',
      filename: 'discarded.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      blob: new Blob([new Uint8Array([1, 1, 1, 1])], { type: 'image/jpeg' }),
      createdAt: nowISO(),
      deletedAt: NOW,
      softDeletedBy: 'tx-earlier',
    } as never);

    await softDeleteWithLinks('note-1', 'tx-1');
    await restore('note-1');

    const visible = await getAttachmentsByNote('note-1');
    expect(visible.map((a) => a.id)).toEqual(['att-1']);
  });
});

/**
 * A photo could be added to a note but not removed on its own.
 *
 * @remarks
 * The repository had a cascade delete (with the note) and a permanent
 * `deleteAttachment` nothing may call, and no way to list a removed photo, so
 * there was nothing a per-photo Remove control could safely do. These pin the
 * soft delete, the Trash listing and the restore.
 */
describe('removing one photo', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('hides it from the note and lists it for the Trash', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');

    await softDeleteAttachment('att-1');

    expect(await getAttachmentsByNote('note-1')).toHaveLength(0);
    const row = await db.attachments.get('att-1');
    expect(row?.blob, 'the photo itself must survive a soft delete').toBeInstanceOf(Blob);
    expect(row?.softDeletedBy).toBeTruthy();
    expect((await getDeleted('camp-1')).map((a) => a.id)).toEqual(['att-1']);
    expect(await getDeleted('other-campaign')).toEqual([]);
  });

  it('comes back on restore, and leaves the listing', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteAttachment('att-1');

    await restoreAttachment('att-1');

    expect((await getAttachmentsByNote('note-1')).map((a) => a.id)).toEqual(['att-1']);
    const row = await db.attachments.get('att-1');
    expect(row?.deletedAt).toBeUndefined();
    expect(row?.softDeletedBy).toBeUndefined();
    expect(await getDeleted('camp-1')).toEqual([]);
  });

  it('does not list a photo that went down with its note', async () => {
    // That one comes back with the note. Offering it on its own would restore
    // a photo onto a note that is still in the Trash.
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteWithLinks('note-1', 'tx-1');

    expect(await getDeleted('camp-1')).toEqual([]);
  });

  it('is not brought back by restoring its note, and is listed again once the note is back', async () => {
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteAttachment('att-1');
    await softDeleteWithLinks('note-1', 'tx-1');
    expect(await getDeleted('camp-1'), 'hidden while its note is in the Trash').toEqual([]);

    await restore('note-1');

    expect(await getAttachmentsByNote('note-1')).toEqual([]);
    expect((await getDeleted('camp-1')).map((a) => a.id)).toEqual(['att-1']);
  });

  it('keeps the cascade id when removed again after its note was deleted', async () => {
    // A second tombstone would replace `tx-1`, and restoring the note would
    // then leave the photo behind.
    await seedNoteWithAttachment('note-1', 'att-1');
    await softDeleteWithLinks('note-1', 'tx-1');

    await softDeleteAttachment('att-1');

    expect((await db.attachments.get('att-1'))?.softDeletedBy).toBe('tx-1');
  });
});
