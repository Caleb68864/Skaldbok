import { useState } from 'react';
import { cn } from '../../lib/utils';

interface QuickCreateParticipantFlowProps {
  onSubmit: (name: string, stats: { hp?: number; armor?: number; movement?: number }) => Promise<void>;
  onCancel: () => void;
}

const inputClass = 'w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm box-border';

/**
 * Inline quick-create form for adding a participant with minimal stats.
 * Creates a creature template + encounter participant in one operation.
 */
export function QuickCreateParticipantFlow({ onSubmit, onCancel }: QuickCreateParticipantFlowProps) {
  const [name, setName] = useState('');
  const [hp, setHp] = useState('');
  const [armor, setArmor] = useState('');
  const [movement, setMovement] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), {
        hp: hp ? Number(hp) : undefined,
        armor: armor ? Number(armor) : undefined,
        movement: movement ? Number(movement) : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
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
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              HP
              <input
                type="number"
                placeholder="HP"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
                className={inputClass}
                min={0}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              Armor
              <input
                type="number"
                placeholder="Armor"
                value={armor}
                onChange={(e) => setArmor(e.target.value)}
                className={inputClass}
                min={0}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              Movement
              <input
                type="number"
                placeholder="Movement"
                value={movement}
                onChange={(e) => setMovement(e.target.value)}
                className={inputClass}
                min={0}
              />
            </label>
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
