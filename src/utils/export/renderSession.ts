import type { Session } from '../../types/session';
import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import { generateFilename } from './generateFilename';
import { renderNoteToMarkdown } from './renderNote';
import { docToText } from '../../features/notes/textToDoc';
import { yamlValue } from './yamlValue';


function deduplicateFilename(filename: string, existing: Set<string>): string {
  if (!existing.has(filename)) return filename;
  const base = filename.replace(/\.md$/, '');
  let counter = 2;
  let candidate = `${base}-${counter}.md`;
  while (existing.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}.md`;
  }
  return candidate;
}

/**
 * Renders a session and its notes into a map of filename → Markdown content.
 *
 * @remarks
 * Produces a session index file plus one file per linked note, ready to write
 * into a zip. Filenames are deduplicated up front so two notes with the same
 * title cannot clobber one another in the archive.
 *
 * @returns A map keyed by output filename; the session index is included
 * alongside each note file.
 */
function formatEntryTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function renderSessionLogSection(logEntries: Note[]): string {
  if (logEntries.length === 0) return '';
  const sorted = [...logEntries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const entryLines = sorted.map(entry => {
    const timestamp = formatEntryTime(entry.createdAt);
    const text = docToText(entry.body);
    return `**${timestamp}** — ${text}`;
  });
  return `\n\n## Session Log\n\n${entryLines.join('\n\n')}\n`;
}

export function renderSessionBundle(
  session: Session,
  linkedNotes: Note[],
  entityLinks: EntityLink[]
): Map<string, string> {
  const files = new Map<string, string>();
  const usedFilenames = new Set<string>();

  const logEntries = linkedNotes.filter(n => n.type === 'log');
  const otherNotes = linkedNotes.filter(n => n.type !== 'log');

  // Build note filenames first
  const noteFilenameMap = new Map<string, string>();
  for (const note of otherNotes) {
    const rawFilename = generateFilename(note);
    const uniqueFilename = deduplicateFilename(rawFilename, usedFilenames);
    usedFilenames.add(uniqueFilename);
    noteFilenameMap.set(note.id, uniqueFilename);
  }

  // Session index file
  const sessionFilenameRaw = generateFilename({ title: session.title, id: session.id });
  const sessionFilename = deduplicateFilename(sessionFilenameRaw, usedFilenames);
  usedFilenames.add(sessionFilename);

  const noteFilenames = Array.from(noteFilenameMap.values());
  const frontMatterFields: Record<string, unknown> = {
    title: session.title,
    id: session.id,
    campaignId: session.campaignId,
    status: session.status,
    date: session.date,
    startedAt: session.startedAt,
    endedAt: session.endedAt ?? '',
    linkedNotes: noteFilenames,
  };
  const frontMatterLines = Object.entries(frontMatterFields)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`);
  const frontMatter = `---\n${frontMatterLines.join('\n')}\n---`;

  const noteListBody = otherNotes.length > 0
    ? `## Notes\n\n` + otherNotes.map(n => `- [[${n.title}]]`).join('\n') + '\n'
    : `## Notes\n\nNo notes in this session.\n`;

  const logSection = renderSessionLogSection(logEntries);

  files.set(sessionFilename, frontMatter + '\n\n' + noteListBody + logSection);

  // Render each note
  for (const note of otherNotes) {
    const noteLinks = entityLinks.filter(
      l => l.fromEntityId === note.id || l.toEntityId === note.id
    );
    const noteMarkdown = renderNoteToMarkdown(note, noteLinks, otherNotes);
    const filename = noteFilenameMap.get(note.id)!;
    files.set(filename, noteMarkdown);
  }

  return files;
}
