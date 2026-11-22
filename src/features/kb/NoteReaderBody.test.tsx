// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * A note whose body would not parse rendered as an empty note, with no message.
 *
 * @remarks
 * `NoteReader` parsed `note.body` in a bare `catch {}` and left the editor
 * empty, so the user could not tell a blank note from a damaged one. The first
 * case fails against that code; the second pins that a readable body shows no
 * alert.
 */

const loadNoteForReader = vi.fn();
vi.mock('./loadNoteForReader', () => ({
  loadNoteForReader: (...a: unknown[]) => loadNoteForReader(...a),
}));
vi.mock('./KnowledgeBaseContext', () => ({
  useForwardLinks: () => ({ edges: [], error: null }),
}));
vi.mock('./BacklinksPanel', () => ({ BacklinksPanel: () => null }));
vi.mock('./NoteAttachments', () => ({ NoteAttachments: () => null }));
vi.mock('../notes/NotePrivacy', () => ({
  NotePrivacyToggle: () => null,
  PrivateBadge: () => null,
}));
const deleteNote = vi.fn();
const showToast = vi.fn();
const navigate = vi.fn();
vi.mock('../notes/useNoteActions', () => ({ useNoteActions: () => ({ deleteNote }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));
vi.mock('../../components/primitives/ConfirmDialog', () => ({
  useConfirm: () => ({ confirm: vi.fn() }),
}));

import { NoteReader } from './NoteReader';

function wrap(children: ReactNode) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function loaded(body: unknown) {
  return {
    kind: 'found',
    kbNode: null,
    note: { id: 'note-1', campaignId: 'c1', title: 'Grimsby', body, visibility: 'public', tags: [] },
    attachments: [],
    attachmentsError: null,
  };
}

beforeEach(() => {
  loadNoteForReader.mockReset();
  deleteNote.mockReset();
  showToast.mockReset();
  navigate.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NoteReader body', () => {
  it('says a body that does not parse is damaged', async () => {
    loadNoteForReader.mockResolvedValue(loaded('{not json'));
    render(wrap(<NoteReader noteId="note-1" />));
    expect(await screen.findByText('Grimsby')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('damaged');
  });

  it('shows no alert for a readable body', async () => {
    loadNoteForReader.mockResolvedValue(
      loaded({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Docks at dawn' }] }] }),
    );
    render(wrap(<NoteReader noteId="note-1" />));
    expect(await screen.findByText('Docks at dawn')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

/**
 * `deleteNote` catches and toasts its own failure and never rejected, so the
 * reader went on to navigate away and show "<title> deleted" with an Undo,
 * after a delete that had not happened. The first case fails against that.
 */
describe('NoteReader delete', () => {
  const readable = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }] };

  it('stays on the note and claims nothing when the delete failed', async () => {
    loadNoteForReader.mockResolvedValue(loaded(readable));
    deleteNote.mockResolvedValue(false);
    render(wrap(<NoteReader noteId="note-1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteNote).toHaveBeenCalledWith('note-1'));
    expect(navigate).not.toHaveBeenCalled();
    expect(showToast.mock.calls.some((c) => String(c[0]).includes('deleted'))).toBe(false);
  });

  it('leaves and offers Undo when it succeeded', async () => {
    loadNoteForReader.mockResolvedValue(loaded(readable));
    deleteNote.mockResolvedValue(true);
    render(wrap(<NoteReader noteId="note-1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(-1));
    expect(showToast.mock.calls.find((c) => String(c[0]) === 'Grimsby deleted')?.[2]?.action?.label).toBe('Undo');
  });
});
