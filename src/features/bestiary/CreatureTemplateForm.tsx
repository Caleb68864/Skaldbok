import { useState } from 'react';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { cn } from '../../lib/utils';

type FormData = Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>;

interface CreatureTemplateFormProps {
  /** Pre-populated data when editing an existing template. */
  initial?: CreatureTemplate;
  campaignId: string;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}

const inputClass = 'w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm box-border';
const labelClass = 'block text-[var(--color-text-muted)] text-xs font-semibold mb-1';
const primaryBtnClass = 'min-h-11 px-5 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer';
const secondaryBtnClass = 'min-h-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm cursor-pointer';

/**
 * Form for creating or editing a creature template.
 * Renders as a modal overlay.
 */
export function CreatureTemplateForm({ initial, campaignId, onSave, onCancel }: CreatureTemplateFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<'monster' | 'npc' | 'animal'>(initial?.category ?? 'monster');
  const [role, setRole] = useState(initial?.role ?? '');
  const [affiliation, setAffiliation] = useState(initial?.affiliation ?? '');
  const [hp, setHp] = useState(initial?.stats.hp ?? 0);
  const [armor, setArmor] = useState(initial?.stats.armor ?? 0);
  const [movement, setMovement] = useState(initial?.stats.movement ?? 0);
  const [tagsText, setTagsText] = useState(initial?.tags.join(', ') ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        campaignId,
        name: name.trim(),
        category,
        role: role.trim() || undefined,
        affiliation: affiliation.trim() || undefined,
        stats: { hp, armor, movement },
        attacks: initial?.attacks ?? [],
        abilities: initial?.abilities ?? [],
        skills: initial?.skills ?? [],
        tags: tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        imageUrl: imageUrl.trim() || undefined,
        status: initial?.status ?? 'active',
        description: initial?.description,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={initial ? 'Edit creature template' : 'New creature template'}
      onClick={onCancel}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end sm:items-center justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl sm:rounded-2xl w-full max-w-[480px] max-h-[85vh] overflow-y-auto px-4 pt-5 pb-6"
      >
        <h3 className="text-[var(--color-text)] mb-4">
          {initial ? 'Edit Creature' : 'New Creature'}
        </h3>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className={labelClass}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <div className="flex gap-2">
              {(['monster', 'npc', 'animal'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border-none cursor-pointer',
                    category === c
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Role</label>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} placeholder="e.g. Guard" />
            </div>
            <div>
              <label className={labelClass}>Affiliation</label>
              <input type="text" value={affiliation} onChange={(e) => setAffiliation(e.target.value)} className={inputClass} placeholder="e.g. Merchant Guild" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>HP</label>
              <input type="number" value={hp} onChange={(e) => setHp(Number(e.target.value))} className={inputClass} min={0} />
            </div>
            <div>
              <label className={labelClass}>Armor</label>
              <input type="number" value={armor} onChange={(e) => setArmor(Number(e.target.value))} className={inputClass} min={0} />
            </div>
            <div>
              <label className={labelClass}>Movement</label>
              <input type="number" value={movement} onChange={(e) => setMovement(Number(e.target.value))} className={inputClass} min={0} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tags (comma separated)</label>
            <input type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClass} placeholder="e.g. undead, boss" />
          </div>
          <div>
            <label className={labelClass}>Image URL</label>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="submit" disabled={!name.trim() || saving} className={cn(primaryBtnClass, (!name.trim() || saving) && 'opacity-60')}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onCancel} className={secondaryBtnClass}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
