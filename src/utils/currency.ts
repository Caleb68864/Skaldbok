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

  // Greedy change-making requires highest-value-first; sort a copy rather than
  // trusting the caller's (or a community system.json's) declaration order — an
  // out-of-order list would otherwise collapse the total into the wrong coin.
  const byValueDesc = [...denominations].sort((a, b) => b.value - a.value);
  let remainder = nextTotal;
  const next: Record<string, number> = {};
  for (const d of byValueDesc) {
    const count = Math.floor(remainder / d.value);
    next[d.id] = count;
    remainder -= count * d.value;
  }
  return next;
}
