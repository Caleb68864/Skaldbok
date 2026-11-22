// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * A failed note read in the editor navigated to /session and said nothing, so
 * a note that exists looked like a tap that did nothing. Fails on the old
 * screen, which toasted only for a note that was genuinely missing.
 */

const showToast = vi.fn();
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ isHydrated: true, activeCampaign: { id: 'c1', name: 'C', system: 'classic-fantasy' }, activeSession: null }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings: { customTags: {} }, updateSettings: () => {} }),
}));
vi.mock('../../components/notes/TiptapNoteEditor', () => ({ TiptapNoteEditor: () => null }));
vi.mock('../../components/notes/TagPicker', () => ({ TagPicker: () => null }));
vi.mock('../../storage/repositories/noteRepository', async (orig) => ({
  ...(await orig<typeof import('../../storage/repositories/noteRepository')>()),
  getNoteById: vi.fn().mockRejectedValue(new Error('IndexedDB read failed')),
}));

const { default: NoteEditorScreen } = await import('../../screens/NoteEditorScreen');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('NoteEditorScreen when the note cannot be read', () => {
  it('says so before leaving', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={['/note/n1/edit']}>
        <Routes>
          <Route path="/note/:id/edit" element={<NoteEditorScreen />} />
          <Route path="/session" element={<p>session</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(String(showToast.mock.calls[0][0])).toContain('IndexedDB read failed');
    expect(showToast.mock.calls[0][1]).toBe('error');
  });
});
