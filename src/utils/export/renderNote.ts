import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import { resolveWikiLinks } from './resolveWikiLinks';

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

export function renderNoteToMarkdown(
  note: Note,
  entityLinks: EntityLink[],
  allNotes: Array<{ id: string; title: string }>,
  attachmentFilenames?: string[]
): string {
  // Build YAML front matter
  const frontMatterFields: Record<string, unknown> = {
    title: note.title,
    type: note.type,
    id: note.id,
    campaignId: note.campaignId,
    sessionId: note.sessionId ?? '',
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    tags: note.tags ?? [],
  };

  // Add entityLink IDs as related field
  if (entityLinks.length > 0) {
    frontMatterFields['related'] = entityLinks.map(l => l.toEntityId);
  }

  const frontMatterLines = Object.entries(frontMatterFields)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);

  const frontMatter = `---\n${frontMatterLines.join('\n')}\n---`;

  // Serialize body
  const body = resolveWikiLinks(note.body, allNotes);

  let result = frontMatter + '\n\n' + body;

  if (attachmentFilenames && attachmentFilenames.length > 0) {
    result += '\n\n## Attachments\n\n';
    result += attachmentFilenames.map(f => `![[${f}]]`).join('\n');
    result += '\n';
  }

  return result;
}
