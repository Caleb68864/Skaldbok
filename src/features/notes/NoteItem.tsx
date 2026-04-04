import { useState } from 'react';
import type { Note } from '../../types/note';
import { extractDescriptors } from '../../utils/notes/extractDescriptors';
import { cn } from '../../lib/utils';

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
  const descriptors = extractDescriptors(note.body);

  return (
    <div
      className="py-2.5 border-b border-[var(--color-border)]"
    >
      <div
        className="flex items-center min-h-11"
      >
        <div className="flex-1 min-w-0">
          <span className="text-[var(--color-text)] text-sm">{note.title}</span>
          <span className="block text-[var(--color-text-muted)] text-[11px] mt-0.5">
            {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {note.type !== 'generic' && ` · ${note.type}`}
          </span>
        </div>
      <button
        onClick={() => setShowActions(v => !v)}
        aria-label="Note actions"
        className="bg-transparent border-none text-[var(--color-text-muted)] text-lg cursor-pointer min-h-11 min-w-11"
      >
        ...
      </button>
      {showActions && (
        <div
          className="absolute right-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.2)] z-[100] min-w-40"
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
              className={cn(
                'block w-full text-left px-3.5 py-2.5 min-h-11 bg-transparent border-none cursor-pointer text-sm',
                label === 'Delete' ? 'text-[var(--color-danger,#e53e3e)]' : 'text-[var(--color-text)]'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      </div>
      {/* Descriptor chip row — rendered only when note has descriptors (AC5.8) */}
      {descriptors.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {descriptors.map(label => (
            <span
              key={label}
              className="inline-block px-2.5 py-0.5 min-h-6 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl text-[var(--color-accent)] text-xs font-semibold"
            >
              #{label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
