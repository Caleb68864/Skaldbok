import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';

export function CombatModule({ character, updateCharacter }: PlayModuleProps) {
  const { logCoinChange } = useSessionLog();
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);

  function adjustCoin(coin: 'gold' | 'silver' | 'copper', delta: number) {
    const totalCopper = character.coins.gold * 100 + character.coins.silver * 10 + character.coins.copper;
    if (delta < 0) {
      const coinValue = coin === 'gold' ? 100 : coin === 'silver' ? 10 : 1;
      if (totalCopper < coinValue) return;
    }

    let { gold, silver, copper } = character.coins;
    if (coin === 'gold') gold += delta;
    if (coin === 'silver') silver += delta;
    if (coin === 'copper') copper += delta;

    while (copper < 0 && silver > 0) { copper += 10; silver -= 1; }
    while (copper < 0 && gold > 0) { gold -= 1; silver += 9; copper += 10; }
    while (silver < 0 && gold > 0) { gold -= 1; silver += 10; }
    if (gold < 0 || silver < 0 || copper < 0) return;

    updateCharacter({
      coins: { gold, silver, copper },
      updatedAt: nowISO(),
    });
    logCoinChange(character.name, coin, delta);
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
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
          <p className="m-0 font-semibold text-[var(--color-text)]">Coins</p>
          {(['gold', 'silver', 'copper'] as const).map(coin => {
            const label = coin.charAt(0).toUpperCase() + coin.slice(1);
            return (
              <div key={coin} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">{label}</span>
                <button
                  type="button"
                  aria-label={`Spend 1 ${coin}`}
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  onClick={() => adjustCoin(coin, -1)}
                >
                  -
                </button>
                <span className="min-w-7 text-center text-[length:var(--font-size-md)] font-bold text-[var(--color-accent)]">
                  {character.coins[coin]}
                </span>
                <button
                  type="button"
                  aria-label={`Gain 1 ${coin}`}
                  className="flex min-h-8 min-w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
                  onClick={() => adjustCoin(coin, 1)}
                >
                  +
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </SectionPanel>
  );
}
