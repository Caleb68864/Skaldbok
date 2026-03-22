import { useState } from 'react';
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

const empty: Omit<Weapon, 'id'> = { name: '', grip: 'one-handed', range: '', damage: '', durability: 0, features: '', equipped: false };

export function WeaponEditor({ open, onClose, weapon, onSave }: WeaponEditorProps) {
  const [form, setForm] = useState<Omit<Weapon, 'id'>>(weapon ? { ...weapon } : { ...empty });

  function handleOpen() {
    setForm(weapon ? { ...weapon } : { ...empty });
  }

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

  if (open && form.name === '' && weapon) {
    handleOpen();
  }

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
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
  );
}
