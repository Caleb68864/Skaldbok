import { db } from '../db/client';
import { baseNoteSchema } from '../../types/note';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import * as entityLinkRepository from './entityLinkRepository';

// Lazy import to avoid circular dependency — linkSyncEngine imports noteRepository
let _syncModule: typeof import('../../features/kb/linkSyncEngine') | null = null;
async function getSyncModule() {
  if (!_syncModule) {
    _syncModule = await import('../../features/kb/linkSyncEngine');
  }
  return _syncModule;
}

/**
 * Retrieves a single {@link Note} by its unique identifier.
 *
 * @remarks
 * The raw record is validated against {@link baseNoteSchema} before being
 * returned.  Records that fail validation are treated as absent and a warning
 * is logged to the console.
 *
 * @param id - The unique ID of the note to fetch.
 * @returns The validated note, or `undefined` if it does not exist or fails validation.
 * @throws {Error} If the Dexie query itself throws an unexpected error.
 *
 * @example
 * ```ts
 * const note = await getNoteById('abc123');
 * if (!note) console.warn('Note not found');
 * ```
 */
export async function getNoteById(id: string, options?: { includeDeleted?: boolean }): Promise<Note | undefined> {
  try {
    const record = await db.notes.get(id);
    if (!record) return undefined;
    const parsed = baseNoteSchema.safeParse(record);
    if (!parsed.success) {
      console.warn('noteRepository.getNoteById: validation failed for id', id, parsed.error);
      return undefined;
    }
    if (!options?.includeDeleted && parsed.data.deletedAt) return undefined;
    return parsed.data;
  } catch (e) {
    throw new Error(`noteRepository.getNoteById failed: ${e}`);
  }
}

/**
 * Retrieves all {@link Note} records belonging to a given campaign.
 *
 * @remarks
 * Records that fail schema validation are silently excluded from the result
 * and a warning is logged per failed record.
 *
 * @param campaignId - The ID of the campaign whose notes should be fetched.
 * @returns An array of validated notes; may be empty if none exist.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const notes = await getNotesByCampaign('campaign-1');
 * console.log(`Found ${notes.length} notes.`);
 * ```
 */
export async function getNotesByCampaign(campaignId: string, options?: { includeDeleted?: boolean }): Promise<Note[]> {
  try {
    const records = await db.notes.where('campaignId').equals(campaignId).toArray();
    const parsed = records
      .map(record => {
        const result = baseNoteSchema.safeParse(record);
        if (!result.success) {
          console.warn('noteRepository.getNotesByCampaign: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((n): n is Note => n !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`noteRepository.getNotesByCampaign failed: ${e}`);
  }
}

/**
 * Retrieves all {@link Note} records associated with a given session.
 *
 * @remarks
 * Only notes that have a `sessionId` matching the provided value are returned.
 * Campaign-level notes without a `sessionId` are excluded.
 * Records that fail schema validation are silently excluded.
 *
 * @param sessionId - The ID of the session whose notes should be fetched.
 * @returns An array of validated notes; may be empty if none exist.
 * @throws {Error} If the Dexie query throws an unexpected error.
 *
 * @example
 * ```ts
 * const sessionNotes = await getNotesBySession('session-42');
 * const combatNote = sessionNotes.find(n => n.type === 'combat');
 * ```
 */
export async function getNotesBySession(sessionId: string, options?: { includeDeleted?: boolean }): Promise<Note[]> {
  try {
    const records = await db.notes.where('sessionId').equals(sessionId).toArray();
    const parsed = records
      .map(record => {
        const result = baseNoteSchema.safeParse(record);
        if (!result.success) {
          console.warn('noteRepository.getNotesBySession: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((n): n is Note => n !== undefined);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`noteRepository.getNotesBySession failed: ${e}`);
  }
}

/**
 * Creates a new {@link Note} record in IndexedDB and returns the persisted note.
 *
 * @remarks
 * The `id`, `createdAt`, `updatedAt`, and `schemaVersion` fields are
 * generated automatically and must not be supplied in `data`.
 *
 * @param data - All note fields except the auto-generated ones.
 * @returns The newly created note with all generated fields populated.
 * @throws {Error} If the Dexie insert throws (e.g. duplicate key or storage quota exceeded).
 *
 * @example
 * ```ts
 * const note = await createNote({
 *   campaignId: 'campaign-1',
 *   sessionId: 'session-7',
 *   title: 'The Dragon Hoard',
 *   body: null,
 *   type: 'loot',
 *   typeData: {},
 *   status: 'active',
 *   pinned: false,
 * });
 * console.log(note.id); // auto-generated
 * ```
 */
export async function createNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>): Promise<Note> {
  try {
    const now = nowISO();
    const note = {
      ...data,
      id: generateId(),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    } as Note;
    await db.notes.add(note);
    // Fire-and-forget KB graph sync — failure must NOT affect note save
    getSyncModule().then((m) => m.syncNote(note.id)).catch(() => {});
    return note;
  } catch (e) {
    throw new Error(`noteRepository.createNote failed: ${e}`);
  }
}

/**
 * Applies a partial update to an existing {@link Note} and returns the full
 * updated record.
 *
 * @remarks
 * `updatedAt` is automatically set to the current ISO datetime regardless of
 * whether it is included in `data`.  The full note is re-fetched from the
 * database after the update to guarantee the returned value reflects the
 * persisted state.
 *
 * @param id   - The ID of the note to update.
 * @param data - Partial note fields to merge into the existing record.
 * @returns The updated note as it exists in the database after the write.
 * @throws {Error} If the note cannot be found after the update, or if Dexie throws.
 *
 * @example
 * ```ts
 * const updated = await updateNote('abc123', { title: 'Revised Title', pinned: true });
 * ```
 */
export async function updateNote(id: string, data: Partial<Note>): Promise<Note> {
  try {
    const now = nowISO();
    await db.notes.update(id, { ...data, updatedAt: now });
    const updated = await db.notes.get(id);
    if (!updated) throw new Error(`noteRepository.updateNote: note ${id} not found after update`);
    // Fire-and-forget KB graph sync
    getSyncModule().then((m) => m.syncNote(id)).catch(() => {});
    return updated as Note;
  } catch (e) {
    throw new Error(`noteRepository.updateNote failed: ${e}`);
  }
}

/**
 * Permanently deletes a {@link Note} record from IndexedDB.
 *
 * @remarks
 * This operation is irreversible.  The caller is responsible for any
 * confirmation prompts before invoking this function.
 *
 * @param id - The ID of the note to delete.
 * @returns A promise that resolves when the deletion is complete.
 * @throws {Error} If the Dexie delete operation throws.
 *
 * @example
 * ```ts
 * await deleteNote('abc123');
 * ```
 */
export async function deleteNote(id: string): Promise<void> {
  try {
    await db.notes.delete(id);
    // Fire-and-forget KB graph cleanup
    getSyncModule().then((m) => m.deleteNoteNode(id)).catch(() => {});
  } catch (e) {
    throw new Error(`noteRepository.deleteNote failed: ${e}`);
  }
}

/** Soft-deletes a note (the user-facing delete). Enlist in a cascade via `txId`. No-op if missing or already deleted. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.notes.get(id);
    if (!row) return;
    if ((row as Note).deletedAt) return;
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.notes.update(id, {
      deletedAt: now,
      softDeletedBy: finalTxId,
      updatedAt: now,
    });
    // Drop the note's KB node. Only the hard-delete path used to do this, but
    // every user-facing delete routes through here — so a deleted note kept its
    // node and stayed listed in the Knowledge Base, where opening it produced a
    // reader for a row the rest of the app treats as gone. The Session Notes
    // panel was unaffected only because it intersects nodes with live notes.
    getSyncModule().then((m) => m.deleteNoteNode(id)).catch(() => {});
  } catch (e) {
    throw new Error(`noteRepository.softDelete failed: ${e}`);
  }
}

/**
 * Soft-deletes a note **and its edges** atomically under one transaction id.
 *
 * @remarks
 * The two-call form — `deleteLinksForNote` then `softDelete` — is not atomic, and
 * either failure order corrupts something: stopping after the links leaves a live
 * note that has silently lost its `promoted_into` provenance and cannot be
 * repaired (`restore` no-ops on a live note, so `restoreLinksForTxId` is
 * unreachable); stopping after the note leaves a dangling edge that exports into
 * a bundle whose `notes` array excludes the target.
 *
 * One transaction removes the choice. `deleteNoteNode` stays outside it, as
 * fire-and-forget — mirroring {@link restore}, which has always wrapped the same
 * pair this way.
 */
export async function softDeleteWithLinks(id: string, txId?: string): Promise<void> {
  const finalTxId = txId ?? generateSoftDeleteTxId();
  try {
    await db.transaction('rw', [db.notes, db.entityLinks], async () => {
      const row = await db.notes.get(id);
      if (!row) return;
      if ((row as Note).deletedAt) return;
      const now = nowISO();
      await db.notes.update(id, {
        deletedAt: now,
        softDeletedBy: finalTxId,
        updatedAt: now,
      });
      await entityLinkRepository.deleteLinksForNote(id, finalTxId);
    });
    getSyncModule().then((m) => m.deleteNoteNode(id)).catch(() => {});
  } catch (e) {
    throw new Error(`noteRepository.softDeleteWithLinks failed: ${e}`);
  }
}

/** Restores a soft-deleted note. No-op if missing or already live. */
export async function restore(id: string): Promise<void> {
  try {
    // Rehydrate the note and its cascaded edges atomically. The delete path
    // (useNoteActions) soft-deletes the note's `contains` edges under the same
    // txId expressly so restore can bring them back — without this, a restored
    // note reappears orphaned from its session/encounter. Mirrors
    // encounterRepository.restore / creatureTemplateRepository.restore.
    await db.transaction('rw', [db.notes, db.entityLinks], async () => {
      const row = await db.notes.get(id);
      if (!row) return;
      if (!(row as Note).deletedAt) return;
      const txId = (row as Note).softDeletedBy;
      await db.notes.update(id, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: nowISO(),
      });
      if (txId) {
        await entityLinkRepository.restoreLinksForTxId(txId);
      }
    });
    // Rebuild the KB node that softDelete removed, so a restored note is
    // browsable again rather than surviving only in the notes table.
    getSyncModule().then((m) => m.syncNote(id)).catch(() => {});
  } catch (e) {
    throw new Error(`noteRepository.restore failed: ${e}`);
  }
}

/** Permanently removes a note row. Internal only — never called from UI, which soft-deletes. */
export async function hardDelete(id: string): Promise<void> {
  try {
    await db.notes.delete(id);
  } catch (e) {
    throw new Error(`noteRepository.hardDelete failed: ${e}`);
  }
}

/**
 * Retrieves all session-log entries (`type: 'log'`) for a given session,
 * sorted chronologically by `createdAt` ascending, excluding soft-deleted rows.
 *
 * @param sessionId - The ID of the session whose log entries should be fetched.
 * @returns An array of validated log-entry notes in chronological order.
 * @throws {Error} If the Dexie query throws an unexpected error.
 */
export async function listLogEntriesBySession(sessionId: string): Promise<Note[]> {
  try {
    const records = await db.notes.where('sessionId').equals(sessionId).toArray();
    const parsed = records
      .map(record => {
        const result = baseNoteSchema.safeParse(record);
        if (!result.success) {
          console.warn('noteRepository.listLogEntriesBySession: validation failed', result.error);
          return undefined;
        }
        return result.data;
      })
      .filter((n): n is Note => n !== undefined)
      .filter(n => n.type === 'log');
    return excludeDeleted(parsed).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch (e) {
    throw new Error(`noteRepository.listLogEntriesBySession failed: ${e}`);
  }
}

/**
 * Creates a new session-log entry note.
 *
 * @remarks
 * Fixes `type: 'log'`, `title: ''`, `status: 'active'`, `pinned: false` for
 * every log entry — only `sessionId`, `campaignId`, `body`, and any other
 * caller-supplied fields vary.
 *
 * @param data - Fields required to create a log entry, minus the fixed ones.
 * @returns The newly created log-entry note.
 */
export async function createLogEntry(
  data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'type' | 'title' | 'status' | 'pinned'>
): Promise<Note> {
  assertProseMirrorBody(data.body, 'createLogEntry');
  return createNote({
    ...data,
    type: 'log',
    title: '',
    status: 'active',
    pinned: false,
  });
}

/**
 * Rejects a log-entry body that is not a ProseMirror document.
 *
 * @remarks
 * `Note.body` is `z.unknown()`, so nothing in the type system stops a caller
 * passing a raw string — and `resolveWikiLinks()` returns `''` for any
 * non-object body, so such an entry would **silently export as empty**. The
 * text would look fine in the app and vanish from the after-action report.
 *
 * Callers must convert with `textToDoc()` first. Failing loudly here turns a
 * silent data-loss bug into an immediate, obvious one — and the capture UI
 * already retains the draft text when a commit rejects, so the entry is not
 * lost when this fires.
 */
function assertProseMirrorBody(body: unknown, method: string): void {
  if (body === null || typeof body !== 'object') {
    throw new Error(
      `noteRepository.${method}: body must be a ProseMirror doc object, got ${typeof body}. ` +
        `Convert with textToDoc() first — a raw string exports as empty.`,
    );
  }
}

/**
 * Updates the body of an existing log entry.
 *
 * @remarks
 * Preserves the original `createdAt` so the edited entry keeps its position
 * in the chronological timeline; only `body` and `updatedAt` change.
 *
 * @param id   - The ID of the log entry to update.
 * @param body - The new body content.
 * @returns The updated log-entry note.
 */
export async function updateLogEntry(id: string, body: unknown): Promise<Note> {
  assertProseMirrorBody(body, 'updateLogEntry');
  try {
    // Delegates to updateNote, which spreads only the fields passed and stamps
    // updatedAt. Omitting createdAt is what preserves it — re-passing the old
    // value would work too, but it is a pointless rewrite and would silently
    // clobber the field if the read that produced it were ever stale.
    return await updateNote(id, { body });
  } catch (e) {
    throw new Error(`noteRepository.updateLogEntry failed: ${e}`);
  }
}

/**
 * Creates a note from a selection of log entries and links every source entry
 * to it with a `promoted_into` edge.
 *
 * @remarks
 * The note and its lineage edges are written in a single transaction so a
 * failure cannot leave a promoted note with no record of where it came from.
 *
 * The KB graph sync runs *after* the transaction commits, not inside it —
 * `syncNote` opens its own transaction, and nesting it here would deadlock.
 * Skipping this sync is what previously made promoted notes invisible in the
 * Session Notes panel and the Knowledge Base until an unrelated full graph
 * rebuild happened to run.
 *
 * Unlike {@link createNote}, the sync is **awaited**. Callers refresh the
 * session-notes and timeline surfaces as soon as this resolves, and those
 * surfaces read `kb_nodes`; leaving it fire-and-forget makes that refresh race
 * the sync and re-query before the node exists. Errors are still swallowed —
 * the note is committed by then, so a graph failure must not present as a
 * failed promote.
 *
 * @param entries - The source log entries being promoted. Never modified or deleted.
 * @param data    - Fields for the new note; `body` must already be a ProseMirror doc.
 * @returns The id of the newly created note.
 */
export async function promoteEntriesToNewNote(
  entries: Note[],
  data: Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'status' | 'pinned'>,
): Promise<string> {
  assertProseMirrorBody(data.body, 'promoteEntriesToNewNote');
  const noteId = generateId();
  try {
    const now = nowISO();
    await db.transaction('rw', [db.notes, db.entityLinks], async () => {
      await db.notes.add({
        ...data,
        id: noteId,
        status: 'active',
        pinned: false,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      } as Note);
      await addPromotedIntoEdges(entries, noteId, now);
    });
  } catch (e) {
    throw new Error(`noteRepository.promoteEntriesToNewNote failed: ${e}`);
  }
  await getSyncModule().then(m => m.syncNote(noteId)).catch(() => {});
  return noteId;
}

/**
 * Appends a selection of log entries onto an existing note and links every
 * source entry to it with a `promoted_into` edge.
 *
 * @remarks
 * `buildBody` receives the target note's current body and returns the combined
 * body. It runs *inside* the transaction so the read-modify-write cannot
 * interleave with a concurrent edit of the same note. It must be pure — the
 * repository layer deliberately does not import the feature-layer
 * `textToDoc`/`extractText` helpers the caller uses to build that body.
 *
 * @param entries      - The source log entries being appended. Never modified or deleted.
 * @param targetNoteId - The note to append onto. Its title is left unchanged.
 * @param buildBody    - Pure combiner from the existing body to the new body.
 */
export async function appendEntriesToNote(
  entries: Note[],
  targetNoteId: string,
  buildBody: (existingBody: unknown) => unknown,
): Promise<void> {
  try {
    const now = nowISO();
    await db.transaction('rw', [db.notes, db.entityLinks], async () => {
      const existing = await db.notes.get(targetNoteId);
      if (!existing) {
        throw new Error(`target note ${targetNoteId} not found`);
      }
      // A soft-deleted target is not a valid append destination. The promote
      // sheet snapshots the note list when it opens, so a note deleted in
      // another tab (or by the review sweep) stays selectable — and appending
      // to it wrote the user's text into a tombstone no surface reads, while
      // `addPromotedIntoEdges` created *live* edges pointing at a deleted note.
      // That is precisely the dangling-edge state `softDeleteWithLinks` exists
      // to prevent, arrived at from the other direction.
      if ((existing as Note).deletedAt) {
        throw new Error(`target note ${targetNoteId} has been deleted`);
      }
      const body = buildBody((existing as Note).body);
      assertProseMirrorBody(body, 'appendEntriesToNote');
      await db.notes.update(targetNoteId, { body, updatedAt: now });
      await addPromotedIntoEdges(entries, targetNoteId, now);
    });
  } catch (e) {
    throw new Error(`noteRepository.appendEntriesToNote failed: ${e}`);
  }
  // Awaited for the same reason as promoteEntriesToNewNote — the caller
  // refreshes KB-backed surfaces the moment this resolves.
  await getSyncModule().then(m => m.syncNote(targetNoteId)).catch(() => {});
}

/** Adds one `promoted_into` edge per source entry. Caller supplies the transaction. */
async function addPromotedIntoEdges(entries: Note[], targetNoteId: string, now: string): Promise<void> {
  for (const entry of entries) {
    await db.entityLinks.add({
      id: generateId(),
      fromEntityId: entry.id,
      fromEntityType: 'note',
      toEntityId: targetNoteId,
      toEntityType: 'note',
      relationshipType: 'promoted_into',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Merges `tags` into every supplied note, leaving all other fields untouched.
 *
 * @remarks
 * Routed through {@link updateNote} so each note re-syncs into the KB graph.
 * For `type: 'log'` entries `syncNote` is a no-op by design, but tagging is
 * offered on ordinary notes too and those do need the sync.
 *
 * @param notes - The notes to tag.
 * @param tags  - Tags to merge in; existing tags are preserved and de-duplicated.
 */
export async function addTagsToNotes(notes: Note[], tags: string[]): Promise<void> {
  try {
    for (const note of notes) {
      const merged = Array.from(new Set([...(note.tags ?? []), ...tags]));
      await updateNote(note.id, { tags: merged });
    }
  } catch (e) {
    throw new Error(`noteRepository.addTagsToNotes failed: ${e}`);
  }
}
