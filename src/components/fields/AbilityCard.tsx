import type { HeroicAbility } from '../../types/character';
import { Card } from '../primitives/Card';
import { Button } from '../primitives/Button';

interface AbilityCardProps {
  ability: HeroicAbility;
  onEdit: () => void;
  onDelete: () => void;
  isEditMode: boolean;
}

export function AbilityCard({ ability, onEdit, onDelete, isEditMode }: AbilityCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-xs)' }}>{ability.name}</h3>
          {ability.summary && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{ability.summary}</p>}
        </div>
        {isEditMode && (
          <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <Button size="sm" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
