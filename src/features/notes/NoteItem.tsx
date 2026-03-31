import { useState } from 'react';
import type { Note } from '../../types/note';

interface NoteItemProps {
  note: Note;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onExport: (id: string) => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NoteItem({ note, onPin, onUnpin, onExport, onCopy, onDelete }: NoteItemProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-border)',
        minHeight: '44px',
      }}
    >
      <div style={{ flex: 1 }}>
        <span style={{ color: 'var(--color-text)', fontSize: '14px' }}>{note.title}</span>
      </div>
      <button
        onClick={() => setShowActions(v => !v)}
        aria-label="Note actions"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          fontSize: '18px',
          cursor: 'pointer',
          minHeight: '44px',
          minWidth: '44px',
        }}
      >
        ...
      </button>
      {showActions && (
        <div
          style={{
            position: 'absolute',
            right: '16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 100,
            minWidth: '160px',
          }}
        >
          {[
            { label: note.pinned ? 'Unpin' : 'Pin', action: () => { note.pinned ? onUnpin(note.id) : onPin(note.id); setShowActions(false); } },
            { label: 'Export Note', action: () => { onExport(note.id); setShowActions(false); } },
            { label: 'Copy as Markdown', action: () => { onCopy(note.id); setShowActions(false); } },
            { label: 'Delete', action: () => { onDelete(note.id); setShowActions(false); } },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                minHeight: '44px',
                background: 'none',
                border: 'none',
                color: label === 'Delete' ? 'var(--color-danger, #e53e3e)' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
