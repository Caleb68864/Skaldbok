import { useState } from 'react';
import type { CurrencyDenomination } from '../../features/systems/engine/types';

/**
 * Quick-adjust amounts used when a denomination declares none of its own.
 * Coin-scale by default; systems override via `CurrencyDenomination.quickSteps`.
 */
const DEFAULT_QUICK_STEPS = [5, 10];

export interface CurrencyAdjusterProps {
  denominations: CurrencyDenomination[];
  /** Current amounts keyed by denomination id, as read from the engine. */
  amounts: Record<string, number>;
  /**
   * Applies a signed change to one denomination. The parent owns the actual
   * mutation (change-making across denominations, clamping to non-negative), so
   * this control stays a pure input surface.
   */
  onDelta: (denomId: string, delta: number) => void;
  /**
   * Whether to render the fixed quick-step buttons. Defaults to `true`. The Play
   * dashboard passes `false` to keep the purse compact — just the custom-amount
   * field with ± — while Ready Gear keeps the quick buttons.
   */
  quickButtons?: boolean;
}

/**
 * Money control with fixed quick buttons (−10, −5, +5, +10) and a custom-amount
 * field per denomination.
 *
 * @remarks
 * A single ± stepper is unworkable across systems — Traveller credits run to the
 * thousands, coins to single units. The quick buttons cover small change; the
 * custom field covers arbitrary amounts (type 800, hit − to spend it). All
 * changes route through {@link CurrencyAdjusterProps.onDelta}, so overspend
 * protection and denomination change-making live in one place in the parent.
 * Set {@link CurrencyAdjusterProps.quickButtons} to `false` to drop the quick
 * buttons and show only the custom field.
 */
export function CurrencyAdjuster({ denominations, amounts, onDelta, quickButtons = true }: CurrencyAdjusterProps) {
  return (
    <div className="flex flex-col gap-[var(--space-md)]">
      {denominations.map(denom => (
        <DenomRow key={denom.id} denom={denom} value={amounts[denom.id] ?? 0} onDelta={onDelta} quickButtons={quickButtons} />
      ))}
    </div>
  );
}

const quickBtnClass =
  'min-h-[44px] min-w-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] ' +
  'bg-[var(--color-surface-alt)] text-[var(--color-text)] text-sm font-semibold cursor-pointer ' +
  'hover:brightness-110 disabled:opacity-50 disabled:pointer-events-none';

function DenomRow({
  denom,
  value,
  onDelta,
  quickButtons,
}: {
  denom: CurrencyDenomination;
  value: number;
  onDelta: (denomId: string, delta: number) => void;
  quickButtons: boolean;
}) {
  const [custom, setCustom] = useState('');
  const unit = denom.label.toLowerCase();
  // Quick amounts are a ruleset setting; ascending so −desc / +asc reads outward
  // from the value (…−1000 −100 · +100 +1000…).
  const quickSteps = [...(denom.quickSteps ?? DEFAULT_QUICK_STEPS)].sort((a, b) => a - b);

  /** Applies the typed amount; sign +1 gains, −1 spends. Ignores empty/≤0. */
  function applyCustom(sign: 1 | -1) {
    const n = Math.floor(Number(custom));
    if (!Number.isFinite(n) || n <= 0) return;
    onDelta(denom.id, sign * n);
    setCustom('');
  }

  return (
    <div className="flex flex-col gap-[var(--space-xs)]">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-muted)]">{denom.label}</span>
        <span className="text-lg font-bold text-[var(--color-text)]">{value}</span>
      </div>
      <div className="flex flex-wrap items-center gap-[var(--space-xs)]">
        {quickButtons && [...quickSteps].reverse().map(step => (
          <button
            key={`minus-${step}`}
            type="button"
            className={quickBtnClass}
            aria-label={`Spend ${step} ${unit}`}
            onClick={() => onDelta(denom.id, -step)}
          >
            −{step}
          </button>
        ))}
        {quickButtons && quickSteps.map(step => (
          <button
            key={`plus-${step}`}
            type="button"
            className={quickBtnClass}
            aria-label={`Gain ${step} ${unit}`}
            onClick={() => onDelta(denom.id, step)}
          >
            +{step}
          </button>
        ))}
        {quickButtons && <span className="mx-1 h-6 w-px bg-[var(--color-border)]" aria-hidden="true" />}
        <input
          type="number"
          min={1}
          inputMode="numeric"
          placeholder="Amt"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') applyCustom(1);
          }}
          aria-label={`Custom ${unit} amount`}
          className="w-20 min-h-[44px] px-2 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)]"
        />
        <button
          type="button"
          className={quickBtnClass}
          aria-label={`Spend custom ${unit}`}
          disabled={custom.trim() === ''}
          onClick={() => applyCustom(-1)}
        >
          −
        </button>
        <button
          type="button"
          className={quickBtnClass}
          aria-label={`Gain custom ${unit}`}
          disabled={custom.trim() === ''}
          onClick={() => applyCustom(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
