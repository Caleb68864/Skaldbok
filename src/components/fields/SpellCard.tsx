import type { Spell } from '../../types/character';
import { Card } from '../primitives/Card';
import { Button } from '../primitives/Button';

interface SpellCardProps {
  spell: Spell;
  onEdit: () => void;
  onDelete: () => void;
  isEditMode: boolean;
}

export function SpellCard({ spell, onEdit, onDelete, isEditMode }: SpellCardProps) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-xs)' }}>
            {spell.name}
            <span style={{ color: 'var(--color-accent)', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-sm)' }}>{spell.school}</span>
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            WP Cost: {spell.wpCost} · Range: {spell.range} · Duration: {spell.duration}
          </p>
          {spell.summary && <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-xs)' }}>{spell.summary}</p>}
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
