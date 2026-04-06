import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NoteItem } from './NoteItem';
import { useNoteActions } from './useNoteActions';
import { useExportActions } from '../export/useExportActions';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { getSessionsByCampaign } from '../../storage/repositories/sessionRepository';
import type { Note, NoteType } from '../../types/note';
import type { Session } from '../../types/session';
import { cn } from '../../lib/utils';

/**
 * Ordered list of note-type filter options rendered as pill chips above the grid.
 * The `'all'` entry shows every type without filtering.
 */
const NOTE_TYPE_FILTERS: Array<{ value: NoteType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'generic', label: 'Generic' },
  { value: 'location', label: 'Location' },
  { value: 'combat', label: 'Combat' },
  { value: 'loot', label: 'Loot' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'quote', label: 'Quote' },
  { value: 'skill-check', label: 'Skill Check' },
  { value: 'recap', label: 'Recap' },
];

/**
 * Props for the {@link NotesGrid} component.
 */
interface NotesGridProps {
  /** ID of the campaign whose notes should be displayed. */
  campaignId: string;
  /** The currently active session id, if any — used as default session filter */
  activeSessionId: string | null | undefined;
}

/**
 * Filterable, searchable grid of notes for a campaign.
 *
 * @remarks
 * Loads all notes for `campaignId` from IndexedDB on mount and polls every
 * 2 seconds to pick up changes made by other parts of the app. Sessions are
 * loaded once on mount and used to populate the session-filter dropdown.
 *
 * Filtering features:
 * - **Session filter** — dropdown defaults to `activeSessionId` when provided.
 *   Includes an "All Sessions" option and a "No session" option for orphaned notes.
 * - **Type filter** — pill chips for each {@link NoteType} plus an "All" catch-all.
 * - **Text search** — debounced (200 ms) search across note title and tags.
 * - **Sort toggle** — switches between newest-first and oldest-first by `createdAt`.
 *
 * Tapping a note navigates to `/note/:id/edit`. The "+ New Note" button
 * navigates to `/note/new`.
 *
 * @param props - {@link NotesGridProps}
 *
 * @example
 * ```tsx
 * <NotesGrid campaignId={campaign.id} activeSessionId={activeSession?.id} />
 * ```
 */
export function NotesGrid({ campaignId, activeSessionId }: NotesGridProps) {
  const navigate = useNavigate();
  const { pinNote, unpinNote, deleteNote } = useNoteActions();
  const { exportNote, copyNoteAsMarkdown } = useExportActions();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all');
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default session filter to active session when it changes
  useEffect(() => {
    if (activeSessionId) setSessionFilter(activeSessionId);
  }, [activeSessionId]);

  /** Re-fetches all notes for the campaign and updates local state. */
  const refreshNotes = useCallback(async () => {
    const all = await getNotesByCampaign(campaignId);
    setNotes(all.filter(Boolean) as Note[]);
  }, [campaignId]);

  /** Re-fetches all sessions for the campaign (sorted newest-first) and updates local state. */
  const refreshSessions = useCallback(async () => {
    const all = await getSessionsByCampaign(campaignId);
    setSessions(all.sort((a, b) => b.date.localeCompare(a.date)));
  }, [campaignId]);

  useEffect(() => {
    let mounted = true;
    refreshNotes().catch(() => { if (mounted) setNotes([]); });
    refreshSessions().catch(() => {});
    const interval = setInterval(() => {
      if (mounted) refreshNotes().catch(() => {});
    }, 2000);
    return () => { mounted = false; clearInterval(interval); };
  }, [refreshNotes, refreshSessions]);

  // Debounce search (200ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  /**
   * Derived note list after applying session filter, type filter, text search,
   * and sort order. Recomputed only when dependencies change.
   */
  const filteredNotes = useMemo(() => {
    // Exclude archived combat notes from the active grid
    let result = notes.filter(n => !(n.type === 'combat' && n.status === 'archived'));
    // Session filter
    if (sessionFilter !== 'all') {
      if (sessionFilter === 'none') {
        result = result.filter(n => !n.sessionId);
      } else {
        result = result.filter(n => n.sessionId === sessionFilter);
      }
    }
    if (typeFilter !== 'all') {
      result = result.filter(n => n.type === typeFilter);
    }
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(q)))
      );
    }
    // Sort by createdAt
    result = [...result].sort((a, b) => {
      const cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      return sortAsc ? cmp : -cmp;
    });
    return result;
  }, [notes, typeFilter, sessionFilter, debouncedQuery, sortAsc]);

  /** Pins a note and refreshes the list. */
  const handlePin = async (id: string) => {
    await pinNote(id);
    await refreshNotes();
  };

  /** Unpins a note and refreshes the list. */
  const handleUnpin = async (id: string) => {
    await unpinNote(id);
    await refreshNotes();
  };

  /** Deletes a note and refreshes the list. */
  const handleDelete = async (id: string) => {
    await deleteNote(id);
    await refreshNotes();
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[var(--color-text)] m-0">Notes</h3>
          <button
            onClick={() => setSortAsc(prev => !prev)}
            title={sortAsc ? 'Oldest first — click for newest first' : 'Newest first — click for oldest first'}
            className="min-h-11 min-w-11 px-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
          >
            {sortAsc ? 'Oldest' : 'Newest'}
          </button>
        </div>
        <button
          onClick={() => navigate('/note/new')}
          className="min-h-11 px-3 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-[13px] font-semibold cursor-pointer"
        >
          + New Note
        </button>
      </div>

      {/* Session filter dropdown */}
      <select
        value={sessionFilter}
        onChange={e => setSessionFilter(e.target.value)}
        className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-2.5 box-border cursor-pointer"
      >
        <option value="all">All Sessions</option>
        {sessions.map(s => (
          <option key={s.id} value={s.id}>
            {s.title}{s.id === activeSessionId ? ' (active)' : ''}
          </option>
        ))}
        <option value="none">No session</option>
      </select>

      {/* Search */}
      <input
        type="text"
        placeholder="Search notes..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-2.5 box-border"
      />

      {/* Type filter chips */}
      <div className="flex gap-2 flex-wrap mb-3">
        {NOTE_TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={cn(
              'min-h-11 px-3.5 py-1.5 rounded-full border-none cursor-pointer text-xs font-semibold shrink-0',
              typeFilter === f.value
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Note list */}
      {filteredNotes.length === 0 ? (
        <p className="text-[var(--color-text-muted)] text-sm">
          {notes.length === 0 ? 'No notes yet.' : 'No notes match the current filter.'}
        </p>
      ) : (
        filteredNotes.map(note => (
          <div
            key={note.id}
            onClick={() => navigate(`/note/${note.id}/edit`)}
            className="cursor-pointer"
          >
            <NoteItem
              note={note}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onExport={id => { exportNote(id); }}
              onCopy={id => { copyNoteAsMarkdown(id); }}
              onDelete={handleDelete}
            />
          </div>
        ))
      )}
    </div>
  );
}
