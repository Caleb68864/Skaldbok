import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadNoteForReader } from './loadNoteForReader';

/**
 * `NoteReader` reported a storage failure as "Note not found."
 *
 * @remarks
 * The loader was one bare `catch {}` that set `notFound`, so a rejected read
 * told the user their note was gone, and an attachments read that failed after
 * the note had loaded replaced a note that exists with "Note not found." too.
 * Before the extraction there was no outcome other than found / not-found to
 * assert; the `error` and `attachmentsError` cases below are the two the old
 * code could not express.
 */

const getNodeById = vi.fn();
const getNoteById = vi.fn();
const getAttachmentsByNote = vi.fn();

vi.mock('../../storage/repositories/kbNodeRepository', () => ({
  getNodeById: (...a: unknown[]) => getNodeById(...a),
}));
vi.mock('../../storage/repositories/noteRepository', () => ({
  getNoteById: (...a: unknown[]) => getNoteById(...a),
}));
vi.mock('../../storage/repositories/attachmentRepository', () => ({
  getAttachmentsByNote: (...a: unknown[]) => getAttachmentsByNote(...a),
}));

const note = { id: 'n1', title: 'Grimsby' };

beforeEach(() => {
  getNodeById.mockReset();
  getNoteById.mockReset();
  getAttachmentsByNote.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('loadNoteForReader', () => {
  it('reports a rejected read as an error with its message, not as not-found', async () => {
    getNodeById.mockRejectedValue(new Error('DatabaseClosedError'));
    expect(await loadNoteForReader('n1')).toEqual({ kind: 'error', message: 'DatabaseClosedError' });
  });

  it('keeps a loaded note when only its attachments fail to read', async () => {
    getNodeById.mockResolvedValue(undefined);
    getNoteById.mockResolvedValue(note);
    getAttachmentsByNote.mockRejectedValue(new Error('attachments: quota'));
    const result = await loadNoteForReader('n1');
    expect(result).toMatchObject({
      kind: 'found',
      note,
      attachments: [],
      attachmentsError: 'attachments: quota',
    });
  });

  it('is not-found only when the lookups genuinely return nothing', async () => {
    getNodeById.mockResolvedValue(undefined);
    getNoteById.mockResolvedValue(undefined);
    expect(await loadNoteForReader('missing')).toEqual({ kind: 'not-found' });
  });

  it('resolves a kb node id through its sourceId', async () => {
    const node = { id: 'note-n1', sourceId: 'n1' };
    getNodeById.mockResolvedValue(node);
    getNoteById.mockResolvedValue(note);
    getAttachmentsByNote.mockResolvedValue([]);
    expect(await loadNoteForReader('note-n1')).toEqual({
      kind: 'found', note, kbNode: node, attachments: [], attachmentsError: null,
    });
    expect(getNoteById).toHaveBeenCalledWith('n1');
  });

  it('treats a failed kb-node lookup on the direct-id path as best effort', async () => {
    getNodeById.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('kb'));
    getNoteById.mockResolvedValue(note);
    getAttachmentsByNote.mockResolvedValue([]);
    expect(await loadNoteForReader('n1')).toMatchObject({ kind: 'found', kbNode: null });
  });
});
