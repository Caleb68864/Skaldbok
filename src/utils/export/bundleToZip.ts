import JSZip from 'jszip';

export async function bundleToZip(files: Map<string, string | Blob>): Promise<Blob> {
  const zip = new JSZip();
  for (const [filename, content] of files) {
    zip.file(filename, content);
  }
  return await zip.generateAsync({ type: 'blob' });
}
