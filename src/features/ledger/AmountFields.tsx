import { cn } from '../../lib/utils';
import type { AmountEntry } from './useAmountEntry';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/** Props for {@link AmountFields} and {@link AmountPreview}. */
export interface AmountFieldsProps {
  entry: AmountEntry;
  /** The base denomination's abbreviation, for the placeholder. May be empty. */
  abbr: string;
  formatMoney: (baseUnits: number) => string;
  /** Fired by Enter in either field — the form's primary action. */
  onSubmit?: () => void;
}

/**
 * The amount controls: a quantity toggle, the quantity when it is on, and the
 * figure itself.
 *
 * @remarks
 * Renders a fragment rather than its own row, so the caller keeps control of
 * the layout its buttons sit in. Pair it with {@link AmountPreview}.
 */
export function AmountFields({ entry, abbr, onSubmit }: AmountFieldsProps) {
  const submitOnEnter = (key: string) => {
    if (key === 'Enter') onSubmit?.();
  };

  return (
    <>
      <button
        type="button"
        aria-pressed={entry.byUnit}
        // The title says what it does; the label is two characters because this
        // sits in a row of touch targets on a tablet and a word would push the
        // amount field onto its own line.
        title="Work the amount out as quantity × price"
        onClick={() => entry.setByUnit(!entry.byUnit)}
        className={cn(
          'shrink-0 min-h-[44px] min-w-[44px] px-2 rounded-[var(--radius-sm)] border cursor-pointer',
          entry.byUnit
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] font-semibold'
            : 'border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)]',
        )}
      >
        ×n
      </button>
      {entry.byUnit && (
        <>
          <input
            className={`${inputClass} max-w-[6rem]`}
            inputMode="decimal"
            value={entry.qtyText}
            placeholder="Qty"
            aria-label="Quantity"
            onChange={e => entry.setQtyText(e.target.value)}
            onKeyDown={e => submitOnEnter(e.key)}
          />
          <span aria-hidden="true" className="text-[var(--color-text-muted)]">
            ×
          </span>
        </>
      )}
      <input
        className={`${inputClass} max-w-[10rem]`}
        inputMode="numeric"
        value={entry.amountText}
        placeholder={
          entry.byUnit
            ? abbr
              ? `Price each (${abbr})`
              : 'Price each'
            : abbr
              ? `Amount (${abbr})`
              : 'Amount'
        }
        aria-label={entry.byUnit ? 'Price each' : 'Amount'}
        onChange={e => entry.setAmountText(e.target.value)}
        onKeyDown={e => submitOnEnter(e.key)}
      />
    </>
  );
}

/**
 * The line showing what the quantity fields work out to.
 *
 * @remarks
 * Renders nothing unless the quantity toggle is on and the figures are usable,
 * so the plain case gains no chrome. It states the result *and* that the
 * working goes into the description, because that is a write the user did not
 * type and should not discover later.
 */
export function AmountPreview({ entry, formatMoney }: AmountFieldsProps) {
  if (entry.workings === '') return null;
  return (
    <p role="status" className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
      {entry.workings} = <strong className="text-[var(--color-text)]">{formatMoney(entry.total)}</strong>
      <span> · noted in the description</span>
    </p>
  );
}
