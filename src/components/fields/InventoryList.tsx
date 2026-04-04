import type { InventoryItem } from '../../types/character';
import { Button } from '../primitives/Button';

interface InventoryListProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  isEditMode: boolean;
}

export function InventoryList({ items, onEdit, onDelete, onAdd, isEditMode }: InventoryListProps) {
  if (items.length === 0 && !isEditMode) {
    return <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No inventory items.</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-[var(--space-sm)] py-[var(--space-sm)] border-b border-[var(--color-divider)] flex-wrap">
          <div className="flex-1">
            <span className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{item.name}</span>
            <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] ml-[var(--space-sm)]">
              x{item.quantity} · {item.weight} wt
            </span>
          </div>
          {isEditMode && (
            <div className="flex gap-3">
              <Button size="sm" onClick={() => onEdit(item)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(item.id)}>Delete</Button>
            </div>
          )}
        </div>
      ))}
      {isEditMode && (
        <Button variant="secondary" size="sm" onClick={onAdd} className="mt-[var(--space-sm)]">+ Add Item</Button>
      )}
    </div>
  );
}
