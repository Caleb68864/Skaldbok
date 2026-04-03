/**
 * Attempts to share a file using the Web Share API, falling back to a direct
 * browser download when the Share API is unavailable or the share is rejected.
 *
 * @remarks
 * The Web Share API requires a user gesture and HTTPS. On platforms that do not
 * support file sharing (e.g. most desktop browsers), {@link downloadBlob} is
 * called automatically.  Common rejection reasons (`NotAllowedError` for async
 * gap, `AbortError` for user cancellation) also trigger the download fallback.
 *
 * @param blob     - The file data to share or download.
 * @param filename - The suggested file name, used for both the share title and
 *                   the download `filename` attribute.
 * @returns A promise that resolves when the share or download has been initiated.
 *
 * @example
 * ```ts
 * const blob = new Blob(['# Session 1\n...'], { type: 'text/markdown' });
 * await shareFile(blob, 'session-1.md');
 * ```
 */
export async function shareFile(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename);
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
    } catch {
      // NotAllowedError (async gap), AbortError (user cancelled), etc.
      downloadBlob(blob, filename);
    }
  } else {
    downloadBlob(blob, filename);
  }
}

/**
 * Copies a plain-text string to the system clipboard using the Clipboard API.
 *
 * @remarks
 * Requires the `clipboard-write` permission, which is automatically granted
 * in most browsers for pages served over HTTPS.
 *
 * @param markdown - The text content to copy (typically a Markdown string).
 * @returns A promise that resolves when the clipboard write completes.
 *
 * @example
 * ```ts
 * await copyToClipboard('# Session Notes\n- Fought the dragon');
 * ```
 */
export async function copyToClipboard(markdown: string): Promise<void> {
  await navigator.clipboard.writeText(markdown);
}

/**
 * Triggers a browser file download for the given `Blob` by creating a
 * temporary anchor element and programmatically clicking it.
 *
 * @remarks
 * The object URL created for the blob is revoked immediately after the click
 * to release the memory reference.  The actual download begins asynchronously
 * after the click, so the URL is still valid long enough for the browser to
 * start the transfer.
 *
 * @param blob     - The file data to download.
 * @param filename - The suggested file name presented in the browser's save dialog.
 *
 * @example
 * ```ts
 * const zip = await buildZip(notes);
 * downloadBlob(zip, 'campaign-notes.zip');
 * ```
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
