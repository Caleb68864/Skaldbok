import { describe, it, expect } from 'vitest';
import { safeAttachmentFilename } from './attachmentFilename';

/**
 * An attachment's filename can arrive in an imported bundle, and on export it
 * becomes the entry path inside a ZIP. The risk is not to this app: it is to
 * whoever the user shares the archive with, whose extractor follows the path.
 */
describe('safeAttachmentFilename', () => {
  it('leaves an ordinary name alone', () => {
    expect(safeAttachmentFilename('map.jpg')).toBe('map.jpg');
    expect(safeAttachmentFilename('battle-map_2.png')).toBe('battle-map_2.png');
  });

  it('reduces a traversal path to its base name', () => {
    expect(safeAttachmentFilename('../../etc/passwd.jpg')).toBe('passwd.jpg');
    expect(safeAttachmentFilename('/absolute/path/map.png')).toBe('map.png');
  });

  it('handles Windows separators', () => {
    // A bundle written on Windows carries backslashes, and a POSIX extractor
    // does not treat those as separators — so stripping only `/` leaves the
    // traversal intact.
    expect(safeAttachmentFilename('..\\..\\secrets\\key.png')).toBe('key.png');
  });

  it('never returns a directory reference', () => {
    expect(safeAttachmentFilename('..')).toBe('attachment');
    expect(safeAttachmentFilename('.')).toBe('attachment');
    expect(safeAttachmentFilename('../')).toBe('attachment');
  });

  it('strips characters that are unsafe or awkward in a path', () => {
    expect(safeAttachmentFilename('my photo (1).jpg')).toBe('my-photo-1.jpg');
    expect(safeAttachmentFilename('a:b*c?.png')).toBe('a-b-c.png');
  });

  it('keeps a leading dot from making a hidden file', () => {
    expect(safeAttachmentFilename('.hidden.jpg')).toBe('hidden.jpg');
  });

  it('falls back for an empty or non-string name', () => {
    for (const value of ['', '   ', undefined, null, 42, {}]) {
      expect(safeAttachmentFilename(value)).toBe('attachment');
    }
  });

  it('bounds a very long name', () => {
    const out = safeAttachmentFilename(`${'a'.repeat(500)}.jpg`);
    expect(out.length).toBeLessThanOrEqual(110);
    expect(out.endsWith('.jpg')).toBe(true);
  });

  it('bounds a very long extension', () => {
    expect(safeAttachmentFilename(`x.${'y'.repeat(50)}`)).toBe('x.yyyyyyyy');
  });

  it('keeps a name that has no extension', () => {
    expect(safeAttachmentFilename('scan')).toBe('scan');
  });
});
