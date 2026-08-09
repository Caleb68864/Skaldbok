import { Fragment, useEffect, useRef, useState } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { useLedger } from '../features/ledger/useLedger';
import { useLedgerSplit } from '../features/ledger/useLedgerSplit';
import { SplitEditor } from '../features/ledger/SplitEditor';
import { DistributeModal } from '../features/ledger/DistributeModal';
import { AccountsPanel } from '../features/ledger/AccountsPanel';
import { BillsPanel } from '../features/ledger/BillsPanel';
import { LedgerImportModal } from '../features/ledger/LedgerImportModal';
import { useExportActions } from '../features/export/useExportActions';
import { useToast } from '../context/ToastContext';

const inputClass =
  'w-full min-h-[44px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';

/**
 * The crew's shared cashbook for a campaign.
 *
 * @remarks
 * A simple running-balance book: date, description, in, out. Money is a signed
 * integer underneath, but the user never types a sign — the Out column negates
 * on write.
 *
 * The Distribute action is the reason this screen exists. It divides an amount
 * by the crew's agreed split and writes one entry that **snapshots the
 * percentages it used**, so renegotiating later cannot rewrite what somebody
 * was paid in session 3.
 *
 * Money is rendered entirely through the campaign system's currency model, so
 * the same stored integers read as credits in Traveller and as coins in
 * Dragonbane.
 */
export default function LedgerScreen() {
  const { activeCampaign } = useCampaignContext();
  const ledger = useLedger();
  const split = useLedgerSplit();
  const { exportLedger } = useExportActions();
  const { showToast } = useToast();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [amountText, setAmountText] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const formatMoneyRef = useRef(ledger.formatMoney);
  formatMoneyRef.current = ledger.formatMoney;
  const [isImporting, setIsImporting] = useState(false);
  const [accountId, setAccountId] = useState<string>('');
  const [counterAccountId, setCounterAccountId] = useState<string>('');

  // Post anything the campaign date has made due. Runs on open and whenever the
  // date moves; `accrueBills` is idempotent, so a repeat finds nothing.
  //
  // The ref guards against React's double-invoked effects in development, which
  // would otherwise race two posting runs against the same watermark and write
  // every charge twice.
  const postingRef = useRef(false);
  useEffect(() => {
    if (ledger.isLoading || postingRef.current) return;
    postingRef.current = true;
    void ledger
      .postDueBills()
      .then(result => {
        if (result.count === 0) return;
        showToast(
          `Posted ${result.count} recurring charge${result.count === 1 ? '' : 's'}` +
            ` — ${formatMoneyRef.current(result.total)}` +
            (result.truncated ? '. More still due; reopen to post them.' : ''),
          'success',
        );
      })
      .finally(() => {
        postingRef.current = false;
      });
    // Deliberately keyed on the campaign date and load state alone: re-running
    // whenever `ledger` changes identity would fire on every entry written.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.campaignDate, ledger.isLoading]);

  if (!activeCampaign) return <NoCampaignPrompt />;

  const { rows, balance, formatMoney, baseDenomination, currencyLabel, accounts, summary } = ledger;
  const abbr = baseDenomination?.abbr ?? '';
  const amount = Math.trunc(Number(amountText));
  const amountIsUsable = amountText.trim() !== '' && Number.isFinite(amount) && amount !== 0;

  async function record(direction: 'in' | 'out') {
    if (!amountIsUsable) return;
    await ledger.addEntry({
      date,
      memo: memo.trim(),
      amount,
      direction,
      accountId: accountId || undefined,
      // A transfer only makes sense between two different accounts; naming the
      // same one both sides nets to nothing, so it is treated as no transfer.
      counterAccountId: counterAccountId && counterAccountId !== accountId
        ? counterAccountId
        : undefined,
    });
    setAmountText('');
    setMemo('');
  }

  return (
    <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
      <SectionPanel title={currencyLabel} subtitle={`Balance ${formatMoney(balance)}`}>
        <div className="flex flex-col gap-[var(--space-sm)]">
          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <input
              className={`${inputClass} max-w-[10rem]`}
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <input
              className={`${inputClass} flex-1 min-w-[10rem]`}
              value={memo}
              placeholder="What was it?"
              onChange={e => setMemo(e.target.value)}
            />
          </div>
          <div className="flex gap-[var(--space-sm)] flex-wrap items-center">
            <input
              className={`${inputClass} max-w-[10rem]`}
              inputMode="numeric"
              value={amountText}
              placeholder={abbr ? `Amount (${abbr})` : 'Amount'}
              onChange={e => setAmountText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void record('in');
              }}
            />
            <Button onClick={() => void record('in')} disabled={!amountIsUsable}>
              Money in
            </Button>
            <Button variant="secondary" onClick={() => void record('out')} disabled={!amountIsUsable}>
              Money out
            </Button>
          </div>
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
            <Button onClick={() => setIsDistributing(true)}>Distribute…</Button>
            <Button variant="secondary" onClick={() => setIsImporting(true)}>
              Import…
            </Button>
            {rows.length > 0 && (
              <Button variant="secondary" onClick={() => void exportLedger()}>
                Export
              </Button>
            )}
          </div>
        </div>
      </SectionPanel>

      <AccountsPanel
        summary={summary}
        formatMoney={formatMoney}
        onAdd={input => ledger.addAccount(input)}
        onRemove={async id => {
          const removed = await ledger.removeAccount(id);
          if (!removed) showToast('The default account cannot be removed', 'error');
          return removed;
        }}
      />

      <BillsPanel
        bills={ledger.bills}
        accounts={accounts}
        calendar={ledger.calendar}
        campaignDate={ledger.campaignDate}
        formatMoney={formatMoney}
        onSetCampaignDate={date => ledger.setCampaignDate(date)}
        onAdd={data => ledger.addBill(data)}
        onToggle={(id, active) => ledger.updateBill(id, { active })}
        onRemove={id => ledger.removeBill(id)}
      />

      <SplitEditor split={split} />

      <SectionPanel title="Entries">
        {rows.length === 0 ? (
          <p className="text-[var(--color-text-muted)]">
            Nothing recorded yet. Add the crew's first payday above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-sm text-[var(--color-text-muted)]">
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Description</th>
                  <th className="py-1 pr-2 text-right">In</th>
                  <th className="py-1 pr-2 text-right">Out</th>
                  <th className="py-1 pr-2 text-right">Balance</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(row => {
                  const isIn = row.amount >= 0;
                  return (
                    // An entry renders as its own row plus one per leg, so the
                    // key belongs on the fragment, not the first <tr>.
                    <Fragment key={row.id}>
                      <tr className="border-t border-[var(--color-border)]">
                        <td className="py-2 pr-2 whitespace-nowrap">{row.date}</td>
                        <td className="py-2 pr-2">{row.memo || '—'}</td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {isIn ? formatMoney(row.amount) : ''}
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {isIn ? '' : formatMoney(Math.abs(row.amount))}
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap">
                          {formatMoney(row.balance)}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            className="min-h-[44px] min-w-[44px] bg-transparent border-none cursor-pointer text-[var(--color-text-muted)]"
                            aria-label={`Delete entry ${row.memo || row.date}`}
                            onClick={() => {
                              void ledger.removeEntry(row.id);
                              showToast('Entry removed', 'success');
                            }}
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
                              ? 'Ship fund'
                              : leg.kind === 'unallocated'
                                ? 'Unallocated'
                                : leg.payeeName || 'Unnamed'}
                            {leg.pct !== undefined && ` (${leg.pct}%)`}
                            {leg.kind === 'shipFund' && ' — retained'}
                          </td>
                          <td />
                          <td className="py-1 pr-2 text-right whitespace-nowrap">
                            {formatMoney(leg.amount)}
                          </td>
                          <td />
                          <td />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

      {isImporting && (
        <LedgerImportModal
          formatMoney={formatMoney}
          onCancel={() => setIsImporting(false)}
          onImport={async parsed => {
            const result = await ledger.importLedger(parsed);
            setIsImporting(false);
            showToast(
              `Imported ${result.entries} entr${result.entries === 1 ? 'y' : 'ies'}` +
                (result.accounts > 0 ? ` and ${result.accounts} account(s)` : ''),
              'success',
            );
          }}
        />
      )}

      {isDistributing && (
        <DistributeModal
          snapshot={split.snapshot}
          validation={split.validation}
          balance={balance}
          formatMoney={formatMoney}
          denominationAbbr={abbr}
          onCancel={() => setIsDistributing(false)}
          onConfirm={async input => {
            await ledger.addDistribution(input);
            setIsDistributing(false);
            showToast('Payout recorded', 'success');
          }}
        />
      )}
    </div>
  );
}
