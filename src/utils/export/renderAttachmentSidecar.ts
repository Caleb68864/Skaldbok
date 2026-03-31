import type { Attachment } from '../../types/attachment';
import type { Note } from '../../types/note';

function yamlValue(val: unknown): string {
  if (val === null || val === undefined) return '""';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return '\n' + val.map(item => `  - ${yamlValue(item)}`).join('\n');
  }
  const str = String(val);
  if (str.includes(':') || str.includes('"') || str.includes("'") || str.includes('\n') || str.includes('#')) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

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
