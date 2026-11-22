import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import { resolveWikiLinks } from './resolveWikiLinks';
import { yamlValue } from './yamlValue';
import { inkStrokeCount } from '../../features/notes/ink/strokeModel';

/**
 * A line saying a note carries handwriting that Markdown cannot hold, or `''`.
 *
 * @remarks
 * Ink lives in `note.typeData`, which the JSON bundle carries and no Markdown
 * renderer can. Without this an ink-only note exported as an empty body and an
 * ink log entry as a bare timestamp, so nothing said content had been left
 * behind.
 */
export function inkNotice(note: Pick<Note, 'typeData'>, inkFilename?: string): string {
  const strokes = inkStrokeCount(note.typeData);
  if (strokes === 0) return '';
  // Exports that ship the drawing as an SVG beside the note embed it instead.
  if (inkFilename) return `![[${inkFilename}]]`;
  return `_[Handwritten page (${strokes} stroke${strokes === 1 ? '' : 's'}). Handwriting is not exported to Markdown; it is kept in a Skaldbok JSON export.]_`;
}


/**
 * Renders a note as an Obsidian-flavoured Markdown file with YAML front matter.
 *
 * @remarks
 * The Markdown export targets a personal knowledge base, so entity links become a
 * `related` front-matter list, mentions in the body are rewritten to `[[wiki
 * links]]` (see {@link utils/export/resolveWikiLinks!resolveWikiLinks | resolveWikiLinks}), and attachments are appended as
 * embeds. `allNotes` is the title lookup that lets a mention resolve to a
 * human-readable link target rather than a raw id.
 *
 * @param note - The note to render.
 * @param entityLinks - Links touching this note, surfaced as `related` targets.
 * @param allNotes - Id/title pairs used to resolve wiki-link targets.
 * @param attachmentFilenames - Filenames to embed under an Attachments heading.
 * @param inkFilename - The note's handwriting, written beside it as an SVG by
 *   the caller; embedded in place of the "not exported" notice.
 */
export function renderNoteToMarkdown(
  note: Note,
  entityLinks: EntityLink[],
  allNotes: Array<{ id: string; title: string }>,
  attachmentFilenames?: string[],
  inkFilename?: string,
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

  const ink = inkNotice(note, inkFilename);
  if (ink) result += (body.trim() === '' ? '' : '\n\n') + ink + '\n';

  if (attachmentFilenames && attachmentFilenames.length > 0) {
    result += '\n\n## Attachments\n\n';
    result += attachmentFilenames.map(f => `![[${f}]]`).join('\n');
    result += '\n';
  }

  return result;
}
