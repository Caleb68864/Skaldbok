import { SectionPanel } from '../../components/primitives/SectionPanel';
import { CurrencyAdjuster } from '../../components/fields/CurrencyAdjuster';
import { getEngine } from '../systems/engine';
import { useCoinAdjuster } from './useCoinAdjuster';
import type { PlayModuleProps } from './types';

interface CurrencyModuleProps extends PlayModuleProps {
  /**
   * Whether the purse renders {@link CurrencyAdjuster}'s fixed quick-step
   * buttons. Defaults to `false` — the compact custom-amount-only layout the
   * Play dashboard has always used — so a sheet template can opt back in.
   */
  quickButtons?: boolean;
}

/**
 * The money purse as a standalone play-dashboard panel, so it can sit under
 * Vitals in the left column rather than buried in Ready Gear.
 *
 * @remarks
 * Kept functional (not read-only) — credits change constantly in play. Overspend
 * protection and denomination change-making run through the shared
 * {@link useCoinAdjuster}. Hidden for a system with no currency.
 */
export function CurrencyModule({ character, system, updateCharacter, quickButtons = false }: CurrencyModuleProps) {
  const engine = getEngine(system);
  const currency = engine.currency;
  const denominations = currency.denominations;
  const adjust = useCoinAdjuster(currency, character, updateCharacter);

  if (denominations.length === 0) return null;

  return (
    <SectionPanel title={currency.label} collapsible defaultOpen>
      <CurrencyAdjuster denominations={denominations} amounts={currency.read(character)} onDelta={adjust} quickButtons={quickButtons} />
    </SectionPanel>
  );
}
