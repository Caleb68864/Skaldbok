import { useState, useEffect } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { getNotesByCampaign } from '../../../storage/repositories/noteRepository';
import type { Note } from '../../../types/note';

/** Shared inline styles for the NPC source-selection chips. */
const chipStyle = {
  minHeight: '44px',
  padding: '0 14px',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: '22px',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  flexShrink: 0,
} as const;

/**
 * Props for the {@link RumorDrawer} component.
 */
export interface RumorDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the drawer should be closed. */
  onClose: () => void;
  /** Called after the rumor has been logged as a note. */
  onLogged: () => void;
}

/**
 * Drawer for logging a rumor heard during the session.
 *
 * @remarks
 * The GM types the rumor text and optionally selects an NPC source. NPC options
 * are loaded from the active campaign's notes (type `'npc'`) each time the drawer
 * opens, so newly created NPCs appear without a full app refresh. Selecting
 * "Unknown" clears the source (empty string), which is stored as `undefined`
 * in `typeData`.
 *
 * A `rumor` note is created with:
 * - `title`: `"Rumor: <rumor text>"`
 * - `typeData.source`: NPC name or `undefined`
 * - `typeData.threadStatus`: `'open'` (tracks whether the rumor has been resolved)
 *
 * The Log Rumor button is disabled until a non-empty rumor text is entered.
 * Closing or logging resets both the rumor text and source fields.
 *
 * @param props - {@link RumorDrawerProps}
 *
 * @example
 * ```tsx
 * <RumorDrawer
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   onLogged={refreshNotes}
 * />
 * ```
 */
export function RumorDrawer({ open, onClose, onLogged }: RumorDrawerProps) {
  const { createNote } = useNoteActions();
  const { showToast } = useToast();
  const { activeCampaign } = useCampaignContext();
  const [rumorText, setRumorText] = useState('');
  const [rumorSource, setRumorSource] = useState('');
  const [npcNotes, setNpcNotes] = useState<Note[]>([]);

  // Load NPC notes each time the drawer opens so the list is always fresh
  useEffect(() => {
    if (!open || !activeCampaign) return;
    let mounted = true;
    getNotesByCampaign(activeCampaign.id).then(notes => {
      if (mounted) setNpcNotes(notes.filter(n => n && n.type === 'npc') as Note[]);
    });
    return () => { mounted = false; };
  }, [open, activeCampaign]);

  /** Resets both form fields and closes the drawer. */
  const handleClose = () => {
    setRumorText('');
    setRumorSource('');
    onClose();
  };

  /**
   * Creates a `rumor` note with the entered text and selected source,
   * shows a confirmation toast, resets the form, and calls `onLogged`.
   * No-op when the rumor text field is empty.
   */
  const handleLog = async () => {
    if (!rumorText.trim()) return;
    const src = rumorSource || undefined;
    const fullTitle = `Rumor: ${rumorText.trim()}`;
    await createNote({
      title: fullTitle,
      type: 'rumor',
      body: null,
      pinned: false,
      status: 'active',
      typeData: { source: src, threadStatus: 'open' },
    });
    showToast(`Logged: ${fullTitle}`);
    handleClose();
    onLogged();
  };

  return (
    <Drawer open={open} onClose={handleClose} title="Rumor Heard">
      <input
        type="text"
        placeholder="What's the rumor?"
        value={rumorText}
        onChange={e => setRumorText(e.target.value)}
        autoFocus
        style={{
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          marginBottom: '12px',
          boxSizing: 'border-box',
        }}
      />
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        Source (optional)
      </p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button
          onClick={() => setRumorSource('')}
          style={{
            ...chipStyle,
            background: rumorSource === '' ? 'var(--color-accent)' : 'var(--color-surface-raised)',
            color: rumorSource === '' ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
          }}
        >
          Unknown
        </button>
        {npcNotes.map(npc => (
          <button
            key={npc.id}
            onClick={() => setRumorSource(npc.title)}
            style={{
              ...chipStyle,
              background: rumorSource === npc.title ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: rumorSource === npc.title ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            {npc.title}
          </button>
        ))}
      </div>
      <button
        onClick={handleLog}
        disabled={!rumorText.trim()}
        style={{
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          opacity: !rumorText.trim() ? 0.6 : 1,
        }}
      >
        Log Rumor
      </button>
    </Drawer>
  );
}
