import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';

export function AbilityModule({ character, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const abilities = character.heroicAbilities.slice(0, 8);

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
      {abilities.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No heroic abilities.</p>}
      <div className="flex flex-col gap-2">
        {abilities.map(ability => (
          <div key={ability.id} className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] py-2">
            <div>
              <p className="m-0 font-semibold text-[var(--color-text)]">{ability.name}</p>
              {ability.summary && <p className="m-0 text-xs text-[var(--color-text-muted)]">{ability.summary}</p>}
            </div>
            <Button size="sm" variant="secondary" onClick={() => spendWp(ability.wpCost, ability.name)}>
              {ability.wpCost ? `${ability.wpCost} WP` : 'Use'}
            </Button>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
