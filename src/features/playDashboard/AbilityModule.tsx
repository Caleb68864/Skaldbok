import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';

export function AbilityModule({ character, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const abilities = character.heroicAbilities.slice(0, 8);

  if (abilities.length === 0) return null;

  function spendWp(cost: number | undefined, label: string) {
    const wp = character.resources.wp;
    if (!cost || !wp) {
      showToast(`${label} noted.`, 'info');
      return;
    }
    if (wp.current < cost) {
      showToast('Not enough WP.', 'error');
      return;
    }
    updateCharacter(prev => ({
      resources: { ...prev.resources, wp: { ...wp, current: clamp(wp.current - cost, 0, wp.max) } },
      updatedAt: nowISO(),
    }));
    showToast(`${label}: spent ${cost} WP.`, 'success');
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
              {ability.wpCost ? `${ability.wpCost} WP` : 'Use'}
            </Button>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
