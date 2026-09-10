/**
 * What became of a file the app tried to hand to the user.
 *
 * @remarks
 * `shareFile` used to return `Promise<void>`, so every caller's only signal was
 * "it did not throw" — and nothing in the download path could throw. That is
 * what let `exportCampaign` stamp `lastBackupAt`, the value the storage-safety
 * card turns green on, off a synchronous DOM call with no failure mode.
 *
 * `'cancelled'` is a distinct outcome rather than an error because the user
 * choosing not to share is not a failure: nothing should be reported, and
 * nothing should claim a backup was taken.
 */
export type DeliveryOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Attempts to share a file using the Web Share API, falling back to a direct
 * browser download when the Share API is unavailable or the share fails.
 *
 * @remarks
 * The Web Share API requires a user gesture and HTTPS. On platforms that do not
 * support file sharing (e.g. most desktop browsers), {@link downloadBlob} is
 * called automatically, and a share that fails for a technical reason
 * (`NotAllowedError` for an async gap, and anything else) falls back the same
 * way.
 *
 * A user *cancelling* the share sheet is different, and is now treated as such.
 * `AbortError` used to fall through to the download, so dismissing the sheet
 * still wrote a file to disk — and, on the campaign export, still reset the
 * backup reminder.
 *
 * @param blob     - The file data to share or download.
 * @param filename - The suggested file name, used for both the share title and
 *                   the download `filename` attribute.
 * @returns How the file was delivered, or `'cancelled'` if the user declined.
 * @throws If the download fallback could not be started.
 *
 * @example
 * ```ts
 * const blob = new Blob(['# Session 1\n...'], { type: 'text/markdown' });
 * const outcome = await shareFile(blob, 'session-1.md');
 * ```
 */
export async function shareFile(blob: Blob, filename: string): Promise<DeliveryOutcome> {
  const file = new File([blob], filename);
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
      return 'shared';
    } catch (err) {
      // The user dismissed the sheet. Writing a file they declined to share is
      // not a fallback, it is doing something they did not ask for.
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // NotAllowedError (async gap), unsupported target, etc.
      downloadBlob(blob, filename);
      return 'downloaded';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
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
 * Three things here are load-bearing, and none of them used to be.
 *
 * **The anchor is attached to the document.** A detached anchor's click is not
 * required to do anything; browsers that honour it do so as a courtesy.
 *
 * **The click is dispatched cancellably and its result is read.** A cancelled
 * click is the one refusal a page can actually observe, and it used to be
 * discarded — the function returned `void` whatever happened.
 *
 * **The object URL is revoked later, not on the next line.** The transfer
 * starts asynchronously after the click, so revoking synchronously is a race,
 * and one the export loses silently. The old docstring asserted the URL stayed
 * "valid long enough for the browser to start the transfer", which is a claim
 * about browser timing rather than a guarantee.
 *
 * All of that exists so that `await shareFile(...)` resolving means something.
 * `exportCampaign` stamps `lastBackupAt` on it, and that value is the whole
 * basis of the storage-safety card's claim that the campaign is backed up.
 *
 * @param blob     - The file data to download.
 * @param filename - The suggested file name presented in the browser's save dialog.
 * @throws If there is no document to attach the link to, if the browser cannot
 *   mint an object URL, or if the click is cancelled.
 *
 * @example
 * ```ts
 * const zip = await buildZip(notes);
 * downloadBlob(zip, 'campaign-notes.zip');
 * ```
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || !document.body) {
    throw new Error(`Cannot download ${filename}: there is no document to attach the link to.`);
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error(`Cannot download ${filename}: this browser cannot create object URLs.`);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    const started = a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    if (!started) {
      throw new Error(`The browser cancelled the download of ${filename}.`);
    }
  } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
  }
}

/**
 * How long a download's object URL is kept alive after the click.
 *
 * @remarks
 * Long enough that no browser is still deciding, short enough that a large
 * bundle is not pinned in memory for the session. Revoking on the next
 * synchronous line — what this used to do — is the pattern that has
 * historically failed outside Chromium.
 */
const OBJECT_URL_LIFETIME_MS = 60_000;
