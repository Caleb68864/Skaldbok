import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import { computeRunningBalance } from '../../utils/ledgerMath';
import type { EntryWithBalance } from '../../utils/ledgerMath';
import type { LedgerLeg, SplitSnapshot } from '../../types/ledger';

/**
 * The active campaign's cashbook, with running balances folded on read.
 *
 * @remarks
 * The engine is resolved from the **campaign's** system rather than the active
 * character's: a campaign ledger exists whether or not a character is loaded,
 * so `useSystemEngine()` (which keys off the active character) is the wrong
 * door. This mirrors `ParticipantDrawer`.
 */
export function useLedger() {
  const { activeCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const { logToSession, hasActiveSession } = useSessionLog();
  const [rows, setRows] = useState<EntryWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaignId = activeCampaign?.id;
  const engine = useMemo(() => (system ? getEngine(system) : null), [system]);

  const reload = useCallback(async () => {
    if (!campaignId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    const entries = await ledgerRepository.listByCampaign(campaignId);
    setRows(computeRunningBalance(entries));
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  const balance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  /** Formats a signed base-unit integer using the campaign system's currency. */
  const formatMoney = useCallback(
    (baseUnits: number) => engine?.currency.formatAmount(baseUnits) ?? String(baseUnits),
    [engine],
  );

  /**
   * The denomination amounts are counted in — used to label the amount input,
   * and the shipped reader for `CurrencyModel.baseDenominationId`.
   */
  const baseDenomination = useMemo(() => {
    if (!engine) return null;
    const id = engine.currency.baseDenominationId;
    return engine.currency.denominations.find(d => d.id === id) ?? null;
  }, [engine]);

  /**
   * Mirrors a money movement into the session log.
   *
   * @remarks
   * The ledger is the ongoing record; the session log is the narrative one.
   * A transaction belongs in both — "when did we pay for that?" is asked of the
   * session log as often as of the book.
   *
   * Deliberately best-effort and non-blocking: a log failure must never lose
   * the ledger entry, which is the load-bearing write. With no active session
   * there is nowhere for the note to go, and the ledger still works.
   */
  const mirrorToLog = useCallback(
    async (title: string, ledgerEntryId: string, kind: 'entry' | 'distribution' | 'removal') => {
      if (!hasActiveSession) return;
      try {
        // `body` as well as `title`: the session log renders the body, so a
        // title-only note shows up as a row with nothing in it but a timestamp.
        await logToSession(
          title,
          'log',
          { source: 'ledger', ledgerEntryId, kind },
          { body: title },
        );
      } catch (err) {
        console.error('[useLedger] session-log mirror failed', err);
      }
    },
    [hasActiveSession, logToSession],
  );

  /** Records a movement. `direction` decides the sign so the user never types one. */
  const addEntry = useCallback(
    async (input: { date: string; memo: string; amount: number; direction: 'in' | 'out' }) => {
      if (!campaignId) return;
      const magnitude = Math.abs(Math.trunc(input.amount));
      if (magnitude === 0) return;
      const entry = await ledgerRepository.create({
        campaignId,
        date: input.date,
        memo: input.memo,
        amount: input.direction === 'out' ? -magnitude : magnitude,
      });
      const money = engine?.currency.formatAmount(magnitude) ?? String(magnitude);
      const what = input.memo.trim() || 'unlabelled';
      await mirrorToLog(
        `Ledger: ${input.direction === 'out' ? 'paid' : 'received'} ${money} — ${what}`,
        entry.id,
        'entry',
      );
      await reload();
    },
    [campaignId, reload, engine, mirrorToLog],
  );

  /** Writes a distribution as one entry carrying its legs and a frozen snapshot. */
  const addDistribution = useCallback(
    async (input: {
      date: string;
      memo: string;
      gross: number;
      net: number;
      legs: LedgerLeg[];
      splitSnapshot: SplitSnapshot;
    }) => {
      if (!campaignId) return;
      const entry = await ledgerRepository.create({
        campaignId,
        date: input.date,
        memo: input.memo,
        amount: input.net,
        gross: input.gross,
        legs: input.legs,
        splitSnapshot: input.splitSnapshot,
      });
      // The log line names every share, because "who got what" is the question
      // the session log gets asked months later — and by then the split will
      // have changed, so the numbers have to be written down here too.
      const fmt = (n: number) => engine?.currency.formatAmount(n) ?? String(n);
      const shares = input.legs
        .map(leg =>
          leg.kind === 'shipFund'
            ? `ship fund ${fmt(leg.amount)} (retained)`
            : leg.kind === 'unallocated'
              ? `unallocated ${fmt(leg.amount)}`
              : `${leg.payeeName ?? 'unnamed'} ${fmt(leg.amount)}`,
        )
        .join(', ');
      await mirrorToLog(
        `Ledger: distributed ${fmt(input.gross)} — ${shares}`,
        entry.id,
        'distribution',
      );
      await reload();
    },
    [campaignId, reload, engine, mirrorToLog],
  );

  const removeEntry = useCallback(
    async (id: string) => {
      const entry = await ledgerRepository.getById(id);
      await ledgerRepository.softDelete(id);
      if (entry) {
        const money = engine?.currency.formatAmount(Math.abs(entry.amount)) ?? String(entry.amount);
        await mirrorToLog(
          `Ledger: removed entry ${money} — ${entry.memo || 'unlabelled'}`,
          id,
          'removal',
        );
      }
      await reload();
    },
    [reload, engine, mirrorToLog],
  );

  return {
    rows,
    balance,
    isLoading,
    formatMoney,
    baseDenomination,
    currencyLabel: engine?.currency.label ?? 'Money',
    addEntry,
    addDistribution,
    removeEntry,
    reload,
  };
}
