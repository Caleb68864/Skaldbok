import { useState, useEffect } from 'react';
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: 'var(--space-sm)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text)',
    fontSize: 'var(--font-size-md)',
    fontFamily: 'inherit',
  };

  if (!open) return null;

  return (
    <Drawer open={open} onClose={onClose} title={weapon ? 'Edit Weapon' : 'Add Weapon'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {([['Name', 'name', 'text'], ['Range', 'range', 'text'], ['Damage', 'damage', 'text'], ['Features', 'features', 'text']] as [string, keyof typeof form, string][]).map(([label, field, type]) => (
          <div key={field}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>{label}</label>
            <input type={type} value={String(form[field])} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} style={inputStyle} />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Grip</label>
          <select value={form.grip} onChange={e => setForm(f => ({ ...f, grip: e.target.value as 'one-handed' | 'two-handed' }))} style={inputStyle}>
            <option value="one-handed">One-handed</option>
            <option value="two-handed">Two-handed</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Durability</label>
          <input type="number" value={form.durability} min={0} onChange={e => setForm(f => ({ ...f, durability: Number(e.target.value) }))} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Damage Type</label>
          <select
            value={form.damageType ?? ''}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, damageType: val === '' ? null : (val as 'bludgeoning' | 'slashing' | 'piercing') }));
            }}
            style={{ ...inputStyle, minHeight: '44px' }}
          >
            <option value="">None</option>
            <option value="bludgeoning">Bludgeoning</option>
            <option value="slashing">Slashing</option>
            <option value="piercing">Piercing</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>STR Requirement</label>
          <input
            type="number"
            value={form.strRequirement ?? ''}
            min={0}
            placeholder="None"
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, strRequirement: val === '' || Number(val) === 0 ? null : Number(val) }));
            }}
            style={{ ...inputStyle, minHeight: '44px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minHeight: '44px' }}>
          <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', flex: 1 }}>Shield</label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, isShield: !f.isShield }))}
            style={{
              minHeight: '44px',
              minWidth: '80px',
              padding: '0 var(--space-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: form.isShield ? 'var(--color-primary)' : 'var(--color-surface-alt)',
              color: form.isShield ? 'var(--color-primary-text, #fff)' : 'var(--color-text)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {form.isShield ? 'Yes' : 'No'}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minHeight: '44px' }}>
          <label style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', flex: 1 }}>Damaged</label>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, damaged: !f.damaged }))}
            style={{
              minHeight: '44px',
              minWidth: '80px',
              padding: '0 var(--space-md)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: form.damaged ? 'var(--color-danger, #c0392b)' : 'var(--color-surface-alt)',
              color: form.damaged ? '#fff' : 'var(--color-text)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {form.damaged ? 'Yes' : 'No'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
  );
}
