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
  onAdd: (name: string, kind: LedgerAccount['kind'], note?: string, contingent?: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<boolean>;
}

/**
 * What the crew has, and what they owe.
 *
 * @remarks
 * A liability's balance is stored negative, and this is the one place that
 * matters to a reader: the panel prints it as *owed* rather than as a minus
 * sign somebody has to interpret at the table. The arithmetic is untouched —
 * only the words change.
 *
 * Net worth is shown because it is the number the mortgage makes interesting.
 * Paying it down does not make the crew richer — cash becomes equity — but
 * spending on fuel does make them poorer, and only a figure spanning both
 * accounts shows the difference.
 */
export function AccountsPanel({ summary, formatMoney, onAdd, onRemove }: AccountsPanelProps) {
  const [draft, setDraft] = useState<
    { name: string; kind: LedgerAccount['kind'] | 'contingent' } | null
  >(null);

  const hasDebt = summary.totalOwed !== 0 || summary.totalAtRisk !== 0;

  return (
    <SectionPanel
      title="Accounts"
      subtitle={
        [
          `${formatMoney(summary.totalAssets)} held`,
          summary.totalOwed !== 0 ? `${formatMoney(summary.totalOwed)} owed` : null,
          summary.totalAtRisk !== 0 ? `${formatMoney(summary.totalAtRisk)} at risk` : null,
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
                    {balance === 0 ? 'cleared' : account.contingent ? 'at risk' : 'owed'}
                  </span>
                </>
              ) : (
                formatMoney(balance)
              )}
            </span>
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
            <span className="font-semibold">Net worth</span>
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
            <Button variant="secondary" onClick={() => setDraft({ name: '', kind: 'asset' })}>
              Add an account
            </Button>
          </div>
        ) : (
          <div className="flex gap-[var(--space-sm)] flex-wrap items-center">
            <input
              className={`${inputClass} flex-1 min-w-[10rem]`}
              value={draft.name}
              placeholder="Ship Loan"
              aria-label="Account name"
              autoFocus
              onChange={e => setDraft({ ...draft, name: e.target.value })}
            />
            <select
              className={`${inputClass} max-w-[10rem]`}
              value={draft.kind}
              aria-label="Account kind"
              onChange={e => setDraft({ ...draft, kind: e.target.value as typeof draft.kind })}
            >
              <option value="asset">Money we have</option>
              <option value="liability">Money we owe</option>
              <option value="contingent">Owed only if something fails</option>
            </select>
            <Button
              disabled={draft.name.trim() === ''}
              onClick={() => {
                const contingent = draft.kind === 'contingent';
                void onAdd(
                  draft.name.trim(),
                  contingent ? 'liability' : (draft.kind as LedgerAccount['kind']),
                  undefined,
                  contingent,
                );
                setDraft(null);
              }}
            >
              Add
            </Button>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </SectionPanel>
  );
}
