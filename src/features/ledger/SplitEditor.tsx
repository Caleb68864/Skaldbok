import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import type { useLedgerSplit } from './useLedgerSplit';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';
const pctClass = `${inputClass} max-w-[6rem] text-right`;

/** Props for {@link SplitEditor}. */
export interface SplitEditorProps {
  split: ReturnType<typeof useLedgerSplit>;
}

/**
 * Edits the crew's payout agreement: a ship-fund cut off the top, then one
 * hand-entered percentage per crew member for the remainder.
 *
 * @remarks
 * Percentages are the stored truth, so this editor shows the running total and
 * warns rather than preventing — the crew argues about the numbers at the table
 * and the app should not fight them mid-negotiation. Only a total *over* 100
 * blocks distributing, because that would try to pay out money the pot does not
 * contain; under 100 is a legitimate in-progress state and distributes with a
 * visible unallocated leg.
 */
export function SplitEditor({ split }: SplitEditorProps) {
  const { split: record, validation, payeeOptions, setShipFundPct, setRow, addRow, removeRow, applyEvenSplit } = split;

  if (!record) return null;

  const statusColor =
    validation.status === 'ok'
      ? 'var(--color-text-muted)'
      : validation.status === 'over'
        ? 'var(--color-danger, #b3261e)'
        : 'var(--color-warning, #8a6d00)';

  const statusText =
    validation.status === 'ok'
      ? 'Crew shares total 100%.'
      : validation.status === 'over'
        ? `Crew shares total ${validation.total}% — over 100%. Distributing is blocked until this is fixed.`
        : `Crew shares total ${validation.total}%. The remaining ${100 - validation.total}% will be recorded as unallocated.`;

  return (
    <SectionPanel title="Payout split" subtitle="How income is divided when you distribute">
      <div className="flex flex-col gap-[var(--space-sm)]">
        <label className="flex items-center gap-[var(--space-sm)]">
          <span className="flex-1">Ship fund (off the top, stays in the book)</span>
          <input
            className={pctClass}
            inputMode="decimal"
            value={String(record.shipFundPct)}
            onChange={e => void setShipFundPct(Number(e.target.value) || 0)}
          />
          <span>%</span>
        </label>

        <hr className="border-[var(--color-border)]" />

        {record.rows.length === 0 && (
          <p className="text-[var(--color-text-muted)]">
            No crew shares yet. Add a row for each person who takes a cut.
          </p>
        )}

        {record.rows.map(row => (
          <div key={row.id} className="flex items-center gap-[var(--space-sm)]">
            <input
              className={inputClass}
              value={row.payeeName}
              placeholder="Name"
              list="ledger-payee-options"
              onChange={e => void setRow(row.id, { payeeName: e.target.value })}
              onBlur={e => {
                // Re-link to a party seat when the typed name matches one, so a
                // hand-typed name is not permanently detached from the roster.
                const match = payeeOptions.find(o => o.name === e.target.value.trim());
                if (match && row.payeeMemberId !== match.memberId) {
                  void setRow(row.id, { payeeMemberId: match.memberId });
                }
              }}
            />
            <input
              className={pctClass}
              inputMode="decimal"
              value={String(row.pct)}
              onChange={e => void setRow(row.id, { pct: Number(e.target.value) || 0 })}
            />
            <span>%</span>
            <Button variant="secondary" onClick={() => void removeRow(row.id)} aria-label={`Remove ${row.payeeName || 'row'}`}>
              ✕
            </Button>
          </div>
        ))}

        <datalist id="ledger-payee-options">
          {payeeOptions.map(o => (
            <option key={o.memberId} value={o.name} />
          ))}
        </datalist>

        <p style={{ color: statusColor }}>{statusText}</p>

        <div className="flex gap-[var(--space-sm)] flex-wrap">
          <Button variant="secondary" onClick={() => void addRow()}>
            Add crew share
          </Button>
          <Button
            variant="secondary"
            onClick={() => void applyEvenSplit()}
            disabled={record.rows.length === 0}
          >
            Even split
          </Button>
        </div>
      </div>
    </SectionPanel>
  );
}
