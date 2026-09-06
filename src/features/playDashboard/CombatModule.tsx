import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';
import { getEngine } from '../systems/engine';
import { CurrencyAdjuster } from '../../components/fields/CurrencyAdjuster';
import { useCoinAdjuster } from './useCoinAdjuster';

export function CombatModule({ character, system, updateCharacter }: PlayModuleProps) {
  const equipped = character.weapons.filter(w => w.equipped).slice(0, 6);
  const engine = getEngine(system);
  const currency = engine.currency;
  const adjustCoin = useCoinAdjuster(currency, character, updateCharacter);
  // A system that claims the `finances` panel shows its purse there, so Ready
  // Gear must not repeat it; one that does not keeps its coins here.
  //
  // This was `!engine.damageTrack` — whether a system has a cascading damage
  // track says nothing about where its money is displayed. The two happened to
  // coincide across the two systems that shipped, which is what a systemId
  // branch in disguise looks like. `panels` is the right source: unlike rest,
  // death and magic it has no nullable model to contradict it.
  const showCoins = currency.denominations.length > 0 && !engine.panels.includes('finances');
  // Durability is a Dragonbane mechanic; systems that hide the field have no
  // notion of a weapon being "damaged", so the toggle must not appear.
  const usesDurability = !(system?.itemFields?.hiddenBuiltIns?.weapon ?? []).includes('durability');
  const weaponFields = system?.itemFields?.weapon ?? [];
  const denominations = currency.denominations;
  const amounts = currency.read(character);

  return (
    <SectionPanel title={engine.labels.readyGearPanel ?? 'Ready Gear'} collapsible defaultOpen>
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
                  updatedAt: nowISO(),
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
