import type { InventoryItem } from '../../types/character';
import { Button } from '../primitives/Button';

interface InventoryListProps {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onQuantityChange?: (id: string, quantity: number) => void;
  isEditMode: boolean;
}

export function InventoryList({ items, onEdit, onDelete, onAdd, onQuantityChange, isEditMode }: InventoryListProps) {
  if (items.length === 0 && !isEditMode) {
    return <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No inventory items.</p>;
  }

  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {items.map(item => {
        const isConsumable = !!item.consumable;
        const showQtyControls = isConsumable && !!onQuantityChange;
        return (
          <div key={item.id} className="flex items-center gap-[var(--space-sm)] py-[var(--space-sm)] border-b border-[var(--color-divider)] flex-wrap">
            <div className="flex-1">
              <span className="text-[var(--color-text)] text-[length:var(--font-size-md)]">{item.name}</span>
              {item.tiny && (
                <span className="ml-[var(--space-xs)] text-[length:var(--font-size-xs)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1 py-0.5">tiny</span>
              )}
              {isConsumable && (
                <span className="ml-[var(--space-xs)] text-[length:var(--font-size-xs)] text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-[var(--radius-sm)] px-1 py-0.5">consumable</span>
              )}
              <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] ml-[var(--space-sm)]">
                x{item.quantity} · {item.tiny ? '0' : item.weight} wt
              </span>
            </div>
            {showQtyControls && (
              <div className="flex items-center gap-[var(--space-xs)]">
                <button
                  type="button"
                  aria-label={`Decrease ${item.name}`}
                  onClick={() => onQuantityChange!(item.id, Math.max(0, item.quantity - 1))}
                  disabled={item.quantity <= 0}
                  className="min-w-[44px] min-h-[44px] text-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center hover:brightness-110 disabled:opacity-60 disabled:pointer-events-none"
                >−</button>
                <span className="min-w-[28px] text-center text-[length:var(--font-size-md)] font-bold text-[var(--color-text)]">{item.quantity}</span>
                <button
                  type="button"
                  aria-label={`Increase ${item.name}`}
                  onClick={() => onQuantityChange!(item.id, item.quantity + 1)}
                  className="min-w-[44px] min-h-[44px] text-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)] cursor-pointer flex items-center justify-center hover:brightness-110"
                >+</button>
              </div>
            )}
            {isEditMode && (
              <div className="flex gap-3">
                <Button size="sm" onClick={() => onEdit(item)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => onDelete(item.id)}>Delete</Button>
              </div>
            )}
          </div>
        );
      })}
      {isEditMode && (
        <Button variant="secondary" size="sm" onClick={onAdd} className="mt-[var(--space-sm)]">+ Add Item</Button>
      )}
    </div>
  );
}
