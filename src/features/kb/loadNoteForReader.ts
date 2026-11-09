import type { KBNode } from '../../storage/db/client';
import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';
import { getNodeById } from '../../storage/repositories/kbNodeRepository';
import { getNoteById } from '../../storage/repositories/noteRepository';
import { getAttachmentsByNote } from '../../storage/repositories/attachmentRepository';

/** What {@link loadNoteForReader} found. */
export type NoteReaderLoad =
  | {
      kind: 'found';
      note: Note;
      kbNode: KBNode | null;
      attachments: Attachment[];
      /** Set when the note loaded but its attachments could not be read. */
      attachmentsError: string | null;
    }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Resolves `id` — a `kb_nodes` id or a raw note id — to the note `NoteReader`
 * shows.
 *
 * @remarks
 * This was inline in `NoteReader` under one bare `catch {}` that set
 * `notFound`, which conflated three different outcomes:
 *
 * - a storage failure was reported as **"Note not found."** — telling the user
 *   their note is gone when the database merely refused a read;
 * - an attachment read that failed *after the note had loaded* replaced the
 *   whole note with "Note not found." too, so one bad attachments query hid
 *   a note that exists;
 * - only a lookup that genuinely returned nothing was actually "not found".
 *
 * The three are now distinct: `error` carries the message, an attachment
 * failure is reported beside a note that still renders, and `not-found` means
 * what it says. The KB-node lookup on the direct-id path is best effort for the
 * same reason — it only feeds the link panels.
 */
export async function loadNoteForReader(id: string): Promise<NoteReaderLoad> {
  let note: Note | undefined;
  let kbNode: KBNode | null = null;
  try {
    const node = await getNodeById(id);
    if (node) {
      kbNode = node;
      if (!node.sourceId) return { kind: 'not-found' };
      note = await getNoteById(node.sourceId);
    } else {
      note = await getNoteById(id);
    }
  } catch (err) {
    console.error(err);
    return { kind: 'error', message: messageOf(err) };
  }
  if (!note) return { kind: 'not-found' };

  if (!kbNode) {
    try {
      kbNode = (await getNodeById(`note-${note.id}`)) ?? null;
    } catch (err) {
      console.error(err);
    }
  }

  let attachments: Attachment[] = [];
  let attachmentsError: string | null = null;
  try {
    attachments = await getAttachmentsByNote(note.id);
  } catch (err) {
    console.error(err);
    attachmentsError = messageOf(err);
  }
  return { kind: 'found', note, kbNode, attachments, attachmentsError };
}
