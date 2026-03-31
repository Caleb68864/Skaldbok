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
