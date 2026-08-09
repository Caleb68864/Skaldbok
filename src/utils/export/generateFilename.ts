/**
 * Builds a stable, filesystem-safe `.md` filename for any exportable entity.
 *
 * @remarks
 * Slugifies the title and appends a short discriminator so two entities sharing
 * a title still export to distinct files. An empty or whitespace-only title
 * falls back to `<fallback>-<suffix>.md`.
 *
 * Split out from {@link generateFilename} rather than widening it: the note
 * signature is used by every existing export path, and the campaign ledger and
 * route are not notes.
 *
 * @param input - `title` is the human name; `suffix` disambiguates (an id tail,
 * or a date); `fallback` names the entity kind when the title is blank.
 */
export function generateEntityFilename(input: {
  title: string;
  suffix: string;
  fallback?: string;
}): string {
  const kind = input.fallback ?? 'export';
  const tail = input.suffix.slice(-6);
  if (!input.title || !input.title.trim()) {
    return `${kind}-${tail}.md`;
  }
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return `${slug}-${tail}.md`;
}

/**
 * Builds a stable, filesystem-safe `.md` filename for a note.
 *
 * @remarks
 * Slugifies the title and appends the last six characters of the note id so two
 * notes sharing a title still export to distinct files. An empty or
 * whitespace-only title falls back to `note-<idSuffix>.md`.
 */
export function generateFilename(note: { title: string; id: string }): string {
  return generateEntityFilename({ title: note.title, suffix: note.id, fallback: 'note' });
}
