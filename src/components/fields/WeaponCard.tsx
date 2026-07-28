import type { Weapon } from '../../types/character';
import type { ItemFieldDef } from '../../types/system';
import { Card } from '../primitives/Card';
import { Button } from '../primitives/Button';

/** Props for {@link WeaponCard}: the weapon plus the active system's field-visibility config. */
export interface WeaponCardProps {
  weapon: Weapon;
  onEquipToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditMode: boolean;
  /**
   * Built-in field ids the active system hides, from
   * `itemFields.hiddenBuiltIns.weapon`. Omitted means show everything.
   */
  hiddenBuiltIns?: string[];
  /** The active system's extra weapon fields, from `itemFields.weapon`. */
  systemFields?: ItemFieldDef[];
}

/** One `label: value` pair in the summary line. */
interface SummaryPart {
  key: string;
  label: string | null;
  value: string;
}

/**
 * Builds the summary line from the fields the active system actually uses.
 *
 * @remarks
 * Hardcoding grip/range/damage/durability meant a Traveller weapon displayed
 * "one-handed · Range: · Dur: 0" — two Dragonbane concepts the editor already
 * hides, a blank built-in `range` (Traveller stores metres in
 * `systemFields.rangeM`), and none of the TL/Magazine/Traits the player
 * actually entered. The summary now mirrors the editor: hidden built-ins are
 * dropped and the system's own fields are appended.
 */
function buildSummary(
  weapon: Weapon,
  hiddenBuiltIns: string[],
  systemFields: ItemFieldDef[],
): SummaryPart[] {
  const shows = (id: string) => !hiddenBuiltIns.includes(id);
  const parts: SummaryPart[] = [];

  if (shows('grip') && weapon.grip) parts.push({ key: 'grip', label: null, value: String(weapon.grip) });
  if (shows('range') && weapon.range) parts.push({ key: 'range', label: 'Range', value: String(weapon.range) });
  if (weapon.damage) parts.push({ key: 'damage', label: 'Damage', value: String(weapon.damage) });
  if (shows('durability') && weapon.durability) {
    parts.push({ key: 'durability', label: 'Dur', value: String(weapon.durability) });
  }

  for (const field of systemFields) {
    const raw = weapon.systemFields?.[field.id];
    if (raw === undefined || raw === null || raw === '') continue;
    parts.push({ key: field.id, label: field.label, value: String(raw) });
  }

  return parts;
}

/**
 * Card for one weapon: name, equip toggle, a system-aware summary line, and
 * edit/delete in edit mode.
 *
 * @remarks
 * The summary is built by `buildSummary` from only the fields the active system
 * uses, so a non-Dragonbane weapon shows its own stats instead of blank Dragonbane
 * ones.
 */
export function WeaponCard({
  weapon,
  onEquipToggle,
  onEdit,
  onDelete,
  isEditMode,
  hiddenBuiltIns = [],
  systemFields = [],
}: WeaponCardProps) {
  const summary = buildSummary(weapon, hiddenBuiltIns, systemFields);

  return (
    <Card className={weapon.equipped ? 'border-l-[3px] border-l-[var(--color-primary)]' : undefined}>
      <div className="flex justify-between items-start gap-[var(--space-sm)] flex-wrap">
        <div className="flex-1">
          <h3 className="text-[var(--color-text)] text-[length:var(--font-size-md)] mb-[var(--space-xs)]">{weapon.name}</h3>
          <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
            {summary.map((p, i) => (
              <span key={p.key}>
                {i > 0 && ' · '}
                {p.label ? `${p.label}: ${p.value}` : p.value}
              </span>
            ))}
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
