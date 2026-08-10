import type { Attachment } from '../../types/attachment';
import type { Note } from '../../types/note';
import { yamlValue } from './yamlValue';


/**
 * Renders a Markdown sidecar file carrying an attachment's metadata.
 *
 * @remarks
 * The binary itself is written separately; this companion `.md` preserves the
 * caption, original filename, and provenance (which note/session/campaign it
 * belongs to) so the context survives an export into a plain-file vault.
 */
export function renderAttachmentSidecar(attachment: Attachment, parentNote: Note): string {
  const fields: Record<string, unknown> = {
    title: parentNote.title,
    type: parentNote.type,
    noteId: attachment.noteId,
    sessionId: parentNote.sessionId ?? '',
    campaignId: attachment.campaignId,
    caption: attachment.caption ?? '',
    originalFilename: attachment.filename,
    createdAt: attachment.createdAt,
  };

  const lines = Object.entries(fields)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);

  return `---\n${lines.join('\n')}\n---\n\nSidecar metadata for ![[${attachment.filename}]]\n`;
}
