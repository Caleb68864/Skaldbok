import { nowISO } from '../../utils/dates';
import { remakeCurrency } from '../../utils/currency';
import { useSessionLog } from '../session/useSessionLog';
import { useToast } from '../../context/ToastContext';
import type { CharacterRecord } from '../../types/character';
import type { CurrencyModel } from '../systems/engine/types';
import type { PlayModuleProps } from './types';

/**
 * The one coin-adjust handler, shared by the standalone {@link CurrencyModule}
 * and the Ready Gear purse in {@link CombatModule}.
 *
 * @remarks
 * Re-makes change across the whole purse via {@link remakeCurrency}, blocks an
 * overdraw with a toast, and logs the change. The change is resolved *outside*
 * `updateCharacter` on purpose: React may batch the updater, so a value read
 * back from inside it isn't observable synchronously — that previously dropped
 * log entries. `null` from `remakeCurrency` means the spend would overdraw.
 */
export function useCoinAdjuster(
  currency: CurrencyModel,
  character: CharacterRecord,
  updateCharacter: PlayModuleProps['updateCharacter'],
): (denominationId: string, delta: number) => void {
  const { logCoinChange } = useSessionLog();
  const { showToast } = useToast();

  return (denominationId: string, delta: number) => {
    const denom = currency.denominations.find(d => d.id === denominationId);
    if (!denom) return;
    const next = remakeCurrency(currency.denominations, currency.read(character), denominationId, delta);
    if (!next) {
      showToast(`Not enough ${currency.label.toLowerCase()} to spend that.`, 'error');
      return;
    }
    updateCharacter(prev => ({ ...currency.write(prev, next), updatedAt: nowISO() }));
    logCoinChange(character.name, denominationId, delta, denom.abbr);
  };
}
