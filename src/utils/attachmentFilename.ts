/**
 * Reduces an attachment's stored filename to a safe single path segment.
 *
 * @remarks
 * An attachment's `filename` can arrive in a bundle, and on export it is used
 * verbatim as the entry path inside a ZIP. A name like `../../.ssh/authorized_keys`
 * is then written outside the intended directory by whatever extracts the
 * archive — zip-slip, aimed not at this app but at whoever the user shares the
 * bundle with.
 *
 * Everything up to the last separator is dropped, so a path becomes its base
 * name; the rest is reduced to characters that are safe on every filesystem.
 * A name that reduces to nothing (or to a directory reference) falls back to
 * `attachment`, keeping any recognisable extension.
 *
 * The extension is preserved separately because the sidecar writer replaces it,
 * and because `.jpg` is what tells the reader's viewer how to open the file.
 *
 * @param filename - The stored name, from any source.
 * @returns A single path segment safe to place inside an archive.
 */
export function safeAttachmentFilename(filename: unknown): string {
  if (typeof filename !== 'string' || filename.trim() === '') return 'attachment';

  // Both separators: a bundle written on Windows carries backslashes, and a
  // POSIX extractor does not treat those as separators, so stripping only `/`
  // would leave `..\..\x.jpg` intact.
  const base = filename.split(/[/\\]/).pop() ?? '';

  const dot = base.lastIndexOf('.');
  const rawStem = dot > 0 ? base.slice(0, dot) : base;
  const rawExt = dot > 0 ? base.slice(dot + 1) : '';

  const stem = rawStem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  const ext = rawExt.replace(/[^A-Za-z0-9]+/g, '').slice(0, 8);

  const safeStem = stem === '' ? 'attachment' : stem.slice(0, 100);
  return ext === '' ? safeStem : `${safeStem}.${ext}`;
}
