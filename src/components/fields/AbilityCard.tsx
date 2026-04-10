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
      <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
        <div className="flex-1">
          <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)]">{ability.name}</h3>
          {ability.summary && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">{ability.summary}</p>}
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
