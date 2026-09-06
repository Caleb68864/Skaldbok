import { describe, it, expect } from 'vitest';
import { buildAttachmentFiles } from './attachmentFiles';
import { excludePrivateNotes } from './privacyFilter';
import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';

function note(id: string, title: string, visibility?: 'private' | 'public'): Note {
  return {
    id,
    campaignId: 'c1',
    title,
    type: 'generic',
    body: '',
    tags: [],
    visibility,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Note;
}

function attachment(id: string, noteId: string, filename: string): Attachment {
  return {
    id,
    noteId,
    campaignId: 'c1',
    filename,
    mimeType: 'image/jpeg',
    sizeBytes: 3,
    blob: new Blob(['img']),
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Attachment;
}

const ATTACHMENTS: Record<string, Attachment[]> = {
  public1: [attachment('a1', 'public1', 'map.jpg')],
  secret1: [attachment('a2', 'secret1', 'the-twist.jpg')],
};

const load = async (noteId: string) => ATTACHMENTS[noteId] ?? [];

describe('buildAttachmentFiles', () => {
  it('writes the blob and a sidecar for each attachment', async () => {
    const files = await buildAttachmentFiles([note('public1', 'The Map')], load, 'attachments/session-1');
    expect([...files.keys()]).toEqual([
      'attachments/session-1/map.jpg',
      'attachments/session-1/map.md',
    ]);
    expect(files.get('attachments/session-1/map.jpg')).toBeInstanceOf(Blob);
    expect(files.get('attachments/session-1/map.md')).toContain('The Map');
  });

  it('ships nothing for a private note once the caller has filtered', async () => {
    // The regression: exportSessionBundle filtered private notes out of the
    // Markdown and then looped the unfiltered list here, so the photo and a
    // sidecar naming the note shipped anyway.
    const linked = [note('public1', 'The Map'), note('secret1', 'The Twist', 'private')];
    const files = await buildAttachmentFiles(excludePrivateNotes(linked), load, 'attachments/session-1');
    const paths = [...files.keys()].join('\n');
    expect(paths).not.toContain('the-twist');
    const contents = [...files.values()].filter(v => typeof v === 'string').join('\n');
    expect(contents).not.toContain('The Twist');
  });

  it('does not let a png sidecar overwrite the image', async () => {
    // The old path did filename.replace('.jpg', '.md'), which left a .png name
    // untouched — the sidecar then took the image's own key in the ZIP.
    const files = await buildAttachmentFiles(
      [note('n1', 'Portrait')],
      async () => [attachment('a3', 'n1', 'portrait.png')],
      'attachments/session-1',
    );
    expect([...files.keys()]).toEqual([
      'attachments/session-1/portrait.png',
      'attachments/session-1/portrait.md',
    ]);
    expect(files.get('attachments/session-1/portrait.png')).toBeInstanceOf(Blob);
  });

  it('appends .md when the filename has no extension', async () => {
    const files = await buildAttachmentFiles(
      [note('n1', 'Scan')],
      async () => [attachment('a4', 'n1', 'scan')],
      'attachments/session-1',
    );
    expect([...files.keys()]).toContain('attachments/session-1/scan.md');
  });

  it('files each note under its own folder when given a resolver', async () => {
    const files = await buildAttachmentFiles(
      [note('public1', 'The Map'), note('n1', 'Loose')],
      async id => (id === 'public1' ? ATTACHMENTS.public1 : [attachment('a5', 'n1', 'loose.jpg')]),
      n => (n.id === 'public1' ? 'attachments/abc12345' : 'attachments/unsorted'),
    );
    expect([...files.keys()]).toEqual([
      'attachments/abc12345/map.jpg',
      'attachments/abc12345/map.md',
      'attachments/unsorted/loose.jpg',
      'attachments/unsorted/loose.md',
    ]);
  });

  it('returns nothing for a note with no attachments', async () => {
    const files = await buildAttachmentFiles([note('empty', 'Nothing')], load, 'attachments/session-1');
    expect(files.size).toBe(0);
  });
});
