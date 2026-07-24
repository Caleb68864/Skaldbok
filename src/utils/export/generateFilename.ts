/**
 * Builds a stable, filesystem-safe `.md` filename for a note.
 *
 * @remarks
 * Slugifies the title and appends the last six characters of the note id so two
 * notes sharing a title still export to distinct files. An empty or
 * whitespace-only title falls back to `note-<idSuffix>.md`.
 */
export function generateFilename(note: { title: string; id: string }): string {
  const idSuffix = note.id.slice(-6);
  if (!note.title || !note.title.trim()) {
    return `note-${idSuffix}.md`;
  }
  const slug = note.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${slug}-${idSuffix}.md`;
}
