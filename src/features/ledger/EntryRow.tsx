import { Fragment, useState } from 'react';
import { Button } from '../../components/primitives/Button';
import { AmountFields, AmountPreview } from './AmountFields';
import { useAmountEntry } from './useAmountEntry';
import type { EntryWithBalance } from '../../utils/ledgerMath';
import type { LedgerAccount } from '../../types/ledgerAccount';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/** What an edit hands back. Mirrors the add form, so both take the same path. */
export interface EntryEdit {
  date: string;
  memo: string;
  amount: number;
  direction: 'in' | 'out';
  accountId?: string;
  counterAccountId?: string;
}

/** Props for {@link EntryRow}. */
export interface EntryRowProps {
  row: EntryWithBalance;
  accounts: LedgerAccount[];
  formatMoney: (baseUnits: number) => string;
  /** Base denomination abbreviation, for the amount placeholder. */
  abbr: string;
  /** What this ruleset calls the pot kept off the top of a payout. */
  reservePotLabel: string;
  onSave: (id: string, edit: EntryEdit) => Promise<void>;
  onRemove: (id: string) => void;
}

/** True for an entry the Distribute action wrote — it carries a pre-split total. */
function isDistribution(row: EntryWithBalance): boolean {
  return row.gross !== undefined;
}

/**
 * One line of the cashbook: its own row, a row per distribution leg, and an
 * inline editor.
 *
 * @remarks
 * Entries are written at the table in a hurry, so they are wrong about as often
 * as they are right — a date left on yesterday, a memo typed in the dark, a
 * fuel bill filed against the wrong account. Until this existed the only
 * correction available was delete-and-retype, which loses the row's place in
 * the book and writes a removal into the session log for what was a typo.
 */
export function EntryRow({
  row,
  accounts,
  formatMoney,
  abbr,
  reservePotLabel,
  onSave,
  onRemove,
}: EntryRowProps) {
  const [editing, setEditing] = useState(false);
  const isIn = row.amount >= 0;

  if (editing) {
    return (
      // Keyed on the row so a re-read while the form is open reloads its
      // fields rather than leaving the draft attached to stale figures.
      <EntryEditor
        key={row.id + row.updatedAt}
        row={row}
        accounts={accounts}
        formatMoney={formatMoney}
        abbr={abbr}
        onCancel={() => setEditing(false)}
        onSave={async edit => {
          await onSave(row.id, edit);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Fragment>
      <tr className="border-t border-[var(--color-border)]">
        <td className="py-2 pr-2 whitespace-nowrap">{row.date}</td>
        <td className="py-2 pr-2">{row.memo || '—'}</td>
        <td className="py-2 pr-2 text-right whitespace-nowrap">
          {isIn ? formatMoney(row.amount) : ''}
        </td>
        <td className="py-2 pr-2 text-right whitespace-nowrap">
          {isIn ? '' : formatMoney(Math.abs(row.amount))}
        </td>
        <td className="py-2 pr-2 text-right whitespace-nowrap">{formatMoney(row.balance)}</td>
        <td className="py-2 text-right whitespace-nowrap">
          <button
            className="min-h-[44px] min-w-[44px] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
            aria-label={`Edit entry ${row.memo || row.date}`}
            onClick={() => setEditing(true)}
          >
            ✎
          </button>
          <button
            className="min-h-[44px] min-w-[44px] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
            aria-label={`Delete entry ${row.memo || row.date}`}
            onClick={() => onRemove(row.id)}
          >
            ✕
          </button>
        </td>
      </tr>
      {(row.legs ?? []).map((leg, i) => (
        <tr key={`${row.id}-leg-${i}`} className="text-sm text-[var(--color-text-muted)]">
          <td />
          <td className="py-1 pr-2 pl-4">
            ⤷{' '}
            {leg.kind === 'shipFund'
              ? reservePotLabel
              : leg.kind === 'unallocated'
                ? 'Unallocated'
                : leg.payeeName || 'Unnamed'}
            {leg.pct !== undefined && ` (${leg.pct}%)`}
            {leg.kind === 'shipFund' && ' — retained'}
          </td>
          <td />
          <td className="py-1 pr-2 text-right whitespace-nowrap">{formatMoney(leg.amount)}</td>
          <td />
          <td />
        </tr>
      ))}
    </Fragment>
  );
}

/**
 * The inline edit form, filling the width of the table.
 *
 * @remarks
 * One full-width cell rather than an input per column: six columns sized for
 * numbers cannot also hold six controls at a 44px touch target, and this is
 * read on a tablet.
 *
 * A distribution's amount is deliberately missing. Its legs and its frozen
 * split were computed from that figure, so editing it here would leave an entry
 * whose shares no longer add up to it — correcting a payout means deleting it
 * and distributing again, which is the honest record anyway. Date, description
 * and accounts stay editable, because those are the parts that go wrong.
 */
function EntryEditor({
  row,
  accounts,
  formatMoney,
  abbr,
  onSave,
  onCancel,
}: {
  row: EntryWithBalance;
  accounts: LedgerAccount[];
  formatMoney: (baseUnits: number) => string;
  abbr: string;
  onSave: (edit: EntryEdit) => Promise<void>;
  onCancel: () => void;
}) {
  const locked = isDistribution(row);
  const amount = useAmountEntry(row.amount);
  const [date, setDate] = useState(row.date);
  const [memo, setMemo] = useState(row.memo);
  const [direction, setDirection] = useState<'in' | 'out'>(row.amount < 0 ? 'out' : 'in');
  const [accountId, setAccountId] = useState(row.accountId ?? '');
  const [counterAccountId, setCounterAccountId] = useState(row.counterAccountId ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = !saving && (locked || amount.isUsable);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        date,
        // The working goes into the description, the same as on the add form:
        // it is the only place the book can carry "six berths at 1,400".
        memo: amount.workings === '' ? memo : `${memo} (${amount.workings})`.trim(),
        amount: locked ? row.amount : amount.total,
        direction,
        accountId: accountId || undefined,
        counterAccountId: counterAccountId || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]">
      <td colSpan={6} className="py-[var(--space-sm)]">
        <div className="flex flex-col gap-[var(--space-sm)]">
          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <input
              className={`${inputClass} max-w-[10rem]`}
              type="date"
              value={date}
              aria-label="Entry date"
              onChange={e => setDate(e.target.value)}
            />
            <input
              className={`${inputClass} flex-1 min-w-[10rem]`}
              value={memo}
              placeholder="What was it?"
              aria-label="Description"
              onChange={e => setMemo(e.target.value)}
            />
          </div>

          {locked ? (
            <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              {formatMoney(Math.abs(row.amount))} — a payout's amount cannot be edited, because
              its shares were worked out from it. Delete it and distribute again to change the
              figure.
            </p>
          ) : (
            <div className="flex gap-[var(--space-sm)] flex-wrap items-center">
              <AmountFields
                entry={amount}
                abbr={abbr}
                formatMoney={formatMoney}
                onSubmit={() => void save()}
              />
              <select
                className={`${inputClass} max-w-[8rem]`}
                value={direction}
                aria-label="Direction"
                onChange={e => setDirection(e.target.value as 'in' | 'out')}
              >
                <option value="in">Money in</option>
                <option value="out">Money out</option>
              </select>
            </div>
          )}
          {!locked && <AmountPreview entry={amount} abbr={abbr} formatMoney={formatMoney} />}

          {accounts.length > 1 && (
            <div className="flex gap-[var(--space-sm)] flex-wrap items-center">
              <label className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                From
                <select
                  className={`${inputClass} max-w-[11rem]`}
                  value={accountId}
                  aria-label="Account"
                  onChange={e => setAccountId(e.target.value)}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.isPrimary ? '' : a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                To
                <select
                  className={`${inputClass} max-w-[11rem]`}
                  value={counterAccountId}
                  aria-label="Transfer to account"
                  onChange={e => setCounterAccountId(e.target.value)}
                >
                  <option value="">None — income or expense</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <Button onClick={() => void save()} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
