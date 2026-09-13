import { useCallback, useMemo, useState } from 'react';
import { computeLineTotal } from '../../utils/ledgerMath';

/** A number the way a person reads it: grouped, and without a trailing `.0`. */
function readable(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** The state and arithmetic behind one amount field. See {@link useAmountEntry}. */
export interface AmountEntry {
  /** The lump sum, or the price of one when {@link byUnit} is on. */
  amountText: string;
  setAmountText: (text: string) => void;
  qtyText: string;
  setQtyText: (text: string) => void;
  /** Whether the field is being read as quantity × price rather than a total. */
  byUnit: boolean;
  setByUnit: (on: boolean) => void;
  /** Whole base units. Zero whenever there is nothing usable to record. */
  total: number;
  isUsable: boolean;
  /**
   * How the total was arrived at — `"6 × 1,400"` — or `''` for a plain sum.
   *
   * @remarks
   * Worth keeping because a ledger is read months later: `Cr 8,400` answers
   * "how much" and nothing else, and "was that six berths or seven?" is the
   * question actually asked of an old entry.
   */
  workings: string;
  /** Clears the figures, leaving the quantity toggle as the user set it. */
  reset: () => void;
}

/**
 * An amount field that can be typed as a total or worked out as quantity ×
 * price.
 *
 * @remarks
 * Six passengers at Cr1,400 a berth, or 2.5 tons of cargo at Cr800 — a table
 * hits this constantly, and the arithmetic was being done on paper and entered
 * as a total.
 *
 * The quantity is a **separate field behind a toggle**, not an expression
 * parsed out of the amount box. Two reasons, and the second is the deciding
 * one: the amount input is `inputMode="numeric"`, so a tablet — which is how
 * this app is used at the table — offers a keypad with no `×` or `*` on it at
 * all. An expression syntax would work on the developer's laptop and be
 * untypeable on the device it was written for. The toggle also keeps the
 * common case exactly as it was: one box, one number, nothing new on screen.
 *
 * The stored value is always the product. Nothing about "6 × 1,400" is
 * persisted as structure — {@link AmountEntry.workings} goes into the memo as
 * text, which is what a reader of the book wants and what an export already
 * carries.
 *
 * @param initial - Starting figure in base units, for editing an entry that
 * already exists. Absent means an empty field.
 */
export function useAmountEntry(initial?: number): AmountEntry {
  const [amountText, setAmountText] = useState(
    initial === undefined || initial === 0 ? '' : String(Math.abs(initial)),
  );
  const [qtyText, setQtyText] = useState('');
  const [byUnit, setByUnit] = useState(false);

  const quantity = Number(qtyText);
  const unit = Number(amountText);

  const total = useMemo(() => {
    if (amountText.trim() === '') return 0;
    if (!byUnit) {
      const sum = Math.trunc(unit);
      return Number.isFinite(sum) ? sum : 0;
    }
    if (qtyText.trim() === '') return 0;
    return computeLineTotal(quantity, unit);
  }, [amountText, byUnit, qtyText, quantity, unit]);

  const workings = useMemo(() => {
    if (!byUnit || total === 0) return '';
    if (!Number.isFinite(quantity) || !Number.isFinite(unit)) return '';
    return `${readable(quantity)} × ${readable(unit)}`;
  }, [byUnit, total, quantity, unit]);

  const reset = useCallback(() => {
    setAmountText('');
    setQtyText('');
  }, []);

  return {
    amountText,
    setAmountText,
    qtyText,
    setQtyText,
    byUnit,
    setByUnit,
    total,
    isUsable: total !== 0,
    workings,
    reset,
  };
}
