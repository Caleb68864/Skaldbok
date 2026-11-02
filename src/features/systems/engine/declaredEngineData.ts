import type { SystemDefinition } from '../../../types/system';
import { makeFormatAmount } from '../../../utils/currency';
import type { CurrencyModel, SystemEngine } from './types';

/** The parts of an engine that are pure data and live in `system.json` (roadmap E1). */
export type DeclaredEngineData = Pick<
  SystemEngine,
  'terms' | 'labels' | 'logActions' | 'outcomes' | 'rollModifiers' | 'timeUnits' | 'panels' | 'currency'
>;

/**
 * Money, built entirely from what a system declares (roadmap E2).
 *
 * @remarks
 * `read` and `write` follow the denominations rather than coming from an
 * adapter. All three adapters wrote the same two functions, each spelling its own
 * coin ids, so a system declaring different denominations kept the adapter's
 * `read`: the purse offered the new coins and every one of them read as absent.
 */
export function currencyFromDenominations(
  label: string,
  baseDenominationId: string,
  denominations: CurrencyModel['denominations'],
): CurrencyModel {
  return {
    mode: denominations.length > 1 ? 'coins' : 'single',
    label,
    denominations,
    baseDenominationId,
    formatAmount: makeFormatAmount(denominations),
    read: character =>
      Object.fromEntries(denominations.map(d => [d.id, character.wealth?.[d.id] ?? 0])),
    write: (character, amounts) => ({ wealth: { ...character.wealth, ...amounts } }),
  };
}

/**
 * Reads a bundled system's declared data for its adapter to spread.
 *
 * @remarks
 * `system.json` is the one home for this data, so an adapter holds functions
 * only. The optional fields are optional for user-authored systems, which fall
 * back to their base adapter; a *bundled* system has no such fallback, so a
 * missing one throws at module load instead of leaving a hole in the engine.
 */
export function declaredEngineData(system: SystemDefinition): DeclaredEngineData {
  const { terms, labels, logActions, outcomes, rollModifiers, timeUnits, panels, currency } = system;
  if (
    !terms || !labels || !logActions || !outcomes || !rollModifiers || !timeUnits || !panels ||
    !currency?.label || !currency.baseDenominationId || !currency.denominations
  ) {
    throw new Error(`Bundled system "${system.id}" does not declare all of its engine data in system.json`);
  }
  return {
    terms: terms as SystemEngine['terms'],
    labels: labels as SystemEngine['labels'],
    logActions,
    outcomes,
    rollModifiers,
    timeUnits,
    panels,
    currency: currencyFromDenominations(currency.label, currency.baseDenominationId, currency.denominations),
  };
}
