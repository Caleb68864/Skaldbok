import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';
import { getEngine } from '../systems/engine';
import { toHeroicAbilities } from '../../utils/abilities';

export function AbilityModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const engine = getEngine(system);
  const magic = engine.magic;
  const res = magic ? engine.terms.magicResource : '';
  const abilities = toHeroicAbilities(character.abilities).slice(0, 8);

  if (abilities.length === 0) return null;

  function spendWp(cost: number | undefined, label: string) {
    const pool = magic ? character.resources[magic.resourceId] : undefined;
    if (!cost || !magic || !pool) {
      showToast(`${label} noted.`, 'info');
      return;
    }
    if (pool.current < cost) {
      showToast(`Not enough ${res}.`, 'error');
      return;
    }
    updateCharacter(prev => ({
      resources: { ...prev.resources, [magic.resourceId]: { ...pool, current: clamp(pool.current - cost, 0, pool.max) } },
      updatedAt: nowISO(),
    }));
    showToast(`${label}: spent ${cost} ${res}.`, 'success');
  }

  return (
    <SectionPanel title="Abilities" collapsible defaultOpen>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        {abilities.map(ability => (
          <div key={ability.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
            <div className="min-w-0">
              <p className="m-0 font-semibold text-[var(--color-text)]">{ability.name}</p>
              {ability.summary && <p className="m-0 text-xs text-[var(--color-text-muted)]">{ability.summary}</p>}
            </div>
            <Button size="sm" variant="secondary" className="self-start" onClick={() => spendWp(ability.wpCost, ability.name)}>
              {ability.wpCost ? `${ability.wpCost} ${res}` : 'Use'}
            </Button>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
