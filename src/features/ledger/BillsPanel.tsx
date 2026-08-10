import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nextDue, remainingOccurrences } from '../../utils/ledger/accrual';
import { isRouteDateValid } from '../../utils/route/calendar';
import type { RouteCalendar } from '../../utils/route/calendar';
import type { RecurringBill } from '../../types/recurringBill';
import type { LedgerAccount } from '../../types/ledgerAccount';
import { DEFAULT_BILL_INTERVAL_DAYS } from '../../config/defaults/ledger';

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
  everyDays: String(DEFAULT_BILL_INTERVAL_DAYS),
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
      title="Recurring charges"
      subtitle={
        campaignDate.trim() === ''
          ? 'Set a campaign date to begin accruing'
          : `Accrued through ${campaignDate}`
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
            Campaign date
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
            No recurring charges. Mortgage, life support and berthing belong here.
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
                  Every {bill.everyDays} days · {accountName(bill.accountId)}
                  {bill.counterAccountId && ` → ${accountName(bill.counterAccountId)}`}
                  {left !== null && ` · ${left} of ${bill.occurrenceLimit} remaining`}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-right">
                {formatMoney(bill.amount)}
                <span className="block text-sm font-normal text-[var(--color-text-muted)]">
                  {!bill.active
                    ? 'Suspended'
                    : due
                      ? `Next ${due}`
                      : left === 0
                        ? 'Term complete'
                        : 'No start date'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void onToggle(bill.id, !bill.active)}
                aria-label={`${bill.active ? 'Suspend' : 'Resume'} ${bill.name}`}
                className="shrink-0 min-h-[44px] px-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent text-[var(--color-text)] text-xs font-semibold cursor-pointer"
              >
                {bill.active ? 'Suspend' : 'Resume'}
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
              New recurring charge
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-sm)] p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <input
                className={`${inputClass} flex-1 min-w-[10rem]`}
                value={draft.name}
                placeholder="Ship mortgage"
                aria-label="Charge description"
                autoFocus
                onChange={e => setDraft({ ...draft, name: e.target.value })}
              />
              <input
                className={`${inputClass} max-w-[9rem]`}
                inputMode="numeric"
                value={draft.amount}
                placeholder="Amount"
                aria-label="Charge amount"
                onChange={e => setDraft({ ...draft, amount: e.target.value })}
              />
            </div>
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Interval (days)</span>
                <input
                  className={`${inputClass} max-w-[7rem]`}
                  inputMode="numeric"
                  value={draft.everyDays}
                  aria-label="Days between charges"
                  onChange={e => setDraft({ ...draft, everyDays: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">First charge</span>
                <input
                  className={`${inputClass} max-w-[9rem]`}
                  value={draft.startDate}
                  placeholder={dateHint}
                  aria-label="First charge date"
                  onChange={e => setDraft({ ...draft, startDate: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Term (blank = open-ended)</span>
                <input
                  className={`${inputClass} max-w-[8rem]`}
                  inputMode="numeric"
                  value={draft.occurrenceLimit}
                  placeholder="27"
                  aria-label="Term"
                  onChange={e => setDraft({ ...draft, occurrenceLimit: e.target.value })}
                />
              </label>
            </div>
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">Charge to</span>
                <select
                  className={`${inputClass} max-w-[12rem]`}
                  value={draft.accountId}
                  aria-label="Charge to account"
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
                <span className="text-sm text-[var(--color-text-muted)]">Applied against</span>
                <select
                  className={`${inputClass} max-w-[12rem]`}
                  value={draft.counterAccountId}
                  aria-label="Applied against account"
                  onChange={e => setDraft({ ...draft, counterAccountId: e.target.value })}
                >
                  <option value="">None — expense</option>
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
                    everyDays: Number(draft.everyDays) || DEFAULT_BILL_INTERVAL_DAYS,
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
                Create
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
