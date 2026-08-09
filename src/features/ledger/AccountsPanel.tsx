import { useState } from 'react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import type { AccountSummary } from '../../utils/ledgerAccounts';
import type { LedgerAccount } from '../../types/ledgerAccount';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/** Props for {@link AccountsPanel}. */
export interface AccountsPanelProps {
  summary: AccountSummary;
  formatMoney: (baseUnits: number) => string;
  onAdd: (input: {
    name: string;
    kind: LedgerAccount['kind'];
    note?: string;
    contingent?: boolean;
    /** Signed. A liability's opening is already negative by the time it lands here. */
    opening?: number;
  }) => Promise<void>;
  onRemove: (id: string) => Promise<boolean>;
  /**
   * Each account's current opening balance, signed, keyed by account id.
   *
   * @remarks
   * Needed to prefill the edit form. The opening is a ledger entry rather than a
   * field on the account, so the panel cannot read it off `summary` — an
   * account's *balance* is every movement folded together and is not the same
   * number.
   */
  openings: Record<string, number>;
  onEdit: (
    id: string,
    patch: { name?: string; note?: string; contingent?: boolean; opening?: number },
  ) => Promise<void>;
}

/**
 * What the crew has, and what they owe.
 *
 * @remarks
 * A liability's balance is stored negative, and this is the one place that
 * matters to a reader: the panel prints its magnitude under the word
 * *Outstanding* rather than as a minus sign somebody has to interpret at the
 * table. The arithmetic is untouched — only the words change.
 *
 * Net position is shown because it is the number the mortgage makes
 * interesting. Paying it down does not make the crew richer — cash becomes
 * equity — but spending on fuel does make them poorer, and only a figure
 * spanning both sides shows the difference. Contingent liabilities are
 * disclosed and excluded from it, which is what "contingent" means: an
 * obligation that only becomes real if something happens.
 */
export function AccountsPanel({
  summary,
  formatMoney,
  onAdd,
  onRemove,
  openings,
  onEdit,
}: AccountsPanelProps) {
  const [draft, setDraft] = useState<
    | {
        /** Absent when creating; present when editing that account. */
        id?: string;
        name: string;
        kind: LedgerAccount['kind'] | 'contingent';
        opening: string;
        note: string;
      }
    | null
  >(null);

  const isEditing = draft?.id !== undefined;

  const hasDebt = summary.totalOwed !== 0 || summary.totalAtRisk !== 0;

  return (
    <SectionPanel
      title="Accounts"
      subtitle={
        [
          `Assets ${formatMoney(summary.totalAssets)}`,
          summary.totalOwed !== 0 ? `Liabilities ${formatMoney(summary.totalOwed)}` : null,
          summary.totalAtRisk !== 0 ? `Contingent ${formatMoney(summary.totalAtRisk)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      }
      collapsible
      defaultOpen
    >
      <div className="flex flex-col gap-[var(--space-sm)]">
        {summary.balances.map(({ account, balance, entryCount }) => (
          <div
            key={account.id}
            className="flex items-center gap-[var(--space-sm)] py-1 border-b border-[var(--color-border)]"
          >
            <span className="flex-1 min-w-0">
              {account.name}
              {account.isPrimary && (
                <span className="text-[var(--color-text-muted)] text-sm"> · default</span>
              )}
              {account.note && (
                <span className="block text-sm text-[var(--color-text-muted)]">{account.note}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-right">
              {account.kind === 'liability' ? (
                <>
                  {formatMoney(Math.abs(balance))}
                  <span className="block text-sm font-normal text-[var(--color-text-muted)]">
                    {balance === 0
                      ? 'Settled'
                      : account.contingent
                        ? 'Contingent'
                        : 'Outstanding'}
                  </span>
                </>
              ) : (
                formatMoney(balance)
              )}
            </span>
            {/* Every account is editable, including the primary one. It is
                created automatically with no opening balance, so without this
                there is no way to tell the book how much cash the crew started
                with — the exact hole this closes. */}
            <button
              type="button"
              aria-label={`Edit ${account.name}`}
              onClick={() =>
                setDraft({
                  id: account.id,
                  name: account.name,
                  kind: account.contingent ? 'contingent' : account.kind,
                  // Shown the way it is typed: a liability's opening is entered
                  // as the amount owed, so strip the stored sign.
                  opening:
                    openings[account.id] === undefined || openings[account.id] === 0
                      ? ''
                      : String(Math.abs(openings[account.id])),
                  note: account.note ?? '',
                })
              }
              className="shrink-0 min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
            >
              Edit
            </button>
            {!account.isPrimary && (
              <button
                type="button"
                aria-label={`Remove ${account.name}`}
                title={
                  entryCount > 0
                    ? `${entryCount} entries reference this account`
                    : 'Remove this account'
                }
                onClick={() => void onRemove(account.id)}
                className="shrink-0 min-w-[44px] min-h-[44px] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {hasDebt && (
          <div className="flex justify-between gap-2 pt-1">
            <span className="font-semibold">Net position</span>
            <span
              className="tabular-nums font-semibold"
              style={{
                color:
                  summary.netWorth < 0
                    ? 'var(--color-danger, #b3261e)'
                    : 'var(--color-success, #2e7d32)',
              }}
            >
              {formatMoney(summary.netWorth)}
            </span>
          </div>
        )}

        {draft === null ? (
          <div>
            <Button
              variant="secondary"
              onClick={() => setDraft({ name: '', kind: 'asset', opening: '', note: '' })}
            >
              New account
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-sm)] p-[var(--space-sm)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
            <div className="flex gap-[var(--space-sm)] flex-wrap">
              <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
                <span className="text-sm text-[var(--color-text-muted)]">Account name</span>
                <input
                  className={inputClass}
                  value={draft.name}
                  placeholder="Ship mortgage"
                  aria-label="Account name"
                  autoFocus
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">
                  Type{isEditing && ' (fixed)'}
                </span>
                <select
                  className={`${inputClass} max-w-[14rem] disabled:opacity-60`}
                  value={draft.kind}
                  aria-label="Account type"
                  // Locked once the account exists. The kind decides the sign of
                  // every entry already booked against it, so switching asset to
                  // liability would invert the history rather than reclassify
                  // it. A control that looks editable and silently does nothing
                  // is worse than one that is plainly disabled.
                  disabled={isEditing}
                  title={isEditing ? 'Delete and recreate the account to change its type' : undefined}
                  onChange={e => setDraft({ ...draft, kind: e.target.value as typeof draft.kind })}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="contingent">Contingent liability</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-[var(--color-text-muted)]">
                  {draft.kind === 'asset' ? 'Opening balance' : 'Opening balance owed'}
                </span>
                <input
                  className={`${inputClass} max-w-[12rem]`}
                  inputMode="numeric"
                  value={draft.opening}
                  placeholder="0"
                  aria-label="Opening balance"
                  onChange={e => setDraft({ ...draft, opening: e.target.value })}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-muted)]">Note (optional)</span>
              <input
                className={inputClass}
                value={draft.note}
                placeholder="The Leap — Empress Marava far trader"
                aria-label="Account note"
                onChange={e => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <div className="flex gap-[var(--space-sm)]">
              <Button
                disabled={draft.name.trim() === ''}
                onClick={() => {
                  const contingent = draft.kind === 'contingent';
                  const kind: LedgerAccount['kind'] = contingent
                    ? 'liability'
                    : (draft.kind as LedgerAccount['kind']);
                  const typed = Number(draft.opening.replace(/[^0-9.-]/g, ''));
                  const magnitude = Number.isFinite(typed) ? Math.trunc(Math.abs(typed)) : 0;
                  // A liability's opening is *typed* as the amount owed — the
                  // way anyone would say it out loud — and *stored* negative,
                  // which is the sign the balance arithmetic expects. The
                  // conversion belongs here rather than in the hook so the two
                  // callers (this form and the JSON import) agree on it.
                  const opening = kind === 'liability' ? -magnitude : magnitude;
                  if (draft.id !== undefined) {
                    // `kind` is deliberately not editable: it decides the sign
                    // of every entry already booked against the account, so
                    // flipping asset to liability would silently invert history.
                    // Delete and recreate is the honest way to change it.
                    void onEdit(draft.id, {
                      name: draft.name.trim(),
                      note: draft.note.trim(),
                      contingent,
                      opening,
                    });
                  } else {
                    void onAdd({
                      name: draft.name.trim(),
                      kind,
                      contingent,
                      opening,
                      note: draft.note.trim(),
                    });
                  }
                  setDraft(null);
                }}
              >
                {isEditing ? 'Save' : 'Create'}
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
