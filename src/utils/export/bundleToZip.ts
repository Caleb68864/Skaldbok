import JSZip from 'jszip';

/**
 * Packs a filename → content map into a single zip blob via JSZip.
 *
 * @remarks
 * The final step of a Markdown/attachment export: strings and Blobs alike are
 * added under their map keys, so callers assemble the whole file tree in memory
 * and hand it over in one call.
 */
export async function bundleToZip(files: Map<string, string | Blob>): Promise<Blob> {
  const zip = new JSZip();
  for (const [filename, content] of files) {
    zip.file(filename, content);
  }
  return await zip.generateAsync({ type: 'blob' });
}
