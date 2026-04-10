import { useState } from 'react';
import { TiptapNoteEditor } from '../../../components/notes/TiptapNoteEditor';
import { useSessionLog } from '../useSessionLog';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from './AttachToControl';

export interface QuickNoteActionProps {
  /** Active campaign id, forwarded to TiptapNoteEditor for mention lookups. */
  campaignId: string | null;
  /** Called when the user cancels or after a successful save. */
  onClose: () => void;
}

/**
 * Generic rich-text quick note entry form for the Quick Log palette.
 *
 * Uses {@link useSessionLog.logGenericNote} to persist the note and supports
 * the {@link AttachToControl} per-entry attach-to-encounter override. Fires a
 * success toast after a successful write.
 */
export function QuickNoteAction({ campaignId, onClose }: QuickNoteActionProps) {
  const { logGenericNote } = useSessionLog();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<unknown>(undefined);
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const target = resolveAttach(attachTo);
      await logGenericNote(title.trim() || 'Note', body, { targetEncounterId: target });

      // Success toast
      let encounterTitle: string | null = null;
      if (attachTo === 'auto') {
        encounterTitle = sessionEncounterCtx?.activeEncounter?.title ?? null;
      } else if (typeof attachTo === 'string') {
        encounterTitle = 'encounter';
      }
      if (encounterTitle) {
        showToast(`Logged to ${encounterTitle}`, 'success', 2000);
      } else {
        showToast('Logged to session', 'success', 2000);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-w-[300px]">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
      />
      <TiptapNoteEditor
        initialContent={body}
        onChange={setBody}
        campaignId={campaignId}
        placeholder="Freeform thought…"
        showToolbar
        minHeight="120px"
      />
      <AttachToControl value={attachTo} onChange={setAttachTo} />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-4 py-2 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-sm font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
