/**
 * Largest import file the app will read into memory.
 *
 * @remarks
 * A campaign bundle is JSON with base64 attachments inline, so a real one is
 * large but bounded — a long campaign with a few dozen photos lands in single
 * -digit megabytes. 64 MB is well clear of that and still small enough that a
 * mistaken or hostile file cannot exhaust a tablet's memory before anything has
 * had a chance to look at it.
 *
 * The cap matters because reading is only the first pass: `parseBundle` parses
 * the text, `verifyContentHash` re-serialises and re-parses it, and a pre-v1
 * bundle is migrated and parsed again. Peak memory is a multiple of the file.
 */
export const MAX_IMPORT_FILE_BYTES = 64 * 1024 * 1024;

/** Human-readable size, for a message the user can act on. */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Reads a user-selected file as text, refusing an implausibly large one first.
 *
 * @remarks
 * Every import entry point used to call `file.text()` with no size check, so
 * the first thing an untrusted file did was get fully decoded into a string.
 * `file.size` is known without reading, so the check costs nothing.
 *
 * Throws with a message naming both sizes, which the callers already surface as
 * a toast — they all wrap the read in a try/catch.
 *
 * @param file - The file the user picked.
 * @param maxBytes - Override for a path with a tighter budget.
 */
export async function readTextFile(file: File, maxBytes = MAX_IMPORT_FILE_BYTES): Promise<string> {
  if (file.size > maxBytes) {
    throw new Error(
      `That file is ${formatBytes(file.size)}, larger than the ${formatBytes(maxBytes)} import limit.`,
    );
  }
  return file.text();
}
