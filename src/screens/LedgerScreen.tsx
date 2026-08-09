import { useState } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { Button } from '../components/primitives/Button';
import { useLedger } from '../features/ledger/useLedger';
import { useLedgerSplit } from '../features/ledger/useLedgerSplit';
import { SplitEditor } from '../features/ledger/SplitEditor';
import { DistributeModal } from '../features/ledger/DistributeModal';
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

  if (!activeCampaign) return <NoCampaignPrompt />;

  const { rows, balance, formatMoney, baseDenomination, currencyLabel } = ledger;
  const abbr = baseDenomination?.abbr ?? '';
  const amount = Math.trunc(Number(amountText));
  const amountIsUsable = amountText.trim() !== '' && Number.isFinite(amount) && amount !== 0;

  async function record(direction: 'in' | 'out') {
    if (!amountIsUsable) return;
    await ledger.addEntry({ date, memo: memo.trim(), amount, direction });
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
          <div className="flex gap-[var(--space-sm)] flex-wrap">
            <Button onClick={() => setIsDistributing(true)}>Distribute…</Button>
            {rows.length > 0 && (
              <Button variant="secondary" onClick={() => void exportLedger()}>
                Export
              </Button>
            )}
          </div>
        </div>
      </SectionPanel>

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
                    <>
                      <tr key={row.id} className="border-t border-[var(--color-border)]">
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
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>

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
