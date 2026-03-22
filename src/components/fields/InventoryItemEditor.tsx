import { useState, useEffect } from 'react';
import type { InventoryItem } from '../../types/character';
import { Drawer } from '../primitives/Drawer';
import { Button } from '../primitives/Button';
import { generateId } from '../../utils/ids';

interface InventoryItemEditorProps {
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  onSave: (item: InventoryItem) => void;
}

export function InventoryItemEditor({ open, onClose, item, onSave }: InventoryItemEditorProps) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setWeight(item?.weight ?? 0);
      setQuantity(item?.quantity ?? 1);
      setDescription(item?.description ?? '');
    }
  }, [open, item]);

  function handleSave() {
    onSave({ id: item?.id ?? generateId(), name, weight, quantity, description });
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 'var(--space-sm)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: 'var(--font-size-md)', fontFamily: 'inherit',
  };

  return (
    <Drawer open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Weight</label>
            <input type="number" style={inputStyle} value={weight} min={0} onChange={e => setWeight(Number(e.target.value))} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Quantity</label>
            <input type="number" style={inputStyle} value={quantity} min={0} onChange={e => setQuantity(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>Description</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} value={description} rows={3} onChange={e => setDescription(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
  );
}
