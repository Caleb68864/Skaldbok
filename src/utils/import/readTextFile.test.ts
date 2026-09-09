import { describe, it, expect } from 'vitest';
import { readTextFile, MAX_IMPORT_FILE_BYTES } from './readTextFile';

/**
 * Every import entry point used to call `file.text()` with no size check, so
 * the first thing an untrusted file did was get fully decoded into a string —
 * and the bundle path then parses it, re-serialises it to verify the content
 * hash, and parses it again, so peak memory is a multiple of the file.
 */

/** A File whose reported size can be set independently of its contents. */
function fileOfSize(bytes: number, contents = 'x'): File {
  const file = new File([contents], 'bundle.skaldbok.json', { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

describe('readTextFile', () => {
  it('reads a file within the limit', async () => {
    const file = new File(['{"ok":true}'], 'b.json', { type: 'application/json' });
    expect(await readTextFile(file)).toBe('{"ok":true}');
  });

  it('refuses a file over the limit without reading it', async () => {
    await expect(readTextFile(fileOfSize(MAX_IMPORT_FILE_BYTES + 1))).rejects.toThrow(/import limit/);
  });

  it('accepts a file exactly at the limit', async () => {
    await expect(readTextFile(fileOfSize(MAX_IMPORT_FILE_BYTES))).resolves.toBe('x');
  });

  it('names both sizes so the message is actionable', async () => {
    await expect(readTextFile(fileOfSize(100 * 1024 * 1024))).rejects.toThrow(/100\.0 MB.*64\.0 MB/);
  });

  it('honours a tighter per-path limit', async () => {
    await expect(readTextFile(fileOfSize(2048), 1024)).rejects.toThrow(/2 KB.*1 KB/);
  });

  it('reads an empty file rather than treating it as a failure', async () => {
    // An empty file is a parse error, not a read error, and the callers say so
    // more usefully than a generic "could not be read".
    expect(await readTextFile(new File([], 'empty.json'))).toBe('');
  });
});
