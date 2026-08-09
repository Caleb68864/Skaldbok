import { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  openDebts, netDebt, totalByDirection, outstanding, paidSoFar, type Debt,
} from '../../features/characters/debts';

export interface DebtListProps {
  debts: Debt[];
  /** Currency abbreviation from the engine, e.g. "Cr". */
  abbr: string;
  editable: boolean;
  onAdd: (debt: Omit<Debt, 'id' | 'createdAt'>) => void;
  onSettle: (id: string) => void;
  /** Records a part-payment. The debt settles itself when the balance clears. */
  onPay: (id: string, amount: number) => void;
  onReopen: (id: string) => void;
  onRemove: (id: string) => void;
}

const EMPTY = { counterparty: '', amount: '', direction: 'owed' as Debt['direction'], note: '' };

/**
 * Itemised debts — who, how much, and what for.
 *
 * @remarks
 * Distinct from the Book's single `Debt (Cr)` finance line, which is a total
 * (a ship mortgage) and cannot answer "who do I owe, and for what". A crewmate
 * fronting you 10,000 for a vacc suit is the case this exists for: nobody
 * writes it down, everybody half-remembers it, and it surfaces three sessions
 * later as an argument.
 *
 * Settled debts stay visible behind a toggle rather than vanishing — the
 * question asked months later is "did I ever pay that back?", and a deleted row
 * answers it with silence.
 */
export function DebtList({ debts, abbr, editable, onAdd, onSettle, onPay, onReopen, onRemove }: DebtListProps) {
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  /** Which debt has its part-payment field open, and what has been typed. */
  const [paying, setPaying] = useState<{ id: string; amount: string } | null>(null);

  const open = openDebts(debts);
  const settled = debts.filter(d => d.settledAt);
  const net = netDebt(debts);
  const fmt = (n: number) => `${n.toLocaleString()} ${abbr}`;

  /** Records the typed part-payment and closes the field. */
  function commitPayment(debt: Debt) {
    const value = Number(paying?.amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onPay(debt.id, value);
    setPaying(null);
  }

  const amount = Number(draft?.amount ?? 0);
  const canAdd = !!draft && draft.counterparty.trim() !== '' && Number.isFinite(amount) && amount > 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-[var(--space-xs)]">
        <h4 className="m-0 text-[length:var(--font-size-sm)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          Debts &amp; IOUs
        </h4>
        {open.length > 0 && (
          <span className={cn('text-[length:var(--font-size-sm)] font-semibold tabular-nums',
            net > 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]')}>
            {net > 0 ? `Net owed ${fmt(net)}` : net < 0 ? `Net due ${fmt(-net)}` : 'Square'}
          </span>
        )}
      </div>

      {open.length === 0 && <p className="m-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] italic">No open debts.</p>}

      {open.map(debt => (
        <div key={debt.id} className="flex flex-wrap items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-border)] min-h-[var(--touch-target-min)]">
          <span className={cn('shrink-0 px-[var(--space-xs)] text-xs font-semibold rounded-[var(--radius-sm)]',
            debt.direction === 'owed'
              ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
              : 'bg-[var(--color-success)]/15 text-[var(--color-success)]')}>
            {debt.direction === 'owed' ? 'I owe' : 'Owed me'}
          </span>
          <span className="flex-1 min-w-0 text-[var(--color-text)]">
            {debt.counterparty}
            {debt.note && <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]"> — {debt.note}</span>}
          </span>
          <span className="shrink-0 tabular-nums font-semibold text-[var(--color-text)]">
            {fmt(outstanding(debt))}
            {paidSoFar(debt) > 0 && (
              /* Both numbers, always: "you said 10,000 and you've given me 4"
                 needs the original as much as the balance. */
              <span className="block text-[length:var(--font-size-sm)] font-normal text-[var(--color-text-muted)]">
                {fmt(paidSoFar(debt))} paid of {fmt(debt.amount)}
              </span>
            )}
          </span>
          {editable && (
            <>
              <button type="button"
                onClick={() => setPaying(p => (p?.id === debt.id ? null : { id: debt.id, amount: '' }))}
                aria-expanded={paying?.id === debt.id}
                className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer">
                Pay
              </button>
              <button type="button" onClick={() => onSettle(debt.id)}
                className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer">
                Settle
              </button>
              <button type="button" onClick={() => onRemove(debt.id)} aria-label={`Delete debt with ${debt.counterparty}`}
                className="shrink-0 min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] rounded border-none bg-transparent text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-danger)]">
                ✕
              </button>
            </>
          )}
          {editable && paying?.id === debt.id && (
            <div className="basis-full flex items-center gap-[var(--space-sm)] pb-[var(--space-xs)]">
              <input
                type="number" min={0} autoFocus
                value={paying.amount}
                placeholder={`Amount (${abbr})`}
                aria-label={`Part-payment to ${debt.counterparty}`}
                onChange={e => setPaying({ id: debt.id, amount: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') { commitPayment(debt); }
                  if (e.key === 'Escape') setPaying(null);
                }}
                className="flex-1 min-w-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
              />
              <button type="button"
                onClick={() => setPaying({ id: debt.id, amount: String(outstanding(debt)) })}
                className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-xs cursor-pointer">
                All
              </button>
              <button type="button" onClick={() => commitPayment(debt)}
                disabled={!(Number(paying.amount) > 0)}
                className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer disabled:opacity-40">
                Record
              </button>
            </div>
          )}
        </div>
      ))}

      {settled.length > 0 && (
        <button type="button" onClick={() => setShowSettled(s => !s)} aria-expanded={showSettled}
          className="mt-[var(--space-xs)] min-h-[var(--touch-target-min)] bg-transparent border-none p-0 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] cursor-pointer">
          {showSettled ? '▾' : '▸'} Settled ({settled.length})
        </button>
      )}
      {showSettled && settled.map(debt => (
        <div key={debt.id} className="flex flex-wrap items-center gap-[var(--space-sm)] py-[var(--space-xs)] opacity-60 min-h-[var(--touch-target-min)]">
          <span className="flex-1 min-w-0 line-through text-[var(--color-text-muted)]">
            {debt.counterparty}{debt.note ? ` — ${debt.note}` : ''}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--color-text-muted)]">{fmt(debt.amount)}</span>
          {editable && (
            <button type="button" onClick={() => onReopen(debt.id)}
              className="shrink-0 min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-xs cursor-pointer">
              Reopen
            </button>
          )}
        </div>
      ))}

      {editable && (draft === null ? (
        <button type="button" onClick={() => setDraft({ ...EMPTY })}
          className="mt-[var(--space-sm)] min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-transparent text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] font-semibold cursor-pointer">
          + Record a debt
        </button>
      ) : (
        <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-sm)] p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <select value={draft.direction} aria-label="Debt direction"
              onChange={e => setDraft({ ...draft, direction: e.target.value as Debt['direction'] })}
              className="min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]">
              <option value="owed">I owe</option>
              <option value="due">Owed to me</option>
            </select>
            <input type="text" value={draft.counterparty} placeholder="Who" aria-label="Counterparty" autoFocus
              onChange={e => setDraft({ ...draft, counterparty: e.target.value })}
              className="flex-1 min-w-[8rem] min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" />
            <input type="number" min={0} value={draft.amount} placeholder={abbr} aria-label="Amount"
              onChange={e => setDraft({ ...draft, amount: e.target.value })}
              className="w-[7rem] min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" />
          </div>
          <input type="text" value={draft.note} placeholder="What for (optional)" aria-label="Debt note"
            onChange={e => setDraft({ ...draft, note: e.target.value })}
            className="min-h-[var(--touch-target-min)] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]" />
          <div className="flex gap-[var(--space-sm)]">
            <button type="button" disabled={!canAdd}
              onClick={() => {
                onAdd({
                  counterparty: draft.counterparty.trim(),
                  amount,
                  direction: draft.direction,
                  ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
                });
                setDraft(null);
              }}
              className={cn('min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border-none font-semibold',
                canAdd ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] cursor-pointer'
                       : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] opacity-50 cursor-default')}>
              Add
            </button>
            <button type="button" onClick={() => setDraft(null)}
              className="min-h-[var(--touch-target-min)] px-[var(--space-md)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      ))}

      {open.length > 0 && (
        <p className="m-0 mt-[var(--space-xs)] text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
          Owing {fmt(totalByDirection(debts, 'owed'))} · owed {fmt(totalByDirection(debts, 'due'))}
        </p>
      )}
    </div>
  );
}
