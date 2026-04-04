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
      <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
        <div className="flex-1">
          <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)]">
            {spell.name}
            <span className="text-[var(--color-accent)] text-[length:var(--font-size-sm)] ml-[var(--space-sm)]">{spell.school}</span>
          </h3>
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            WP Cost: {spell.wpCost} · Range: {spell.range} · Duration: {spell.duration}
          </p>
          {spell.summary && <p className="text-[var(--color-text)] text-[length:var(--font-size-sm)] mt-[var(--space-xs)]">{spell.summary}</p>}
        </div>
        {isEditMode && (
          <div className="flex gap-3">
            <Button size="sm" onClick={onEdit}>Edit</Button>
            <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
