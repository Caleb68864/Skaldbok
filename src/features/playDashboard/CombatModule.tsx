import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import { CurrencyAdjuster } from '../../components/fields/CurrencyAdjuster';
import { remakeCurrency } from '../../utils/currency';

export function CombatModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { logCoinChange } = useSessionLog();
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);
  const engine = getEngine(system);
  const currency = engine.currency;
  // Damage-track systems (Traveller) show the purse under Vitals via
  // CurrencyModule, so it is not repeated here. Pool systems (Dragonbane) keep
  // their coins in Ready Gear.
  const showCoins = currency.denominations.length > 0 && !engine.damageTrack;
  // Durability is a Dragonbane mechanic; systems that hide the field have no
  // notion of a weapon being "damaged", so the toggle must not appear.
  const usesDurability = !(system?.itemFields?.hiddenBuiltIns?.weapon ?? []).includes('durability');
  const weaponFields = system?.itemFields?.weapon ?? [];
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
      const next = remakeCurrency(denominations, currency.read(prev), denominationId, delta);
      if (!next) return {};
      changed = true;
      return { ...currency.write(prev, next), updatedAt: nowISO() };
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
              <p className="m-0 text-xs text-[var(--color-text-muted)]">
                {[
                  weapon.damage,
                  usesDurability ? weapon.range : null,
                  usesDurability ? `durability ${weapon.durability}` : null,
                  ...weaponFields.map(f => {
                    const raw = weapon.systemFields?.[f.id];
                    return raw === undefined || raw === null || raw === '' ? null : `${f.label}: ${raw}`;
                  }),
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            {usesDurability && (
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
            )}
          </div>
        ))}
        {showCoins && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
          <p className="m-0 font-semibold text-[var(--color-text)]">{currency.label}</p>
          <CurrencyAdjuster denominations={denominations} amounts={amounts} onDelta={adjustCoin} />
        </div>
        )}
      </div>
    </SectionPanel>
  );
}
