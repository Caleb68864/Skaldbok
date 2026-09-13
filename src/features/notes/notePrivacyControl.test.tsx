// @vitest-environment jsdom
// Must run before the Dexie `db` singleton is imported so it opens against the
// in-memory fake IndexedDB.
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '../../storage/db/client';
import { getNoteById } from '../../storage/repositories/noteRepository';
import { collectCampaignBundle } from '../../utils/export/collectors';
import { serializeBundle } from '../../utils/export/bundleSerializer';
import { BUNDLED_SYSTEMS } from '../../systems/registry';
import NoteEditorScreen from '../../screens/NoteEditorScreen';

/**
 * The privacy flag, from the control a person can reach to the bytes that leave
 * the device.
 *
 * @remarks
 * `visibility: 'private'` was fully honoured by the export — `privacyFilter.ts`
 * derives the exclusion set, `bundleSerializer` scans the finished artefact for
 * residue, and `privacyBoundary.test.ts` proves both over a seeded fixture. The
 * one thing missing was any way for a person to *set* it: every write path
 * defaulted the field to `'public'` (`noteCreationService.buildNoteRecord`) and
 * no screen offered a control. The capability was built and unreachable, which
 * is indistinguishable from absent to the only person it protects.
 *
 * So this test refuses to assert over an intermediate object. It clicks the
 * control in the real note editor, re-reads the row from IndexedDB, then runs
 * the campaign export the app really runs and reads **the serialized string**.
 * `privacyBoundary.test.ts` proves the filter works on a note that was already
 * private; this proves the UI produces a note the filter recognises.
 *
 * The ACCEPT control matters as much as the exclusion: a second, ordinary note
 * must still be in that same bundle. Otherwise "the private note is absent"
 * passes for an export that shipped nothing.
 */

const CAMPAIGN_ID = 'camp-privacy-ui';
const NOW = '2026-01-01T00:00:00.000Z';
const SECRET_ID = 'note-ui-secret';
const SECRET_TITLE = 'The Reeve Sold the Ward-Stones';
const PUBLIC_ID = 'note-ui-open';
const PUBLIC_TITLE = 'The Salt Road Toll House';

const showToast = vi.fn();

vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({
    isHydrated: true,
    activeCampaign: { id: CAMPAIGN_ID, name: 'Privacy', system: 'classic-fantasy' },
    activeSession: null,
  }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings: { customTags: {} }, updateSettings: () => {} }),
}));

// The body editor and the tag picker are not what this test is about, and
// Tiptap brings a ProseMirror view into jsdom for no gain here.
vi.mock('../../components/notes/TiptapNoteEditor', () => ({
  TiptapNoteEditor: () => <div data-testid="body-editor" />,
}));
vi.mock('../../components/notes/TagPicker', () => ({
  TagPicker: () => <div data-testid="tag-picker" />,
}));

async function seed(): Promise<void> {
  const stamp = { schemaVersion: 1, createdAt: NOW, updatedAt: NOW };
  await db.campaigns.add({
    id: CAMPAIGN_ID, name: 'Privacy', system: BUNDLED_SYSTEMS[0].id, status: 'active', ...stamp,
  } as never);
  await db.sessions.add({
    id: 'sess-ui', campaignId: CAMPAIGN_ID, title: 'Session One', status: 'ended',
    date: '2026-01-01', startedAt: NOW, ...stamp,
  } as never);
  for (const [id, title] of [[SECRET_ID, SECRET_TITLE], [PUBLIC_ID, PUBLIC_TITLE]] as const) {
    await db.notes.add({
      id, campaignId: CAMPAIGN_ID, sessionId: 'sess-ui', title, body: null, type: 'generic',
      status: 'active', pinned: false, scope: 'campaign', visibility: 'public', ...stamp,
    } as never);
    await db.kb_nodes.add({
      id: `note-${id}`, type: 'note', label: title, scope: 'campaign',
      campaignId: CAMPAIGN_ID, sourceId: id, createdAt: NOW, updatedAt: NOW,
    } as never);
  }
  await db.entityLinks.add({
    id: 'link-sess-secret', fromEntityId: 'sess-ui', fromEntityType: 'session',
    toEntityId: SECRET_ID, toEntityType: 'note', relationshipType: 'contains', ...stamp,
  } as never);
  await db.entityLinks.add({
    id: 'link-sess-open', fromEntityId: 'sess-ui', fromEntityType: 'session',
    toEntityId: PUBLIC_ID, toEntityType: 'note', relationshipType: 'contains', ...stamp,
  } as never);
}

/** Mounts the real note editor on a note, the way the route does. */
function openEditor(noteId: string) {
  return render(
    <MemoryRouter initialEntries={[`/note/${noteId}/edit`]}>
      <Routes>
        <Route path="/note/:id/edit" element={<NoteEditorScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The privacy control, found the way a screen reader finds it. */
async function privacySwitch(): Promise<HTMLElement> {
  return await screen.findByRole('switch', { name: /private/i });
}

/**
 * Clicks the control and waits for the write to land.
 *
 * @remarks
 * The switch ignores a tap arriving while the previous write is in flight, so a
 * test that clicks twice in a row can have the second one swallowed — which is
 * correct behaviour and an intermittent test. `aria-busy` is the component's own
 * report of that window, so wait for it to close rather than for a timer.
 */
async function clickPrivacySwitch(): Promise<void> {
  const control = await privacySwitch();
  control.click();
  await waitFor(() => {
    expect(control.getAttribute('aria-busy')).toBe('false');
  });
}

/** The campaign export the app really performs, as the string that becomes the file. */
async function exportedCampaignJson(): Promise<string> {
  const result = await collectCampaignBundle(CAMPAIGN_ID);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error(result.error);
  return await serializeBundle('campaign', result.contents, { includePrivate: false });
}

beforeEach(async () => {
  vi.clearAllMocks();
  for (const table of db.tables) await table.clear();
  await seed();
});

// Globals are off, so Testing Library does not auto-clean.
afterEach(cleanup);

describe('marking a note private from the note editor', () => {
  it('sets visibility on the stored row, and the row still says so after a reload', async () => {
    const view = openEditor(SECRET_ID);
    const toggle = await privacySwitch();
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    await clickPrivacySwitch();

    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('private');
    });

    // "Survives a reload": tear the whole tree down and mount a fresh editor,
    // which can only learn the state by re-reading IndexedDB.
    view.unmount();
    cleanup();
    openEditor(SECRET_ID);
    expect((await privacySwitch()).getAttribute('aria-checked')).toBe('true');
  });

  it('un-marking clears it back to public, and that survives a reload too', async () => {
    const view = openEditor(SECRET_ID);
    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('private');
    });
    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('public');
    });

    view.unmount();
    cleanup();
    openEditor(SECRET_ID);
    expect((await privacySwitch()).getAttribute('aria-checked')).toBe('false');
  });
});

describe('a note made private through the UI is absent from a real export', () => {
  it('is in the bundle before the control is touched', async () => {
    // Fixture sanity. Without this, every assertion below could pass because
    // the note never reached the collector at all.
    const json = await exportedCampaignJson();
    expect(json).toContain(SECRET_TITLE);
    expect(json).toContain(SECRET_ID);
  });

  it('leaves no trace of the note in the serialized bundle once marked private', async () => {
    openEditor(SECRET_ID);
    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('private');
    });

    const json = await exportedCampaignJson();
    expect(json).not.toContain(SECRET_TITLE);
    expect(json).not.toContain(SECRET_ID);
    expect(json).not.toContain(`note-${SECRET_ID}`);
  });

  it('still carries an ordinary note in that same bundle', async () => {
    // The ACCEPT control, asserted on the *same* export as the exclusion above
    // so a filter that dropped everything cannot satisfy both.
    openEditor(SECRET_ID);
    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('private');
    });

    const json = await exportedCampaignJson();
    expect(json).not.toContain(SECRET_TITLE);
    expect(json).toContain(PUBLIC_TITLE);
    expect(json).toContain(PUBLIC_ID);
  });

  it('restores the note to the export when the control is switched back off', async () => {
    openEditor(SECRET_ID);
    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('private');
    });
    expect(await exportedCampaignJson()).not.toContain(SECRET_TITLE);

    await clickPrivacySwitch();
    await waitFor(async () => {
      expect((await getNoteById(SECRET_ID))?.visibility).toBe('public');
    });

    const json = await exportedCampaignJson();
    expect(json).toContain(SECRET_TITLE);
    expect(json).toContain(SECRET_ID);
  });
});
