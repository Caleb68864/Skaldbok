import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import type { PlayModuleProps } from './types';

export function CombatModule({ character, updateCharacter }: PlayModuleProps) {
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);

  if (equipped.length === 0) return null;

  return (
    <SectionPanel title="Ready Gear" collapsible defaultOpen>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        {equipped.map(weapon => (
          <div key={weapon.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="m-0 font-semibold text-[var(--color-text)]">{weapon.name}</p>
                {weapon.damaged && <span className="text-xs text-[var(--color-danger)] font-semibold">Damaged</span>}
              </div>
              <p className="m-0 text-xs text-[var(--color-text-muted)]">{weapon.damage} · {weapon.range} · durability {weapon.durability}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
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
