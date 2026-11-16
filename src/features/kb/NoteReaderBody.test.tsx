// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
vi.mock('../notes/useNoteActions', () => ({ useNoteActions: () => ({ deleteNote: vi.fn() }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
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
