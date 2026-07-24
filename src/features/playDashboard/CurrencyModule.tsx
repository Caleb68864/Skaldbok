import { SectionPanel } from '../../components/primitives/SectionPanel';
import { CurrencyAdjuster } from '../../components/fields/CurrencyAdjuster';
import { nowISO } from '../../utils/dates';
import { remakeCurrency } from '../../utils/currency';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import type { PlayModuleProps } from './types';

/**
 * The money purse as a standalone play-dashboard panel, so it can sit under
 * Vitals in the left column rather than buried in Ready Gear.
 *
 * @remarks
 * Kept functional (not read-only) — credits change constantly in play. Overspend
 * protection and denomination change-making run through the shared
 * {@link remakeCurrency}. Hidden for a system with no currency.
 */
export function CurrencyModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { logCoinChange } = useSessionLog();
  const engine = getEngine(system);
  const currency = engine.currency;
  const denominations = currency.denominations;

  if (denominations.length === 0) return null;

  function adjust(denomId: string, delta: number) {
    const denom = denominations.find(d => d.id === denomId);
    if (!denom) return;
    let changed = false;
    updateCharacter(prev => {
      const next = remakeCurrency(denominations, currency.read(prev), denomId, delta);
      if (!next) return {};
      changed = true;
      return { ...currency.write(prev, next), updatedAt: nowISO() };
    });
    if (changed) logCoinChange(character.name, denomId, delta, denom.abbr);
  }

  return (
    <SectionPanel title={currency.label} collapsible defaultOpen>
      <CurrencyAdjuster denominations={denominations} amounts={currency.read(character)} onDelta={adjust} quickButtons={false} />
    </SectionPanel>
  );
}
