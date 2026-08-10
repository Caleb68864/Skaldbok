import { useMemo, useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { useToast } from '../../context/ToastContext';
import { computeDistribution } from '../../utils/ledgerMath';
import type { DistributionResult } from '../../utils/ledgerMath';
import type { SplitSnapshot } from '../../types/ledger';
import type { SplitValidation } from '../../utils/ledgerMath';
import { useOverlayDismiss } from '../../components/primitives/useOverlayDismiss';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/** Props for {@link DistributeModal}. */
export interface DistributeModalProps {
  snapshot: SplitSnapshot;
  validation: SplitValidation;
  balance: number;
  formatMoney: (baseUnits: number) => string;
  denominationAbbr: string;
  onCancel: () => void;
  onConfirm: (input: {
    date: string;
    memo: string;
    gross: number;
    net: number;
    legs: DistributionResult['legs'];
    splitSnapshot: SplitSnapshot;
    /**
     * Record the money coming in as well, immediately before the payout.
     *
     * @remarks
     * Distributing only ever writes the *outflow*. If the payment itself was
     * never entered, the book goes negative for no visible reason — which is the
     * mistake this option removes, because "we got paid, split it now" is a
     * single act at the table, not two.
     */
    alsoRecordIncome: boolean;
  }) => Promise<void>;
}

/**
 * Takes an amount, previews the split it produces, and writes it as one ledger
 * entry carrying a frozen copy of the percentages used.
 *
 * @remarks
 * The preview is the point: the crew sees exactly who gets what *before*
 * anything is written, which is when disagreements are cheap to resolve.
 *
 * `computeDistribution` throws on an invariant breach rather than returning a
 * plausible wrong answer. That throw is caught here and shown as a message —
 * an unhandled throw in a React event handler blanks the screen, and doing that
 * mid-session over a rounding bug would be far worse than refusing the action.
 */
export function DistributeModal({
  snapshot,
  validation,
  balance,
  formatMoney,
  denominationAbbr,
  onCancel,
  onConfirm,
}: DistributeModalProps) {
  // Escape, a focus trap and focus restore — this is a hand-rolled
  // dialog, so none of it comes for free. See useOverlayDismiss.
  const dialogRef = useOverlayDismiss<HTMLDivElement>(onCancel);
  const { showToast } = useToast();
  const [alsoRecordIncome, setAlsoRecordIncome] = useState(false);
  const [grossText, setGrossText] = useState('');
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const gross = Math.trunc(Number(grossText));
  const grossIsUsable = grossText.trim() !== '' && Number.isFinite(gross) && gross > 0;

  const { preview, previewError } = useMemo(() => {
    if (!grossIsUsable || validation.status === 'over') {
      return { preview: null, previewError: null };
    }
    try {
      return { preview: computeDistribution(gross, snapshot), previewError: null };
    } catch (err) {
      return { preview: null, previewError: err instanceof Error ? err.message : String(err) };
    }
  }, [gross, grossIsUsable, snapshot, validation.status]);

  const blockedReason =
    validation.status === 'over'
      ? `The crew shares total ${validation.total}%. Fix the split before distributing.`
      : !grossIsUsable
        ? 'Enter an amount to distribute.'
        : previewError;

  async function handleConfirm() {
    setIsSaving(true);
    setError(null);
    try {
      // Recomputed rather than trusting the memoised preview: this is the write
      // path, and the invariants must hold against the values actually being
      // committed. If they do not, `computeDistribution` throws.
      const result = computeDistribution(gross, snapshot);
      await onConfirm({
        date,
        memo: memo.trim() || 'Payout',
        gross,
        net: result.net,
        legs: result.legs,
        // Frozen here, not referenced: editing the split afterwards must not
        // reach into an entry that has already been written.
        splitSnapshot: structuredClone(snapshot),
        alsoRecordIncome,
      });
    } catch (err) {
      // A toast, not just inline text. An invariant breach surfaces mid-session
      // at the table, and an unhandled throw in a React event handler blanks the
      // screen — refusing the action loudly is the only acceptable failure here.
      // Nothing is written: `computeDistribution` throws before `onConfirm`.
      const message = err instanceof Error ? err.message : 'Could not record the payout.';
      showToast(message, 'error');
      setError(message);
    } finally {
      // `finally`, not just the catch. On success the parent unmounts this
      // modal, so leaving the flag set happened to look fine — but that is the
      // caller's behaviour, not this component's contract. A caller that keeps
      // it mounted (a "record another" flow, say) would find every button
      // disabled for good.
      setIsSaving(false);
    }
  }

  const retained = preview?.legs.find(l => l.kind === 'shipFund')?.amount ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-[var(--space-md)]"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Distribute"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
        <h2 className="text-lg font-semibold">Distribute</h2>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--color-text-muted)]">Date</span>
          <input className={inputClass} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--color-text-muted)]">What was it for?</span>
          <input
            className={inputClass}
            value={memo}
            placeholder="Payout"
            onChange={e => setMemo(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--color-text-muted)]">
            Amount to divide ({denominationAbbr})
          </span>
          <input
            className={inputClass}
            inputMode="numeric"
            value={grossText}
            onChange={e => setGrossText(e.target.value)}
            autoFocus
          />
        </label>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={alsoRecordIncome}
            onChange={e => setAlsoRecordIncome(e.target.checked)}
          />
          <span className="text-sm">
            Record the payment coming in as well
            <span className="block text-[var(--color-text-muted)]">
              Tick this if the job's fee is not already in the book. Distributing
              only records money going <em>out</em>.
            </span>
          </span>
        </label>

        {preview && (
          <div className="border border-[var(--color-border)] rounded-[var(--radius-sm)] p-[var(--space-sm)] flex flex-col gap-1">
            {preview.legs.map((leg, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span>
                  {leg.kind === 'shipFund'
                    ? 'Ship fund'
                    : leg.kind === 'unallocated'
                      ? 'Unallocated'
                      : leg.payeeName || 'Unnamed'}
                  {leg.pct !== undefined && (
                    <span className="text-[var(--color-text-muted)]"> ({leg.pct}%)</span>
                  )}
                  {leg.kind === 'shipFund' && (
                    <span className="text-[var(--color-text-muted)]"> — stays in the book</span>
                  )}
                </span>
                <span>{formatMoney(leg.amount)}</span>
              </div>
            ))}
            <hr className="border-[var(--color-border)] my-1" />
            <div className="flex justify-between gap-2 font-semibold">
              <span>Leaves the book</span>
              <span>{formatMoney(preview.net)}</span>
            </div>
            <div className="flex justify-between gap-2 text-[var(--color-text-muted)]">
              <span>Balance after</span>
              <span>{formatMoney(balance + (alsoRecordIncome ? gross : 0) + preview.net)}</span>
            </div>
            {retained > 0 && (
              <p className="text-[var(--color-text-muted)] text-sm">
                {formatMoney(retained)} stays in the crew's account for the ship.
              </p>
            )}
            {balance + (alsoRecordIncome ? gross : 0) + preview.net < 0 && (
              <p className="text-sm" style={{ color: 'var(--color-warning, #8a6d00)' }}>
                {alsoRecordIncome
                  ? 'This takes the book into the red.'
                  : 'This takes the book into the red — was the fee recorded as Money in? Tick the box above if not.'}
              </p>
            )}
          </div>
        )}

        {blockedReason && <p className="text-[var(--color-text-muted)]">{blockedReason}</p>}
        {error && <p style={{ color: 'var(--color-danger, #b3261e)' }}>{error}</p>}

        <div className="flex gap-[var(--space-sm)] justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!preview || isSaving}>
            {isSaving ? 'Recording…' : 'Record payout'}
          </Button>
        </div>
      </div>
    </div>
  );
}
