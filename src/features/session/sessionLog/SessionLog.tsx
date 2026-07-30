import { useCallback, useEffect, useRef, useState } from 'react';
import { PenHelpPanel } from '../../../components/notes/PenHelpPanel';
import { WritePad } from '../../../components/notes/WritePad';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useToast } from '../../../context/ToastContext';
import * as noteRepository from '../../../storage/repositories/noteRepository';
import { generateSoftDeleteTxId } from '../../../utils/softDelete';
import { textToDoc, docToText } from '../../notes/textToDoc';
import { SessionLogSelection } from './SessionLogSelection';
import type { Note } from '../../../types/note';

/** Prefix shared by every parked draft for one session, across tabs. */
function draftKeyPrefix(sessionId: string): string {
  return `skaldbok-log-draft-${sessionId}-`;
}

/**
 * Id identifying this browser tab, stable for its lifetime.
 *
 * @remarks
 * Held in `sessionStorage`, which is per-tab by definition, so a second tab gets
 * a different one. The draft key needs it because two tabs open on the same
 * session previously shared a single key and overwrote each other's in-progress
 * text on every keystroke.
 */
function tabId(): string {
  const KEY = 'skaldbok-tab-id';
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // Private-mode or disabled storage: fall back to a per-mount id. Drafts
    // then do not survive a remount, which is strictly better than two tabs
    // silently destroying each other's work.
    return 'ephemeral';
  }
}

/** localStorage key holding this tab's unsaved pad draft for one session. */
function draftKey(sessionId: string): string {
  return `${draftKeyPrefix(sessionId)}${tabId()}`;
}

/** The unsaved pad state parked in localStorage between mounts. */
interface ParkedDraft {
  text: string;
  /** Id of the entry being edited, so a restored draft updates rather than duplicates. */
  editingId: string | null;
  /** When it was parked, used to pick the newest when adopting an orphan. */
  savedAt?: number;
}

/** Parses a stored draft, tolerating absent or corrupt values. */
function parseDraft(raw: string | null): ParkedDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ParkedDraft;
    if (typeof parsed?.text !== 'string') return null;
    return { text: parsed.text, editingId: parsed.editingId ?? null, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/**
 * Reads this tab's parked draft, adopting an orphan from a previous tab when
 * this one has none.
 *
 * @remarks
 * Keying by tab stops two open tabs clobbering each other, but on its own it
 * would also lose the draft whenever the app is closed and reopened, since that
 * is a new tab id. So a tab with no draft of its own takes over the newest one
 * left for this session and deletes the original — the common case (reopening
 * the PWA) recovers the text, while two *live* tabs never share a key because
 * the second one writes under its own id from its first keystroke.
 */
function readParkedDraft(sessionId: string): ParkedDraft | null {
  try {
    const own = parseDraft(localStorage.getItem(draftKey(sessionId)));
    if (own) return own;

    const prefix = draftKeyPrefix(sessionId);
    let bestKey: string | null = null;
    let best: ParkedDraft | null = null;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const candidate = parseDraft(localStorage.getItem(key));
      if (!candidate) continue;
      if (!best || (candidate.savedAt ?? 0) > (best.savedAt ?? 0)) {
        best = candidate;
        bestKey = key;
      }
    }
    if (best && bestKey) {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(best));
      localStorage.removeItem(bestKey);
    }
    return best;
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
      localStorage.setItem(
        key,
        JSON.stringify({ text: draft, editingId, savedAt: Date.now() } satisfies ParkedDraft),
      );
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
      // Refresh BEFORE clearing. If the re-read throws, WritePad's contract is
      // that the text stays in the pad — but clearing first meant the user saw
      // "failed to save" over an empty pad, retyped the thought, and committed
      // a duplicate.
      await refresh();
      setDraft('');
      setEditingId(null);
    } catch (e) {
      // Re-throw so WritePad retains the draft text and shows a toast.
      throw e instanceof Error ? e : new Error('Failed to save log entry');
    }
  }, [activeSession, activeCampaign, editingId, refresh]);

  /**
   * Opens an entry for editing.
   *
   * @remarks
   * Refuses to clobber an uncommitted draft. The entry list sits directly above
   * the pad on the capture screen, so tapping a row to re-read it is a natural
   * gesture — and it used to overwrite the in-progress draft *and* the parked
   * localStorage copy in the same tick, destroying a half-written thought with
   * no confirmation and no way back. On a screen whose entire premise is that a
   * thought is never lost, that was the easiest way to lose one.
   */
  const handleTapEntry = useCallback((entry: Note) => {
    const entryText = docToText(entry.body);
    const pending = draft.trim();
    if (pending && draft !== entryText) {
      showToast(
        'Commit or clear what you have written before editing another entry',
        'warning',
        4000,
      );
      return;
    }
    setEditingId(entry.id);
    setDraft(entryText);
    setPadOpen(true);
  }, [draft, showToast]);

  /** Leaves edit mode without saving, restoring the pad to a blank new entry. */
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft('');
  }, []);

  /**
   * Soft-deletes the selected entries and offers an Undo.
   *
   * @remarks
   * Every entry in one call shares a soft-delete transaction id, so Undo
   * restores exactly the set that was removed — restoring them individually
   * would resurrect any entry the user had deleted earlier and separately.
   */
  /**
   * Restores a previously deleted batch.
   *
   * @remarks
   * Every entry is attempted even if one fails. Abandoning the loop on the
   * first error was the dangerous shape: `noteRepository.restore` reinstates
   * links by the *transaction* id, so the first successful call already brings
   * back the whole batch's edges — bailing after that left every entry's edges
   * live while some of their notes stayed soft-deleted, which is exactly the
   * dangling-reference state the delete cascade exists to avoid.
   */
  const undoDelete = useCallback(async (deleted: Note[]) => {
    const failed: string[] = [];
    for (const entry of deleted) {
      try {
        await noteRepository.restore(entry.id);
      } catch (e) {
        // Logged, not swallowed: `restore` wraps the note and its edges in one
        // transaction, so an edge failure rolls the note back too. Without this
        // the only trace of "Undo didn't work" is a count.
        console.error('SessionLog.undoDelete failed for', entry.id, e);
        failed.push(entry.id);
      }
    }
    try {
      await refresh();
    } catch (e) {
      console.error('SessionLog.undoDelete refresh failed', e);
    }
    if (failed.length > 0) {
      showToast(`Could not restore ${failed.length} of ${deleted.length} entries`, 'error');
    }
  }, [refresh, showToast]);

  const handleDeleteEntries = useCallback(async (toDelete: Note[]) => {
    if (toDelete.length === 0) return;
    const txId = generateSoftDeleteTxId();
    // One shared txId across the batch, so Undo restores exactly this set.
    // Each entry is removed atomically — note and edges together — by
    // `softDeleteWithLinks`. A promoted entry carries a live `promoted_into`
    // edge to a note that is still active, and either half-state is a defect:
    // an orphaned edge exports into a bundle that excludes its target, and a
    // live note with dead edges has silently lost its provenance with no way
    // back. The batch is still a loop, so a mid-batch failure stops with
    // earlier entries cleanly deleted and the rest untouched.
    const deleted: Note[] = [];
    let failure: unknown = null;

    for (const entry of toDelete) {
      try {
        await noteRepository.softDeleteWithLinks(entry.id, txId);
        deleted.push(entry);
      } catch (e) {
        failure = e;
        break;
      }
    }

    // Only entries that actually went. One that failed is still live and still
    // editable, so discarding its draft would throw away work for a row that
    // never left.
    if (editingId && deleted.some(e => e.id === editingId)) {
      setEditingId(null);
      setDraft('');
    }
    try {
      await refresh();
    } catch (e) {
      // Guarded: this is called from an onClick that discards the promise, so
      // an unguarded throw here would surface as an unhandled rejection with no
      // toast and no Undo — the exact failure this path exists to prevent.
      console.error('SessionLog.handleDeleteEntries refresh failed', e);
    }

    if (deleted.length === 0) {
      showToast(failure instanceof Error ? failure.message : 'Failed to delete entry', 'error');
      return;
    }

    if (failure) {
      // Partial success. Report it honestly and still offer the way back for
      // what did go — the old code threw away both the Undo and the refresh,
      // leaving rows on screen that were already gone from Dexie.
      showToast(
        `Deleted ${deleted.length} of ${toDelete.length} entries; the rest failed.`,
        'error',
        { duration: 8000, action: { label: 'Undo', onClick: () => void undoDelete(deleted) } },
      );
      return;
    }

    showToast(
      toDelete.length === 1 ? 'Entry deleted' : `${toDelete.length} entries deleted`,
      'info',
      {
        // Longer than the 3s default — see NoteReader: an undo nobody has
        // time to reach is not an undo.
        duration: 8000,
        action: { label: 'Undo', onClick: () => void undoDelete(deleted) },
      },
    );
  }, [editingId, refresh, showToast, undoDelete]);

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
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border,#ddd)] px-4 py-2">
        <h1 className="text-sm font-semibold">{activeSession.title}</h1>
        {/* Editing has to be visible and escapable. Without a banner there was
            no indication the pad was pointed at an existing entry, and without
            a way out the next new thought overwrote that entry instead of
            being added. */}
        {editingId && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted,#666)]">Editing an entry</span>
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-9 rounded border border-[var(--color-border,#ddd)] px-2 text-xs"
            >
              Cancel edit
            </button>
          </div>
        )}
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
      <PenHelpPanel />
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
        dockedHeight="28rem"
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
