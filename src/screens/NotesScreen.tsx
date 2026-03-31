import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useNoteActions } from '../features/notes/useNoteActions';
import { useExportActions } from '../features/export/useExportActions';
import { useNoteSearch } from '../features/notes/useNoteSearch';
import { QuickNoteDrawer } from '../features/notes/QuickNoteDrawer';
import { QuickNPCDrawer } from '../features/notes/QuickNPCDrawer';
import { LinkNoteDrawer } from '../features/notes/LinkNoteDrawer';
import { QuickLocationDrawer } from '../features/notes/QuickLocationDrawer';
import { NoteItem } from '../features/notes/NoteItem';
import { getNotesByCampaign } from '../storage/repositories/noteRepository';
import type { Note } from '../types/note';

export function NotesScreen() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { pinNote, unpinNote, deleteNote } = useNoteActions();
  const { exportNote, copyNoteAsMarkdown } = useExportActions();
  const { search, rebuildIndex } = useNoteSearch();
  const [notes, setNotes] = useState<Note[]>([]);
  const [showQuickNote, setShowQuickNote] = useState(false);
  const [showQuickNPC, setShowQuickNPC] = useState(false);
  const [showLinkNote, setShowLinkNote] = useState(false);
  const [showQuickLocation, setShowQuickLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshNotes = useCallback(async () => {
    if (!activeCampaign) return;
    const fetched = await getNotesByCampaign(activeCampaign.id);
    setNotes(fetched.filter(Boolean) as Note[]);
  }, [activeCampaign?.id]);

  useEffect(() => {
    if (!activeCampaign) return;
    let mounted = true;
    getNotesByCampaign(activeCampaign.id).then(result => {
      if (mounted) setNotes(result.filter(Boolean) as Note[]);
    });
    return () => { mounted = false; };
  }, [activeCampaign?.id]);

  // Rebuild search index when notes change
  useEffect(() => {
    rebuildIndex(notes);
  }, [notes, rebuildIndex]);

  // Debounce search query (200ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Compute search results
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return null;
    const results = search(debouncedQuery);
    const resultIds = new Set(results.map(r => r.id));
    return notes.filter(n => resultIds.has(n.id));
  }, [debouncedQuery, search, notes]);

  // Auto-close Link Note drawer when session ends (AC6.4)
  useEffect(() => {
    if (!activeSession && showLinkNote) {
      setShowLinkNote(false);
    }
  }, [activeSession, showLinkNote]);

  if (!activeCampaign) {
    return <NoCampaignPrompt />;
  }

  // Grouping
  const pinned = notes.filter(n => n.pinned);
  const npcs = notes.filter(n => !n.pinned && n.type === 'npc');
  const generic = notes.filter(n => !n.pinned && n.type === 'generic');
  const locations = notes.filter(n => !n.pinned && n.type === 'location');
  const combat = notes.filter(n => !n.pinned && n.type === 'combat');

  const handlePin = async (id: string) => {
    await pinNote(id);
    await refreshNotes();
  };

  const handleUnpin = async (id: string) => {
    await unpinNote(id);
    await refreshNotes();
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
    await refreshNotes();
  };

  const sectionHeader = (label: string, count: number) => (
    <h3
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'var(--color-text)',
        fontSize: '14px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: '16px 0 4px',
      }}
    >
      {label}
      <span
        style={{
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          borderRadius: '50%',
          width: '20px',
          height: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </h3>
  );

  return (
    <div style={{ padding: '16px', position: 'relative' }}>
      {/* Search bar */}
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { label: 'Quick Note', onClick: () => setShowQuickNote(true) },
          { label: 'Quick NPC', onClick: () => setShowQuickNPC(true) },
          { label: 'Location', onClick: () => setShowQuickLocation(true) },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            style={{
              flex: 1,
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 8px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            {label}
          </button>
        ))}
        {/* Link Note — only shown when an active session exists (AC6.1, AC6.2) */}
        {activeSession ? (
          <button
            onClick={() => setShowLinkNote(true)}
            style={{
              flex: 1,
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 8px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Link Note
          </button>
        ) : (
          <span
            style={{
              flex: 1,
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              padding: '0 8px',
              textAlign: 'center',
            }}
          >
            Start a session to link notes
          </span>
        )}
      </div>

      {/* Search results or grouped view */}
      {searchResults !== null ? (
        searchResults.length > 0 ? (
          <>
            {sectionHeader('Search Results', searchResults.length)}
            {searchResults.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onExport={exportNote}
                onCopy={copyNoteAsMarkdown}
                onDelete={handleDelete}
              />
            ))}
          </>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', marginTop: '24px' }}>
            No results found.
          </p>
        )
      ) : (
        <>
          {/* Pinned section */}
          {pinned.length > 0 && (
            <>
              {sectionHeader('Pinned', pinned.length)}
              {pinned.map(note => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onExport={exportNote}
                  onCopy={copyNoteAsMarkdown}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}

          {/* NPCs section */}
          {sectionHeader('NPCs', npcs.length)}
          {npcs.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onExport={exportNote}
              onCopy={copyNoteAsMarkdown}
              onDelete={handleDelete}
            />
          ))}
          {npcs.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No NPCs yet.</p>
          )}

          {/* Notes section */}
          {sectionHeader('Notes', generic.length)}
          {generic.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onExport={exportNote}
              onCopy={copyNoteAsMarkdown}
              onDelete={handleDelete}
            />
          ))}
          {generic.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No notes yet.</p>
          )}

          {/* Locations section */}
          {sectionHeader('Locations', locations.length)}
          {locations.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              onPin={handlePin}
              onUnpin={handleUnpin}
              onExport={exportNote}
              onCopy={copyNoteAsMarkdown}
              onDelete={handleDelete}
            />
          ))}
          {locations.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No locations yet.</p>
          )}

          {/* Combat notes section */}
          {combat.length > 0 && (
            <>
              {sectionHeader('Combat Logs', combat.length)}
              {combat.map(note => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onPin={handlePin}
                  onUnpin={handleUnpin}
                  onExport={exportNote}
                  onCopy={copyNoteAsMarkdown}
                  onDelete={handleDelete}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Drawers */}
      {showQuickNote && (
        <QuickNoteDrawer
          onClose={() => setShowQuickNote(false)}
          onSaved={refreshNotes}
        />
      )}
      {showQuickNPC && (
        <QuickNPCDrawer
          onClose={() => setShowQuickNPC(false)}
          onSaved={refreshNotes}
        />
      )}
      {showQuickLocation && (
        <QuickLocationDrawer
          onClose={() => setShowQuickLocation(false)}
          onSaved={refreshNotes}
        />
      )}
      {showLinkNote && (
        <LinkNoteDrawer
          onClose={() => setShowLinkNote(false)}
          onLinked={refreshNotes}
        />
      )}
    </div>
  );
}
