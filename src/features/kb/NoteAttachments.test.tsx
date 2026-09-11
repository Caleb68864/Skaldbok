// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { NoteAttachments, formatBytes } from './NoteAttachments';
import type { Attachment } from '../../types/attachment';

/**
 * The app could not create an attachment at all.
 *
 * @remarks
 * `attachmentRepository.createAttachment` had zero callers — verified across
 * the whole repository, where the only three matches were its own declaration,
 * its own `catch`, and the README line recording the gap — while `README.md`
 * listed "attachments" as a shipped Notes feature. Every one of these cases
 * fails against the previous `NoteReader`, which rendered
 * `att.caption || att.id` inside `{attachments.length > 0 && …}`: no control to
 * add one, no `<img>`, no way to set the caption whose absence made the chip
 * show a raw UUID.
 *
 * `deleteAttachment` is deliberately still unreachable — see the component's
 * remarks and `trashRegistry.RESTORE_WITHOUT_LISTING.attachments`.
 */

const createAttachment = vi.fn();
const updateAttachmentCaption = vi.fn();
const showToast = vi.fn();

vi.mock('../../storage/repositories/attachmentRepository', () => ({
  createAttachment: (...args: unknown[]) => createAttachment(...args),
  updateAttachmentCaption: (...args: unknown[]) => updateAttachmentCaption(...args),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

/** jsdom has no object-URL implementation; the component revokes what it creates. */
const created: string[] = [];
const revoked: string[] = [];
beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  vi.clearAllMocks();
  createAttachment.mockResolvedValue(undefined);
  updateAttachmentCaption.mockResolvedValue(undefined);
  URL.createObjectURL = vi.fn((): string => {
    const url = `blob:test/${created.length}`;
    created.push(url);
    return url;
  }) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => { revoked.push(url); });
});

// Globals are off, so Testing Library does not auto-clean.
afterEach(cleanup);

function attachment(over: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-1',
    noteId: 'note-1',
    campaignId: 'camp-1',
    filename: 'note-1-123.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 2048,
    blob: new Blob(['x'], { type: 'image/jpeg' }),
    createdAt: '2026-09-11T10:00:00.000Z',
    ...over,
  };
}

function renderGallery(attachments: Attachment[], onChanged = vi.fn()) {
  render(
    <NoteAttachments noteId="note-1" campaignId="camp-1" attachments={attachments} onChanged={onChanged} />,
  );
  return onChanged;
}

describe('NoteAttachments', () => {
  it('offers a way to add one even when the note has none', () => {
    // The previous gallery was `{attachments.length > 0 && …}`, so the empty
    // case rendered nothing at all — which is how a note with no attachments
    // could never get a first one.
    renderGallery([]);
    expect(screen.getByText('Add photo')).toBeDefined();
  });

  it('puts the chosen file into the repository', async () => {
    const onChanged = renderGallery([]);
    const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    await waitFor(() => expect(createAttachment).toHaveBeenCalledTimes(1));
    expect(createAttachment).toHaveBeenCalledWith('note-1', 'camp-1', file);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('says storage is full, distinctly from any other failure', async () => {
    // `createAttachment` re-labels a QuotaExceededError with its name preserved
    // for exactly this. Nothing read that label before.
    const quota = new Error('Storage full');
    quota.name = 'QuotaExceededError';
    createAttachment.mockRejectedValueOnce(quota);

    renderGallery([]);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['b'], 'p.jpg')] });
    fireEvent.change(input);

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][0]).toContain('Storage is full');
  });

  it('renders the image, not its id', () => {
    renderGallery([attachment({ id: 'b7c1e2f0-dead-beef' })]);
    const img = document.querySelector('img');
    expect(img, 'no <img> existed anywhere in the app; the gallery showed a raw UUID').not.toBeNull();
    expect(img!.getAttribute('src')).toBe(created[0]);
    expect(document.body.textContent).not.toContain('b7c1e2f0-dead-beef');
  });

  it('revokes the object URL it created', () => {
    const { unmount } = render(
      <NoteAttachments noteId="note-1" campaignId="camp-1" attachments={[attachment()]} onChanged={vi.fn()} />,
    );
    expect(created).toHaveLength(1);
    unmount();
    expect(revoked).toEqual(created);
  });

  it('describes the image to a screen reader by its caption', () => {
    renderGallery([attachment({ caption: 'The ruined tower' })]);
    expect(screen.getByAltText('The ruined tower')).toBeDefined();
  });

  it('saves an edited caption', async () => {
    const onChanged = renderGallery([attachment({ caption: '' })]);
    const input = screen.getByPlaceholderText('Add a caption');
    fireEvent.change(input, { target: { value: 'A map fragment' } });
    fireEvent.blur(input);

    await waitFor(() => expect(updateAttachmentCaption).toHaveBeenCalledWith('att-1', 'A map fragment'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('does not write a caption that did not change', () => {
    renderGallery([attachment({ caption: 'Same' })]);
    fireEvent.blur(screen.getByPlaceholderText('Add a caption'));
    expect(updateAttachmentCaption).not.toHaveBeenCalled();
  });

  it('shows what the photo costs, from the field that had no reader', () => {
    // `sizeBytes` is required, stamped on add and recomputed on import, and was
    // read by nothing anywhere in the app.
    renderGallery([attachment({ sizeBytes: 2048 })]);
    expect(screen.getByText('2 KB')).toBeDefined();
  });
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [2048, '2 KB'],
    [1024 * 1024 * 3, '3.0 MB'],
  ])('formats %i as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('says nothing rather than something wrong for a nonsense size', () => {
    expect(formatBytes(Number.NaN)).toBe('');
    expect(formatBytes(-1)).toBe('');
  });
});
