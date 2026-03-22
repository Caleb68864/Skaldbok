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
    <Card style={{ borderLeft: weapon.equipped ? '3px solid var(--color-primary)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ color: 'var(--color-text)', fontSize: 'var(--font-size-md)', marginBottom: 'var(--space-xs)' }}>{weapon.name}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            {weapon.grip} · Range: {weapon.range} · Damage: {weapon.damage} · Dur: {weapon.durability}
          </p>
          {weapon.features && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>{weapon.features}</p>}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
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
