import { useCallback, useEffect, useRef, useState } from 'react';
import { WritePad } from '../../../components/notes/WritePad';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { useToast } from '../../../context/ToastContext';
import * as noteRepository from '../../../storage/repositories/noteRepository';
import { textToDoc, docToText } from '../../notes/textToDoc';
import { SessionLogSelection } from './SessionLogSelection';
import type { Note } from '../../../types/note';

const LONG_PRESS_MS = 500;

/**
 * In-session capture screen: chronological committed log entries with a
 * docked {@link WritePad}. Tap an entry to edit it in place; long-press to
 * soft-delete it. Selection, promotion, and the review sweep are handled by
 * {@link SessionLogSelection}.
 */
export function SessionLog() {
  const { activeCampaign, activeSession, startSession } = useCampaignContext();
  const { showToast } = useToast();
  const [entries, setEntries] = useState<Note[]>([]);
  const [draft, setDraft] = useState('');
  const [padOpen, setPadOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const startLongPress = useCallback((entry: Note) => {
    longPressTimer.current = setTimeout(async () => {
      try {
        await noteRepository.softDelete(entry.id);
        if (editingId === entry.id) {
          setEditingId(null);
          setDraft('');
        }
        await refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to delete entry', 'error');
      }
    }, LONG_PRESS_MS);
  }, [editingId, refresh, showToast]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

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
    <div className="flex h-full flex-col">
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
            renderEntry={entry => (
              <div
                onPointerDown={() => startLongPress(entry)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
              >
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
          and the list is not decoration: tap-to-edit, long-press-delete and
          selection all live there. Docked keeps capture one tap from the
          session screen while leaving prior entries visible. */}
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
