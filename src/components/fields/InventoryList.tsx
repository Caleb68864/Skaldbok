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
    return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No inventory items.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {items.map(item => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-divider)', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1 }}>
            <span style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>{item.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-sm)' }}>
              x{item.quantity} · {item.weight} wt
            </span>
          </div>
          {isEditMode && (
            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
              <Button size="sm" onClick={() => onEdit(item)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => onDelete(item.id)}>Delete</Button>
            </div>
          )}
        </div>
      ))}
      {isEditMode && (
        <Button variant="secondary" size="sm" onClick={onAdd} style={{ marginTop: 'var(--space-sm)' }}>+ Add Item</Button>
      )}
    </div>
  );
}
