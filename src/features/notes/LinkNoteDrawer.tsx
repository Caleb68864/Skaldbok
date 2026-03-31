import { useState, useEffect } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useNoteActions } from './useNoteActions';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { getLinksFrom } from '../../storage/repositories/entityLinkRepository';
import type { Note } from '../../types/note';

interface LinkNoteDrawerProps {
  onClose: () => void;
  onLinked: () => void;
}

export function LinkNoteDrawer({ onClose, onLinked }: LinkNoteDrawerProps) {
  const { activeCampaign, activeSession } = useCampaignContext();
  const { linkNote } = useNoteActions();
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCampaign || !activeSession) {
      setLoading(false);
      return;
    }
    let mounted = true;
    Promise.all([
      getNotesByCampaign(activeCampaign.id),
      getLinksFrom(activeSession.id, 'contains'),
      getLinksFrom(activeSession.id, 'linked_to'),
    ]).then(([notes, containsLinks, linkedToLinks]) => {
      if (!mounted) return;
      const linked = new Set([
        ...containsLinks.map(l => l.toEntityId),
        ...linkedToLinks.map(l => l.toEntityId),
      ]);
      setAllNotes(notes);
      setLinkedIds(linked);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [activeCampaign?.id, activeSession?.id]);

  const handleLink = async (noteId: string) => {
    if (!activeSession) return;
    await linkNote(noteId, activeSession.id);
    onLinked();
    onClose();
  };

  const unlinkdNotes = allNotes.filter(n => !linkedIds.has(n.id));

  return (
    <div
      role="dialog"
      aria-label="Link note to session"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '16px 16px 0 0',
          width: '100%',
          maxWidth: 480,
          padding: '24px 16px 32px',
          maxHeight: '70dvh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ color: 'var(--color-text)', marginBottom: '12px' }}>Link Note to Session</h3>
        {!activeSession && (
          <p style={{ color: 'var(--color-text-muted)' }}>No active session to link to.</p>
        )}
        {loading && (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading notes...</p>
        )}
        {!loading && unlinkdNotes.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>
            All notes are already linked to this session.
          </p>
        )}
        {!loading && unlinkdNotes.map(note => (
          <button
            key={note.id}
            onClick={() => handleLink(note.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              minHeight: '44px',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              cursor: 'pointer',
              marginBottom: '8px',
            }}
          >
            {note.title}
            {note.type !== 'generic' && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginLeft: '8px' }}>
                ({note.type})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
