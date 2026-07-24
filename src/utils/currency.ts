import type { CurrencyDenomination } from '../features/systems/engine/types';

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
 * @param denominations - Ordered highest value first (greedy decomposition).
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
  if (nextTotal < 0) return null;

  let remainder = nextTotal;
  const next: Record<string, number> = {};
  for (const d of denominations) {
    const count = Math.floor(remainder / d.value);
    next[d.id] = count;
    remainder -= count * d.value;
  }
  return next;
}
