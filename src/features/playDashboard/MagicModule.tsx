import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { compareSpellsByRankThenName, formatCastingTime } from '../../utils/spells';
import { toSpells } from '../../utils/abilities';
import { clamp, type PlayModuleProps } from './types';
import { useToast } from '../../context/ToastContext';
import { getEngine } from '../systems/engine';
import { cn } from '../../lib/utils';

function isMagicTrick(powerLevel: number, school: string): boolean {
  return powerLevel === 0 || school.toLowerCase().includes('trick');
}

/**
 * Prepared-spell caster panel. The pool spent, its cost curve, and the trick
 * cost all come from `engine.magic` (E11) — `resourceId` is not assumed to be
 * `wp`, so a system spending a differently-named pool works with no code change.
 * Hidden when the system has no magic economy or the character has no prepared
 * spells.
 */
export function MagicModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { showToast } = useToast();
  const engine = getEngine(system);
  const magic = engine.magic;
  const res = magic ? engine.terms.magicResource : '';
  const [powerLevels, setPowerLevels] = useState<Record<string, number>>({});
  const spells = toSpells(character.abilities)
    .filter(spell => spell.prepared || spell.pinnedAsStamp || spell.powerLevel === 0)
    .sort(compareSpellsByRankThenName)
    .slice(0, 8);

  if (!magic || spells.length === 0) return null;
  // Alias the narrowed model so its type survives into the castSpell closure
  // (TS re-widens `magic` there, which is what forced the `!` assert).
  const m = magic;
  const pool = character.resources[m.resourceId];

  function castSpell(label: string, cost: number) {
    if (!pool || pool.current < cost) {
      showToast(`Not enough ${res} to cast this spell.`, 'error');
      return;
    }
    updateCharacter(prev => ({
      resources: { ...prev.resources, [m.resourceId]: { ...pool, current: clamp(pool.current - cost, 0, pool.max) } },
      updatedAt: nowISO(),
    }));
    showToast(`Cast ${label} for ${cost} ${res}.`, 'success');
  }

  return (
    <SectionPanel title="Prepared Magic" collapsible defaultOpen>
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
        {spells.map(spell => {
          const trick = isMagicTrick(spell.powerLevel, spell.school);
          const powerLevel = powerLevels[spell.id] ?? 1;
          const cost = trick ? magic.trickCost : powerLevel * magic.costPerLevel;
          return (
            <div key={spell.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="m-0 font-semibold text-[var(--color-text)]">{spell.name}</p>
                  <Button size="sm" variant="secondary" onClick={() => castSpell(spell.name, cost)}>
                    {cost} {res}
                  </Button>
                </div>
                <p className="m-0 text-xs text-[var(--color-text-muted)]">
                  {spell.school} · {spell.range} · {spell.duration} · Casting Time: {formatCastingTime(spell.castingTime)}
                </p>
              </div>
              {!trick && (
                <div className="flex items-center gap-2 flex-wrap" role="group" aria-label={`${spell.name} power level`}>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)]">Power</span>
                  {magic.powerLevels.map(level => {
                    const levelCost = level * magic.costPerLevel;
                    const selected = level === powerLevel;
                    return (
                      <button
                        key={level}
                        type="button"
                        className={cn(
                          'min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded-full border text-sm font-semibold transition-colors',
                          selected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-bg)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)] hover:border-[var(--color-accent)]',
                          pool && pool.current < levelCost && !selected && 'opacity-50'
                        )}
                        onClick={() => setPowerLevels(prev => ({ ...prev, [spell.id]: level }))}
                        aria-label={`Power level ${level}, ${levelCost} ${res}`}
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
