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

/**
 * Renders a note as an Obsidian-flavoured Markdown file with YAML front matter.
 *
 * @remarks
 * The Markdown export targets a personal knowledge base, so entity links become a
 * `related` front-matter list, mentions in the body are rewritten to `[[wiki
 * links]]` (see {@link resolveWikiLinks}), and attachments are appended as
 * embeds. `allNotes` is the title lookup that lets a mention resolve to a
 * human-readable link target rather than a raw id.
 *
 * @param note - The note to render.
 * @param entityLinks - Links touching this note, surfaced as `related` targets.
 * @param allNotes - Id/title pairs used to resolve wiki-link targets.
 * @param attachmentFilenames - Filenames to embed under an Attachments heading.
 */
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
