import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nextDue, remainingOccurrences } from '../../utils/ledger/accrual';
import { isRouteDateValid } from '../../utils/route/calendar';
import type { RouteCalendar } from '../../utils/route/calendar';
import type { RecurringBill } from '../../types/recurringBill';
import type { LedgerAccount } from '../../types/ledgerAccount';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/** Props for {@link BillsPanel}. */
export interface BillsPanelProps {
  bills: RecurringBill[];
  accounts: LedgerAccount[];
  calendar?: RouteCalendar;
  campaignDate: string;
  formatMoney: (baseUnits: number) => string;
  onSetCampaignDate: (date: string) => Promise<void>;
  onAdd: (data: {
    name: string;
    amount: number;
    everyDays?: number;
    startDate?: string;
    accountId?: string;
    counterAccountId?: string;
    occurrenceLimit?: number;
  }) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const EMPTY = {
  name: '',
  amount: '',
  everyDays: '30',
  startDate: '',
  accountId: '',
  counterAccountId: '',
  occurrenceLimit: '',
};

/**
 * The costs that come round again, and the in-world date they accrue against.
 *
 * @remarks
 * The campaign date is the control that matters. Bills charge per in-world
 * month, so advancing it is what makes the ship cost money — six weeks of
 * jumping costs six weeks of nut whether that took the table one session or
 * five. Nothing accrues while the date sits still.
 *
 * A bill can name the account it comes out of. Pointing it at an escrow account
 * instead of cash is how a cost somebody else is covering accrues as an
 * obligation without touching the crew's money.
 */
export function BillsPanel({
  bills,
  accounts,
  calendar,
  campaignDate,
  formatMoney,
  onSetCampaignDate,
  onAdd,
  onToggle,
  onRemove,
}: BillsPanelProps) {
  const [draft, setDraft] = useState<typeof EMPTY | null>(null);

  const dateHint = calendar?.example ?? 'day number';
  const dateOk = isRouteDateValid(campaignDate, calendar);
  const accountName = (id?: string) =>
    id ? (accounts.find(a => a.id === id)?.name ?? 'unknown') : 'default';

  const amount = Number(draft?.amount ?? 0);
  const canAdd =
    !!draft && draft.name.trim() !== '' && Number.isFinite(amount) && amount > 0;

  return (
    <SectionPanel
      title="Recurring costs"
      subtitle={
        campaignDate.trim() === ''
          ? 'Set the campaign date to start accruing'
          : `Campaign date ${campaignDate}`
      }
      collapsible
      // Open even with nothing in it. This panel holds the campaign date — the
      // control that makes every other cost accrue — and the only way to add a
      // first bill. Gating it on `bills.length > 0` was backwards: it hid the
      // controls precisely when they were needed, and a collapsed panel still
      // renders its children, so they sat in the DOM unreachable.
      defaultOpen
    >
      <div className="flex flex-col gap-[var(--space-sm)]">
        <label className="flex flex-col gap-1 max-w-[14rem]">
          <span className="text-sm text-[var(--color-text-muted)]">
            Campaign date — advance it as time passes
          </span>
          <input
            className={inputClass}
            value={campaignDate}
            placeholder={dateHint}
            aria-label="Campaign date"
            onChange={e => void onSetCampaignDate(e.target.value)}
            style={dateOk ? undefined : { borderColor: 'var(--color-danger, #b3261e)' }}
          />
        </label>

        {bills.length === 0 && (
          <p className="text-[var(--color-text-muted)]">
            Nothing recurring yet. The mortgage, life support and berthing all belong here.
          </p>
        )}

        {bills.map(bill => {
          const due = nextDue(bill, calendar);
          const left = remainingOccurrences(bill);
          return (
            <div
              key={bill.id}
              className="flex items-center gap-[var(--space-sm)] py-1 border-b border-[var(--color-border)] flex-wrap"
            >
              <span className="flex-1 min-w-[8rem]">
                {bill.name}
                <span className="block text-sm text-[var(--color-text-muted)]">
                  every {bill.everyDays} days · from {accountName(bill.accountId)}
                  {bill.counterAccountId && ` → ${accountName(bill.counterAccountId)}`}
                  {left !== null && ` · ${left} left`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-right">
                {formatMoney(bill.amount)}
                <span className="block text-sm font-normal text-[var(--color-text-muted)]">
                  {!bill.active
                    ? 'paused'
                    : due
                      ? `next ${due}`
                      : left === 0
                        ? 'finished'
                        : 'no start date'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void onToggle(bill.id, !bill.active)}
                aria-label={`${bill.active ? 'Pause' : 'Resume'} ${bill.name}`}
                className="shrink-0 min-h-[44px] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer"
              >
                {bill.active ? 'Pause' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={() => void onRemove(bill.id)}
                aria-label={`Remove ${bill.name}`}
                className="shrink-0 min-w-[44px] min-h-[44px] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
              >
                ✕
              </button>
            </div>
          );
        })}

        {draft === null ? (
          <div>
            <Button variant="secondary" onClick={() => setDraft({ ...EMPTY, startDate: campaignDate })}>
              Add a recurring cost
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-sm)] p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <input
                className={`${inputClass} flex-1 min-w-[10rem]`}
                value={draft.name}
                placeholder="Mortgage"
                aria-label="Cost name"
                autoFocus
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
              <input
                className={`${inputClass} max-w-[9rem]`}
                inputMode="numeric"
                value={draft.amount}
                placeholder="Amount"
                aria-label="Cost amount"
                onChange={e => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Every (days)</span>
                <input
                  className={`${inputClass} max-w-[7rem]`}
                  inputMode="numeric"
                  value={draft.everyDays}
                  aria-label="Days between charges"
                  onChange={e => setDraft({ ...draft, everyDays: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Starting</span>
                <input
                  className={`${inputClass} max-w-[9rem]`}
                  value={draft.startDate}
                  placeholder={dateHint}
                  aria-label="Cost start date"
                  onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Times (blank = forever)</span>
                <input
                  className={`${inputClass} max-w-[8rem]`}
                  inputMode="numeric"
                  value={draft.occurrenceLimit}
                  placeholder="27"
                  aria-label="Number of charges"
                  onChange={e => setDraft({ ...draft, occurrenceLimit: e.target.value })}
                />
              </label>
            </div>
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Comes out of</span>
                <select
                  className={`${inputClass} max-w-[12rem]`}
                  value={draft.accountId}
                  aria-label="Source account"
                  onChange={e => setDraft({ ...draft, accountId: e.target.value })}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.isPrimary ? '' : a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Pays down</span>
                <select
                  className={`${inputClass} max-w-[12rem]`}
                  value={draft.counterAccountId}
                  aria-label="Account it pays down"
                  onChange={e => setDraft({ ...draft, counterAccountId: e.target.value })}
                >
                  <option value="">— nothing (it is just a cost) —</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex gap-[var(--space-sm)]">
              <Button
                disabled={!canAdd}
                onClick={() => {
                  const limit = Number(draft.occurrenceLimit);
                  void onAdd({
                    name: draft.name.trim(),
                    amount,
                    everyDays: Number(draft.everyDays) || 30,
                    startDate: draft.startDate.trim() || campaignDate,
                    accountId: draft.accountId || undefined,
                    counterAccountId: draft.counterAccountId || undefined,
                    occurrenceLimit:
                      draft.occurrenceLimit.trim() !== '' && Number.isFinite(limit) && limit > 0
                        ? limit
                        : undefined,
                  });
                  setDraft(null);
                }}
              >
                Add
              </Button>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
