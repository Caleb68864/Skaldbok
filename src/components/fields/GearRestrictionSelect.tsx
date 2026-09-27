import type { SystemEngine } from '../../features/systems/engine/types';

type Restrictions = NonNullable<SystemEngine['gearRestrictions']>;

export function GearRestrictionSelect({ name, kind, value, onChange, restrictions }: {
  name: string;
  kind: 'weapon' | 'armour' | 'item';
  value?: string;
  onChange: (value: string | undefined) => void;
  restrictions?: Restrictions;
}) {
  if (!restrictions) return null;
  const inferred = restrictions.infer(name, kind);
  const inferredLabel = restrictions.categories.find(category => category.id === inferred)?.label;
  return <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
    Restriction class
    <select className="w-full min-h-11 p-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]" value={value ?? ''} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">Auto{inferredLabel ? ` — ${inferredLabel}` : ' — no clear match'}</option>
      {value && !restrictions.categories.some(category => category.id === value) && <option value={value}>Unknown saved class: {value}</option>}
      {restrictions.categories.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
    </select>
  </label>;
}
