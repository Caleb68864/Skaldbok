import { useCallback, useEffect, useRef, useState } from 'react';
import { WritePad } from '../../../components/notes/WritePad';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useToast } from '../../../context/ToastContext';
import * as noteRepository from '../../../storage/repositories/noteRepository';
import { generateSoftDeleteTxId } from '../../../utils/softDelete';
import { textToDoc, docToText } from '../../notes/textToDoc';
import { SessionLogSelection } from './SessionLogSelection';
import type { Note } from '../../../types/note';

/** localStorage key holding the unsaved pad draft for one session. */
function draftKey(sessionId: string): string {
  return `skaldbok-log-draft-${sessionId}`;
}

/** The unsaved pad state parked in localStorage between mounts. */
interface ParkedDraft {
  text: string;
  /** Id of the entry being edited, so a restored draft updates rather than duplicates. */
  editingId: string | null;
}

/** Reads the parked draft for a session, tolerating absent or corrupt values. */
function readParkedDraft(sessionId: string): ParkedDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParkedDraft;
    if (typeof parsed?.text !== 'string') return null;
    return { text: parsed.text, editingId: parsed.editingId ?? null };
  } catch {
    return null;
  }
}

/**
 * In-session capture screen: chronological committed log entries with a
 * docked {@link WritePad}. Tap an entry to edit it in place; long-press to
 * select. Selection, promotion, deletion and the review sweep are handled by
 * {@link SessionLogSelection}.
 *
 * @remarks
 * Deletion deliberately does **not** live on a row long-press. It used to, and
 * that gesture is also what a touch device fires to enter selection mode, so a
 * long-press meant to select an entry silently soft-deleted it — with no
 * confirmation and no undo. Delete now lives in the selection action bar,
 * behind an explicit tap, and reports an Undo toast.
 */
export function SessionLog() {
  const { activeCampaign, activeSession, startSession } = useCampaignContext();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [padOpen, setPadOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!activeSession) {
      setEntries([]);
      return;
    }
    const rows = await noteRepository.listLogEntriesBySession(activeSession.id);
    setEntries(rows);
  }, [activeSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Rehydrate whatever was being typed when this component last unmounted.
  // The pad lives inside a sheet that closes on an outside tap, so without
  // this an interrupted sentence is lost with no warning — the worst possible
  // failure for a capture surface used mid-session.
  useEffect(() => {
    if (!activeSession) return;
    const parked = readParkedDraft(activeSession.id);
    if (!parked) return;
    setDraft(parked.text);
    setEditingId(parked.editingId);
    if (parked.text) setPadOpen(true);
  }, [activeSession]);

  // Park the draft on every keystroke. localStorage is the right store here:
  // this is transient UI state, not a domain record, and writing it into
  // IndexedDB would mean a schema version for something deliberately throwaway.
  useEffect(() => {
    if (!activeSession) return;
    const key = draftKey(activeSession.id);
    if (draft.trim() === '') {
      localStorage.removeItem(key);
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify({ text: draft, editingId } satisfies ParkedDraft));
    } catch {
      // A full or unavailable quota must not break capture — the draft simply
      // is not recoverable across a remount.
    }
  }, [draft, editingId, activeSession]);

  // Entries render oldest-first, so the newest is at the bottom and off-screen
  // once a session runs long. Scroll to it whenever the list grows — otherwise
  // the entry you just committed is the one you cannot see.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const handleCommit = useCallback(async (text: string) => {
    if (!activeSession || !activeCampaign) {
      throw new Error('No active session');
    }
    try {
      if (editingId) {
        await noteRepository.updateLogEntry(editingId, textToDoc(text));
      } else {
        await noteRepository.createLogEntry({
          campaignId: activeCampaign.id,
          sessionId: activeSession.id,
          body: textToDoc(text),
          scope: 'campaign',
        });
      }
      setDraft('');
      setEditingId(null);
      await refresh();
    } catch (e) {
      // Re-throw so WritePad retains the draft text and shows a toast.
      throw e instanceof Error ? e : new Error('Failed to save log entry');
    }
  }, [activeSession, activeCampaign, editingId, refresh]);

  const handleTapEntry = useCallback((entry: Note) => {
    setEditingId(entry.id);
    setDraft(docToText(entry.body));
    setPadOpen(true);
  }, []);

  /**
   * Soft-deletes the selected entries and offers an Undo.
   *
   * @remarks
   * Every entry in one call shares a soft-delete transaction id, so Undo
   * restores exactly the set that was removed — restoring them individually
   * would resurrect any entry the user had deleted earlier and separately.
   */
  const handleDeleteEntries = useCallback(async (toDelete: Note[]) => {
    if (toDelete.length === 0) return;
    const txId = generateSoftDeleteTxId();
    try {
      for (const entry of toDelete) {
        await noteRepository.softDelete(entry.id, txId);
      }
      if (editingId && toDelete.some(e => e.id === editingId)) {
        setEditingId(null);
        setDraft('');
      }
      await refresh();
      showToast(
        toDelete.length === 1 ? 'Entry deleted' : `${toDelete.length} entries deleted`,
        'info',
        {
          // Longer than the 3s default — see NoteReader: an undo nobody has
          // time to reach is not an undo.
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                for (const entry of toDelete) {
                  await noteRepository.restore(entry.id);
                }
                await refresh();
              } catch (e) {
                showToast(e instanceof Error ? e.message : 'Failed to restore entries', 'error');
              }
            },
          },
        },
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to delete entry', 'error');
    }
  }, [editingId, refresh, showToast]);

  if (!activeSession) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-[var(--color-text-muted,#666)]">Start a session to begin logging</p>
        <button
          type="button"
          onClick={() => void startSession()}
          className="rounded bg-[var(--color-primary,#2563eb)] px-4 py-2 text-sm font-medium text-white"
        >
          Start session
        </button>
      </div>
    );
  }

  return (
    // `h-full`, not `h-[calc(100%-140px)]`. `<main>` (ShellLayout) is an
    // overflow-y-auto scroll container with `pb-[140px]`, and under
    // `box-sizing: border-box` that padding sits *inside* main's height — so
    // main's content box is already `H - 140` and a `h-full` child measures
    // exactly that. Scroll height then equals client height and `<main>` never
    // scrolls; the entry list's own overflow-y-auto stays the only scroller.
    // Subtracting the 140px again here would double-count it and waste ~140px
    // of writing area, which on the capture screen is the thing we are trying
    // hardest to preserve.
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b border-[var(--color-border,#ddd)] px-4 py-2">
        <h1 className="text-sm font-semibold">{activeSession.title}</h1>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-2">
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--color-text-muted,#666)]">
            No log entries yet.
          </p>
        )}
        {activeCampaign && (
          <SessionLogSelection
            entries={entries}
            campaignId={activeCampaign.id}
            onEditEntry={handleTapEntry}
            onPromoted={refresh}
            onDeleteEntries={handleDeleteEntries}
            renderEntry={entry => (
              <div>
                <div className="text-xs text-[var(--color-text-muted,#666)]">
                  {new Date(entry.createdAt).toLocaleTimeString()}
                </div>
                <div className="whitespace-pre-wrap text-sm">{docToText(entry.body)}</div>
              </div>
            )}
          />
        )}
      </div>
      {/* Docked, not fullscreen. A fullscreen pad would bury the entry list —
          and the list is not decoration: tap-to-edit and selection both live
          there. Docked keeps capture one tap from the session screen while
          leaving prior entries visible. */}
      <WritePad
        value={draft}
        onChange={setDraft}
        onCommit={handleCommit}
        open={padOpen}
        onClose={() => setPadOpen(false)}
        placeholder="Log what's happening..."
        variant="docked"
        commitLabel="Commit"
      />
      {!padOpen && (
        <button
          type="button"
          onClick={() => setPadOpen(true)}
          className="m-4 rounded bg-[var(--color-primary,#2563eb)] px-4 py-2 text-sm font-medium text-white"
        >
          Write
        </button>
      )}
    </div>
  );
}
