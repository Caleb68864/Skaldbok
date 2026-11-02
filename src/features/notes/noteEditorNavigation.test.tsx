// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { db } from '../../storage/db/client';
import { resetDatabase } from '../../test-utils/resetDatabase';
import NoteEditorScreen from '../../screens/NoteEditorScreen';

// Stable objects, as the real providers give: the load effect depends on them.
const stable = vi.hoisted(() => ({
  campaign: { isHydrated: true, activeCampaign: { id: 'c1', system: 'classic-fantasy' }, activeSession: null },
  appState: { settings: { customTags: {} }, updateSettings: () => {} },
}));
vi.mock('../campaign/CampaignContext', () => ({ useCampaignContext: () => stable.campaign }));
const showToast = vi.fn();
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../context/AppStateContext', () => ({ useAppState: () => stable.appState }));
vi.mock('../../components/notes/TiptapNoteEditor', () => ({ TiptapNoteEditor: () => <div /> }));
vi.mock('../../components/notes/TagPicker', () => ({ TagPicker: () => <div /> }));

const NOW = '2026-01-01T00:00:00.000Z';
const note = (id: string, title: string) => ({
  id, campaignId: 'c1', title, body: null, type: 'generic', typeData: {}, status: 'active', pinned: false,
  scope: 'campaign', schemaVersion: 1, createdAt: NOW, updatedAt: NOW,
});

function GoToB() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/note/b/edit')}>go to b</button>;
}

beforeEach(async () => {
  await resetDatabase();
  await db.notes.bulkPut([note('a', 'Alpha'), note('b', 'Bravo')] as never);
});
afterEach(cleanup);

describe('NoteEditorScreen moving between notes', () => {
  it('saves a pending edit to the note it was typed in, never the next one', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/note/a/edit']}>
        <GoToB />
        <Routes><Route path="/note/:id/edit" element={<NoteEditorScreen />} /></Routes>
      </MemoryRouter>,
    );
    const title = await screen.findByDisplayValue('Alpha');
    fireEvent.change(title, { target: { value: 'Alpha edited' } });

    // Inside the 800 ms debounce, and the screen is reused for the new id. Leaving
    // right away flushes with note B current and note A's edit still pending.
    fireEvent.click(screen.getByText('go to b'));
    await screen.findByDisplayValue('Bravo');
    unmount();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });

    expect((await db.notes.get('b'))?.title).toBe('Bravo');
    expect((await db.notes.get('a'))?.title).toBe('Alpha edited');
  });

  it('offers the note types the configuration marks as selectable (roadmap G2)', async () => {
    stable.appState.settings = {
      customTags: {},
      noteTypes: [
        { id: 'generic', label: 'Plain', selectable: true },
        { id: 'loot', label: 'Treasure', selectable: true },
        { id: 'quote', label: 'Quote' },
      ],
    } as never;
    render(
      <MemoryRouter initialEntries={['/note/a/edit']}>
        <Routes><Route path="/note/:id/edit" element={<NoteEditorScreen />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByDisplayValue('Alpha');
    expect(screen.getByRole('button', { name: 'Treasure' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Quote' })).toBeNull();
    stable.appState.settings = { customTags: {} };
  });
});
