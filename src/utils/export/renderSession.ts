import type { Session } from '../../types/session';
import type { Note } from '../../types/note';
import type { EntityLink } from '../../types/entityLink';
import { generateFilename } from './generateFilename';
import { renderNoteToMarkdown } from './renderNote';

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

export function renderSessionBundle(
  session: Session,
  linkedNotes: Note[],
  entityLinks: EntityLink[]
): Map<string, string> {
  const files = new Map<string, string>();
  const usedFilenames = new Set<string>();

  // Build note filenames first
  const noteFilenameMap = new Map<string, string>();
  for (const note of linkedNotes) {
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

  const noteListBody = linkedNotes.length > 0
    ? `## Notes\n\n` + linkedNotes.map(n => `- [[${n.title}]]`).join('\n') + '\n'
    : `## Notes\n\nNo notes in this session.\n`;

  files.set(sessionFilename, frontMatter + '\n\n' + noteListBody);

  // Render each note
  for (const note of linkedNotes) {
    const noteLinks = entityLinks.filter(
      l => l.fromEntityId === note.id || l.toEntityId === note.id
    );
    const noteMarkdown = renderNoteToMarkdown(note, noteLinks, linkedNotes);
    const filename = noteFilenameMap.get(note.id)!;
    files.set(filename, noteMarkdown);
  }

  return files;
}
