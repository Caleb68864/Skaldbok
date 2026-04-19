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

const inputClasses = "w-full p-[var(--space-sm)] border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-md)] font-[family-name:inherit]";

export function InventoryItemEditor({ open, onClose, item, onSave }: InventoryItemEditorProps) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [tiny, setTiny] = useState(false);
  const [consumable, setConsumable] = useState(false);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setWeight(item?.weight ?? 0);
      setQuantity(item?.quantity ?? 1);
      setDescription(item?.description ?? '');
      setTiny(item?.tiny ?? false);
      setConsumable(item?.consumable ?? false);
    }
  }, [open, item]);

  function handleSave() {
    onSave({
      id: item?.id ?? generateId(),
      name,
      weight: tiny ? 0 : weight,
      quantity,
      description,
      tiny,
      consumable,
    });
    onClose();
  }

  return (
    <Drawer open={open} onClose={onClose} title={item ? 'Edit Item' : 'Add Item'}>
      <div className="flex flex-col gap-[var(--space-md)]">
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Name</label>
          <input className={inputClasses} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Weight</label>
            <input
              type="number"
              className={inputClasses}
              value={tiny ? 0 : weight}
              disabled={tiny}
              min={0}
              onChange={e => setWeight(Number(e.target.value))}
            />
          </div>
          <div className="flex-1">
            <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Quantity</label>
            <input type="number" className={inputClasses} value={quantity} min={0} onChange={e => setQuantity(Number(e.target.value))} />
          </div>
        </div>
        <label className="flex items-center gap-[var(--space-sm)] text-[var(--color-text)] text-[length:var(--font-size-md)] cursor-pointer">
          <input
            type="checkbox"
            checked={tiny}
            onChange={e => setTiny(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
          Tiny item (no weight counted toward encumbrance)
        </label>
        <label className="flex items-center gap-[var(--space-sm)] text-[var(--color-text)] text-[length:var(--font-size-md)] cursor-pointer">
          <input
            type="checkbox"
            checked={consumable}
            onChange={e => setConsumable(e.target.checked)}
            className="w-5 h-5 cursor-pointer"
          />
          Consumable (show +/− quantity buttons in play mode)
        </label>
        <div>
          <label className="block text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] mb-[var(--space-xs)]">Description</label>
          <textarea className={`${inputClasses} resize-y`} value={description} rows={3} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </Drawer>
  );
}
