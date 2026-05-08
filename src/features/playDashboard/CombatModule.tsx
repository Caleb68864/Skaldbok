import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import type { PlayModuleProps } from './types';

export function CombatModule({ character, updateCharacter }: PlayModuleProps) {
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);

  return (
    <SectionPanel title="Ready Gear" collapsible defaultOpen>
      {equipped.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No equipped weapons.</p>}
      <div className="flex flex-col gap-2">
        {equipped.map(weapon => (
          <div key={weapon.id} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2">
            <div className="min-w-0">
              <p className="m-0 font-semibold text-[var(--color-text)]">{weapon.name}</p>
              <p className="m-0 text-xs text-[var(--color-text-muted)]">{weapon.damage} · {weapon.range} · durability {weapon.durability}</p>
            </div>
            {weapon.damaged && <span className="text-xs text-[var(--color-danger)] font-semibold">Damaged</span>}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateCharacter(prev => ({
                weapons: prev.weapons.map(w => w.id === weapon.id ? { ...w, damaged: !w.damaged } : w),
                updatedAt: new Date().toISOString(),
              }))}
            >
              {weapon.damaged ? 'Repair' : 'Damage'}
            </Button>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
