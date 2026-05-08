import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';

export function MagicModule({ character, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const spells = character.spells.filter(spell => spell.prepared || spell.pinnedAsStamp || spell.powerLevel === 0).slice(0, 8);
  const wp = character.resources.wp;

  function castSpell(label: string, cost: number) {
    if (!wp || wp.current < cost) {
      showToast('Not enough WP to cast this spell.', 'error');
      return;
    }
    updateCharacter(prev => ({
      resources: { ...prev.resources, wp: { ...wp, current: clamp(wp.current - cost, 0, wp.max) } },
      updatedAt: nowISO(),
    }));
    showToast(`Cast ${label} for ${cost} WP.`, 'success');
  }

  return (
    <SectionPanel title="Prepared Magic" collapsible defaultOpen>
      {spells.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">No prepared or pinned spells.</p>}
      <div className="flex flex-col gap-2">
        {spells.map(spell => {
          const cost = spell.powerLevel === 0 ? 1 : Math.max(1, spell.wpCost || 2);
          return (
            <div key={spell.id} className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] py-2">
              <div>
                <p className="m-0 font-semibold text-[var(--color-text)]">{spell.name}</p>
                <p className="m-0 text-xs text-[var(--color-text-muted)]">{spell.school} · {spell.range} · {spell.duration}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => castSpell(spell.name, cost)}>
                {cost} WP
              </Button>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
