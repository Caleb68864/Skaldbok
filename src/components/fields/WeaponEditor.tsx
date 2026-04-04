import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import type { Weapon } from '../../types/character';
import { Drawer } from '../primitives/Drawer';
import { Button } from '../primitives/Button';
import { generateId } from '../../utils/ids';

interface WeaponEditorProps {
  open: boolean;
  onClose: () => void;
  weapon: Weapon | null;
  onSave: (weapon: Weapon) => void;
}

const empty: Omit<Weapon, 'id'> = {
  name: '',
  grip: 'one-handed',
  range: '',
  damage: '',
  durability: 0,
  features: '',
  equipped: false,
  damageType: null,
  strRequirement: null,
  damaged: false,
  isShield: false,
};

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]";

export function WeaponEditor({ open, onClose, weapon, onSave }: WeaponEditorProps) {
  const [form, setForm] = useState<Omit<Weapon, 'id'>>(weapon ? { ...empty, ...weapon } : { ...empty });

  useEffect(() => {
    if (open && weapon) {
      setForm({
        name: weapon.name,
        grip: weapon.grip,
        range: weapon.range,
        damage: weapon.damage,
        durability: weapon.durability,
        features: weapon.features,
        equipped: weapon.equipped,
        metal: weapon.metal,
        damageType: weapon.damageType ?? null,
        strRequirement: weapon.strRequirement ?? null,
        damaged: weapon.damaged ?? false,
        isShield: weapon.isShield ?? false,
      });
    } else if (open && !weapon) {
      setForm({ ...empty });
    }
  }, [open, weapon]);

  function handleSave() {
    onSave({ ...form, id: weapon?.id ?? generateId() });
    onClose();
  }

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={weapon ? 'Edit Weapon' : 'Add Weapon'}>
      <div className="flex flex-col gap-[var(--space-md)]">
        {([['Name', 'name', 'text'], ['Range', 'range', 'text'], ['Damage', 'damage', 'text'], ['Features', 'features', 'text']] as [string, keyof typeof form, string][]).map(([label, field, type]) => (
          <div key={field}>
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">{label}</label>
            <input type={type} value={String(form[field])} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} className={inputClasses} />
          </div>
        ))}
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Grip</label>
          <select value={form.grip} onChange={e => setForm(f => ({ ...f, grip: e.target.value as 'one-handed' | 'two-handed' }))} className={inputClasses}>
            <option value="one-handed">One-handed</option>
            <option value="two-handed">Two-handed</option>
          </select>
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Durability</label>
          <input type="number" value={form.durability} min={0} onChange={e => setForm(f => ({ ...f, durability: Number(e.target.value) }))} className={inputClasses} />
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Damage Type</label>
          <select
            value={form.damageType ?? ''}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, damageType: val === '' ? null : (val as 'bludgeoning' | 'slashing' | 'piercing') }));
            }}
            className={cn(inputClasses, "min-h-11")}
          >
            <option value="">None</option>
            <option value="bludgeoning">Bludgeoning</option>
            <option value="slashing">Slashing</option>
            <option value="piercing">Piercing</option>
          </select>
        </div>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">STR Requirement</label>
          <input
            type="number"
            value={form.strRequirement ?? ''}
            min={0}
            placeholder="None"
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, strRequirement: val === '' || Number(val) === 0 ? null : Number(val) }));
            }}
            className={cn(inputClasses, "min-h-11")}
          />
        </div>
        <div className="flex items-center gap-[var(--space-sm)] min-h-11">
          <label className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] flex-1">Shield</label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isShield: !f.isShield }))}
            className={cn(
              "min-h-11 min-w-20 px-[var(--space-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[length:var(--font-size-md)] font-[family-name:inherit] cursor-pointer",
              form.isShield
                ? "bg-[var(--color-primary)] text-[var(--color-primary-text,#fff)]"
                : "bg-[var(--color-surface-alt)] text-[var(--color-text)]"
            )}
          >
            {form.isShield ? 'Yes' : 'No'}
          </button>
        </div>
        <div className="flex items-center gap-[var(--space-sm)] min-h-11">
          <label className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] flex-1">Damaged</label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, damaged: !f.damaged }))}
            className={cn(
              "min-h-11 min-w-20 px-[var(--space-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[length:var(--font-size-md)] font-[family-name:inherit] cursor-pointer",
              form.damaged
                ? "bg-[var(--color-danger,#c0392b)] text-white"
                : "bg-[var(--color-surface-alt)] text-[var(--color-text)]"
            )}
          >
            {form.damaged ? 'Yes' : 'No'}
          </button>
        </div>
        <div className="flex gap-3 justify-end mt-[var(--space-md)]">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
  );
}
