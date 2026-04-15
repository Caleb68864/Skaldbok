import { useState } from 'react';
import { useSessionLog } from '../useSessionLog';
import { useToast } from '../../../context/ToastContext';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { AttachToControl, resolveAttach, type AttachToValue } from './AttachToControl';

export interface QuickNpcActionProps {
  /** Called when the user cancels or after a successful save. */
  onClose: () => void;
  /** Optional callback fired after a successful save. */
  onSaved?: () => void;
}

type NpcCategory = 'monster' | 'npc' | 'animal';

/**
 * Minimal NPC / monster capture form for the Quick Log palette.
 *
 * Wraps {@link useSessionLog.logNpcCapture} so each save creates both a
 * bestiary creature template and a note referencing it. Supports the
 * {@link AttachToControl} per-entry attach-to-encounter override and fires a
 * success toast after a successful write.
 */
export function QuickNpcAction({ onClose, onSaved }: QuickNpcActionProps) {
  const { logNpcCapture } = useSessionLog();
  const { showToast } = useToast();
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<NpcCategory>('npc');
  const [hp, setHp] = useState('');
  const [description, setDescription] = useState('');
  const [attachTo, setAttachTo] = useState<AttachToValue>('auto');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const target = resolveAttach(attachTo);
      const hpNum = hp.trim() ? parseInt(hp, 10) : undefined;
      await logNpcCapture(
        {
          name: name.trim(),
          category,
          hp: Number.isFinite(hpNum) ? hpNum : undefined,
          description: description.trim() || undefined,
        },
        { targetEncounterId: target },
      );

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
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-w-[280px]">
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
          placeholder="e.g. Drunk Patron"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as NpcCategory)}
          className="px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base"
        >
          <option value="npc">NPC</option>
          <option value="monster">Monster</option>
          <option value="animal">Animal</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        HP (optional)
        <input
          type="number"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
          rows={2}
        />
      </label>
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
          disabled={!canSubmit}
          className="min-h-11 px-4 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
        >
          Save
        </button>
      </div>
    </div>
  );
}
