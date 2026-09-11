import { useState } from 'react';
import { cn } from '../../lib/utils';
import { useModalBehaviour } from '../../hooks/useModalBehaviour';
import { statAbbr } from '../bestiary/creatureStats';
import type { CreatureStatField } from '../../types/system';

export interface QuickCreateParticipantFlowProps {
  /** Receives the name and one number per declared stat, keyed by stat id. */
  onSubmit: (name: string, stats: Record<string, number>) => Promise<void>;
  onCancel: () => void;
  /**
   * The active ruleset's declared creature stats — one numeric input each.
   *
   * @remarks
   * Passed in rather than read here: this file is a presentational form, and the
   * system definition belongs to the feature that owns the encounter. It is the
   * same prop `CreatureTemplateForm` and `CreatureTemplateCard` take, for the
   * same reason.
   *
   * This used to be three fixed inputs over `hp`/`armor`/`movement` with a
   * `labels` prop renaming them, on the stated grounds that
   * "`creatureTemplate.stats` is a fixed shape". It is not — it is
   * `z.record(z.string(), z.number())` keyed by whatever the ruleset declares —
   * so relabelling Traveller's three columns wrote Dragonbane's ids underneath
   * and dropped the other three stats Traveller declares.
   */
  statFields: CreatureStatField[];
}

const inputClass = 'w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm box-border';

/**
 * Inline quick-create form for adding a participant with minimal stats.
 * Creates a creature template + encounter participant in one operation.
 */
export function QuickCreateParticipantFlow({
  onSubmit,
  onCancel,
  statFields,
}: QuickCreateParticipantFlowProps) {
  const [name, setName] = useState('');
  // Kept as strings so an empty input stays empty rather than showing 0.
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const stats: Record<string, number> = {};
      for (const field of statFields) {
        const raw = entered[field.id];
        const value = raw ? Number(raw) : 0;
        stats[field.id] = Number.isFinite(value) ? value : 0;
      }
      await onSubmit(name.trim(), stats);
    } finally {
      setSaving(false);
    }
  };


  const dialogRef = useModalBehaviour<HTMLDivElement>(onCancel);

  return (
    <div
      ref={dialogRef}
      aria-modal="true"
      role="dialog"
      aria-label="Quick create participant"
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-5 pb-6"
      >
        <h3 className="text-[var(--color-text)] mb-3">Quick Add Participant</h3>
        <p className="mb-3 text-sm text-[var(--color-text-muted)]">
          Use this for one-off monsters or NPCs when they are not already in the bestiary or party.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--color-text)]">
            Name
            <input
              type="text"
              placeholder="Name (required)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoFocus
              required
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            {statFields.map((field) => (
              <label
                key={field.id}
                className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]"
              >
                {field.label}
                <input
                  type="number"
                  placeholder={statAbbr(field)}
                  value={entered[field.id] ?? ''}
                  onChange={(e) =>
                    setEntered((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                  className={inputClass}
                  min={0}
                />
              </label>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className={cn(
                'flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer',
                (!name.trim() || saving) && 'opacity-60'
              )}
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
