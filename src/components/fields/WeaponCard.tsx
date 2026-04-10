import type { Weapon } from '../../types/character';
import { Card } from '../primitives/Card';
import { Button } from '../primitives/Button';

interface WeaponCardProps {
  weapon: Weapon;
  onEquipToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditMode: boolean;
}

export function WeaponCard({ weapon, onEquipToggle, onEdit, onDelete, isEditMode }: WeaponCardProps) {
  return (
    <Card className={weapon.equipped ? 'border-l-[3px] border-l-[var(--color-primary)]' : undefined}>
      <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
        <div className="flex-1">
          <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)]">{weapon.name}</h3>
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            {weapon.grip} · Range: {weapon.range} · Damage: {weapon.damage} · Dur: {weapon.durability}
          </p>
          {weapon.features && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">{weapon.features}</p>}
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button size="sm" variant={weapon.equipped ? 'primary' : 'secondary'} onClick={onEquipToggle}>
            {weapon.equipped ? 'Equipped' : 'Equip'}
          </Button>
          {isEditMode && <Button size="sm" onClick={onEdit}>Edit</Button>}
          {isEditMode && <Button size="sm" variant="danger" onClick={onDelete}>Delete</Button>}
        </div>
      </div>
    </Card>
  );
}
