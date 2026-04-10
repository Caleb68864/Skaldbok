import { useState, useEffect } from 'react';
import { Drawer } from '../../../components/primitives/Drawer';
import { useNoteActions } from '../../notes/useNoteActions';
import { useToast } from '../../../context/ToastContext';
import { useCampaignContext } from '../../campaign/CampaignContext';
import { getNotesByCampaign } from '../../../storage/repositories/noteRepository';
import type { Note } from '../../../types/note';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from '../quickActions/AttachToControl';
import { cn } from '../../../lib/utils';

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
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const [rumorText, setRumorText] = useState('');
  const [rumorSource, setRumorSource] = useState('');
  const [npcNotes, setNpcNotes] = useState<Note[]>([]);
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');

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
    setAttachTo('auto');
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
    const currentAttach = attachTo;
    await createNote(
      {
        title: fullTitle,
        type: 'rumor',
        body: null,
        pinned: false,
        status: 'active',
        typeData: { source: src, threadStatus: 'open' },
      },
      { targetEncounterId: resolveAttach(currentAttach) },
    );
    let encounterTitle: string | null = null;
    if (currentAttach === 'auto') {
      encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
    } else if (typeof currentAttach === 'string') {
      encounterTitle = 'encounter';
    }
    if (encounterTitle) {
      showToast(`Logged to ${encounterTitle}`, 'success', 2000);
    } else {
      showToast('Logged to session', 'success', 2000);
    }
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
        className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
      />
      <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-2">
        Source (optional)
      </p>
      <div className="flex gap-3 flex-wrap mb-3">
        <button
          onClick={() => setRumorSource('')}
          className={cn(
            'min-h-11 px-3.5 border border-[var(--color-border)] rounded-full cursor-pointer text-sm font-semibold shrink-0',
            rumorSource === ''
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
              : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
          )}
        >
          Unknown
        </button>
        {npcNotes.map(npc => (
          <button
            key={npc.id}
            onClick={() => setRumorSource(npc.title)}
            className={cn(
              'min-h-11 px-3.5 border border-[var(--color-border)] rounded-full cursor-pointer text-sm font-semibold shrink-0',
              rumorSource === npc.title
                ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text)]'
            )}
          >
            {npc.title}
          </button>
        ))}
      </div>
      <AttachToControl value={attachTo} onChange={setAttachTo} />
      <button
        onClick={handleLog}
        disabled={!rumorText.trim()}
        className={cn(
          'w-full min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer',
          !rumorText.trim() ? 'opacity-60' : 'opacity-100'
        )}
      >
        Log Rumor
      </button>
    </Drawer>
  );
}
