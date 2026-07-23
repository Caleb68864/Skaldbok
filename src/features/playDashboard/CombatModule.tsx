import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';

export function CombatModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { logCoinChange } = useSessionLog();
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);
  const currency = getEngine(system).currency;
  // Only multi-denomination coin systems get the make-change widget.
  const showCoins = currency.mode === 'coins';
  const denominations = currency.denominations;
  const amounts = currency.read(character);

  /**
   * Adjusts one denomination by `delta`, re-making change across the whole
   * purse so the totals stay in their most compact form.
   */
  function adjustCoin(denominationId: string, delta: number) {
    const denom = denominations.find(d => d.id === denominationId);
    if (!denom) return;
    let changed = false;

    updateCharacter(prev => {
      const current = currency.read(prev);
      const total = denominations.reduce((sum, d) => sum + (current[d.id] ?? 0) * d.value, 0);
      const nextTotal = total + delta * denom.value;
      if (nextTotal < 0) return {};

      // Greedy decomposition — denominations are ordered highest value first.
      let remainder = nextTotal;
      const next: Record<string, number> = {};
      for (const d of denominations) {
        const count = Math.floor(remainder / d.value);
        next[d.id] = count;
        remainder -= count * d.value;
      }
      changed = true;
      return {
        ...currency.write(prev, next),
        updatedAt: nowISO(),
      };
    });

    if (changed) {
      logCoinChange(character.name, denominationId, delta, denom.abbr);
    }
  }

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
        {showCoins && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
          <p className="m-0 font-semibold text-[var(--color-text)]">Coins</p>
          {denominations.map(denom => {
            const unit = denom.label.toLowerCase();
            return (
              <div key={denom.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">{denom.label}</span>
                <button
                  type="button"
                  aria-label={`Spend 1 ${unit}`}
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  onClick={() => adjustCoin(denom.id, -1)}
                >
                  -
                </button>
                <span className="min-w-7 text-center text-[length:var(--font-size-md)] font-bold text-[var(--color-accent)]">
                  {amounts[denom.id] ?? 0}
                </span>
                <button
                  type="button"
                  aria-label={`Gain 1 ${unit}`}
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  onClick={() => adjustCoin(denom.id, 1)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </SectionPanel>
  );
}
