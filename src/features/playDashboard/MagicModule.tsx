import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

function isMagicTrick(powerLevel: number, school: string): boolean {
  return powerLevel === 0 || school.toLowerCase().includes('trick');
}

export function MagicModule({ character, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const [powerLevels, setPowerLevels] = useState<Record<string, number>>({});
  const spells = character.spells.filter(spell => spell.prepared || spell.pinnedAsStamp || spell.powerLevel === 0).slice(0, 8);
  const wp = character.resources.wp;

  if (spells.length === 0) return null;

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
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {spells.map(spell => {
          const trick = isMagicTrick(spell.powerLevel, spell.school);
          const powerLevel = powerLevels[spell.id] ?? 1;
          const cost = trick ? 1 : powerLevel * 2;
          return (
            <div key={spell.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="m-0 font-semibold text-[var(--color-text)]">{spell.name}</p>
                  <Button size="sm" variant="secondary" onClick={() => castSpell(spell.name, cost)}>
                    {cost} WP
                  </Button>
                </div>
                <p className="m-0 text-xs text-[var(--color-text-muted)]">{spell.school} · {spell.range} · {spell.duration}</p>
              </div>
              {!trick && (
                <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={`${spell.name} power level`}>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Power</span>
                  {([1, 2, 3] as const).map(level => {
                    const levelCost = level * 2;
                    const selected = level === powerLevel;
                    return (
                      <button
                        key={level}
                        type="button"
                        className={cn(
                          'h-8 w-8 rounded-full border text-sm font-semibold transition-colors',
                          selected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] hover:border-[var(--color-accent)]',
                          wp && wp.current < levelCost && !selected && 'opacity-50'
                        )}
                        onClick={() => setPowerLevels(prev => ({ ...prev, [spell.id]: level }))}
                        aria-label={`Power level ${level}, ${levelCost} WP`}
                        aria-pressed={selected}
                      >
                        {level}
                      </button>
                    );
                  })}
                  {spell.powerScaling?.[powerLevel - 1] && (
                    <span className="text-xs text-[var(--color-accent-alt)]">{spell.powerScaling[powerLevel - 1]}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
