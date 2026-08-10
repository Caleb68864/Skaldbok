import type { CurrencyDenomination } from '../features/systems/engine/types';

/**
 * Greedily decomposes an unsigned amount of base units across denominations,
 * highest value first.
 *
 * @remarks
 * Shared by {@link remakeCurrency} and by each engine's `CurrencyModel.formatAmount`
 * (`classicFantasyEngine`, `travellerEngine`, `savageWorldsEngine`) so the
 * change-making logic lives in exactly one place. Callers pass an already-signless
 * (`Math.abs`'d) amount; sign handling belongs to the caller.
 *
 * @param denominations - Any order; decomposition sorts highest value first.
 * @param baseUnits - Unsigned total, expressed in the smallest denomination's units.
 */
export function decomposeAmount(
  denominations: CurrencyDenomination[],
  baseUnits: number,
): Record<string, number> {
  const byValueDesc = [...denominations].sort((a, b) => b.value - a.value);
  let remainder = baseUnits;
  const result: Record<string, number> = {};
  for (const d of byValueDesc) {
    const count = Math.floor(remainder / d.value);
    result[d.id] = count;
    remainder -= count * d.value;
  }
  return result;
}

/**
 * Adjusts one denomination by `delta` and re-makes change across the whole purse
 * so the totals stay in their most compact form.
 *
 * @remarks
 * Pure and shared so every money control does the change-making identically. For
 * a single denomination of value 1 (Traveller credits) it degenerates to
 * `credits + delta`. Returns `null` when the change would drive the total
 * negative — the caller then leaves the purse untouched (overspend protection).
 *
 * @param denominations - Any order; decomposition sorts highest value first.
 * @param current - Current amounts keyed by denomination id.
 * @param denomId - The denomination the delta is expressed in.
 * @param delta - Signed change, in units of `denomId`.
 */
export function remakeCurrency(
  denominations: CurrencyDenomination[],
  current: Record<string, number>,
  denomId: string,
  delta: number,
): Record<string, number> | null {
  const denom = denominations.find(d => d.id === denomId);
  if (!denom) return null;

  const total = denominations.reduce((sum, d) => sum + (current[d.id] ?? 0) * d.value, 0);
  const nextTotal = total + delta * denom.value;
  // Reject negative (overspend) or non-finite results rather than writing them
  // back: a NaN slips past `< 0` and would otherwise overwrite every
  // denomination with NaN, corrupting the whole purse.
  if (!Number.isFinite(nextTotal) || nextTotal < 0) return null;

  // Greedy change-making requires highest-value-first; decomposeAmount sorts a
  // copy rather than trusting the caller's (or a community system.json's)
  // declaration order — an out-of-order list would otherwise collapse the
  // total into the wrong coin.
  return decomposeAmount(denominations, nextTotal);
}

/**
 * Builds a `CurrencyModel.formatAmount` over an arbitrary denomination list.
 *
 * @remarks
 * Each adapter used to close over its own hardcoded array, which meant a
 * `currency.denominations` declared in system.json changed the inputs and the
 * purse panel but *not* the formatted totals — the ledger would keep decomposing
 * over the adapter's coins. Formatting has to be derived from the same list
 * everything else reads, so it lives here and `getEngine` rebuilds it whenever a
 * ruleset declares its own.
 *
 * A single denomination renders as a prefix and a grouped number. Whether a
 * space separates them follows the abbreviation: a word takes one (`Cr 15,000`),
 * a symbol does not (`$1,000`). That is ordinary typographic practice, and it is
 * also exactly what the Traveller and Savage Worlds adapters each hand-wrote —
 * so deriving the rule reproduces both rather than making one of them wrong.
 *
 * Several denominations render most significant first, omitting the ones that
 * came out zero (`1g 2s 3c`), except that a zero total still prints one unit
 * rather than an empty string.
 */
export function makeFormatAmount(
  denominations: CurrencyDenomination[],
): (baseUnits: number) => string {
  const byValueDesc = [...denominations].sort((a, b) => b.value - a.value);
  return (baseUnits: number) => {
    const sign = baseUnits < 0 ? '-' : '';
    const magnitude = Math.abs(baseUnits);
    if (byValueDesc.length === 1) {
      const { abbr } = byValueDesc[0];
      const separator = /[a-z]/i.test(abbr) ? ' ' : '';
      return `${sign}${abbr}${separator}${magnitude.toLocaleString('en-US')}`;
    }
    const smallest = byValueDesc[byValueDesc.length - 1];
    if (magnitude === 0) return `0${smallest.abbr}`;
    const parts = decomposeAmount(denominations, magnitude);
    const rendered = byValueDesc
      .filter(d => (parts[d.id] ?? 0) > 0)
      .map(d => `${parts[d.id]}${d.abbr}`)
      .join(' ');
    return `${sign}${rendered}`;
  };
}
