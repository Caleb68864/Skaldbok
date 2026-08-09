import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import * as ledgerAccountRepository from '../../storage/repositories/ledgerAccountRepository';
import { computeAccountBalances } from '../../utils/ledgerAccounts';
import type { LedgerAccount } from '../../types/ledgerAccount';
import { computeRunningBalance } from '../../utils/ledgerMath';
import type { EntryWithBalance } from '../../utils/ledgerMath';
import type { LedgerEntry, LedgerLeg, SplitSnapshot } from '../../types/ledger';

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
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaignId = activeCampaign?.id;
  const engine = useMemo(() => (system ? getEngine(system) : null), [system]);

  const reload = useCallback(async () => {
    if (!campaignId) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    const loaded = await ledgerRepository.listByCampaign(campaignId);
    setEntries(loaded);
    setRows(computeRunningBalance(loaded));
    setAccounts(await ledgerAccountRepository.ensureForCampaign(campaignId));
    setIsLoading(false);
  }, [campaignId]);

  useEffect(() => {
    reload().catch(console.error);
  }, [reload]);

  const balance = rows.length > 0 ? rows[rows.length - 1].balance : 0;

  /**
   * Per-account balances, derived like the running balance.
   *
   * @remarks
   * A stored balance goes stale the moment an entry is edited, restored or
   * reassigned — and this one has more ways to go stale than the single total
   * does, because a transfer touches two accounts at once.
   */
  const summary = useMemo(
    () => computeAccountBalances(accounts, entries),
    [accounts, entries],
  );

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
    async (input: {
      date: string;
      memo: string;
      amount: number;
      direction: 'in' | 'out';
      accountId?: string;
      counterAccountId?: string;
      kind?: 'opening';
    }) => {
      if (!campaignId) return;
      const magnitude = Math.abs(Math.trunc(input.amount));
      if (magnitude === 0) return;
      const entry = await ledgerRepository.create({
        campaignId,
        date: input.date,
        memo: input.memo,
        amount: input.direction === 'out' ? -magnitude : magnitude,
        accountId: input.accountId,
        counterAccountId: input.counterAccountId,
        kind: input.kind,
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
      alsoRecordIncome?: boolean;
    }) => {
      if (!campaignId) return;
      // Written first so the book reads in the order it happened: the fee
      // arrives, then it is split. Two entries, because they are two events —
      // folding them into one would hide the income from the In column.
      if (input.alsoRecordIncome) {
        const income = await ledgerRepository.create({
          campaignId,
          date: input.date,
          memo: input.memo,
          amount: input.gross,
        });
        const money = engine?.currency.formatAmount(input.gross) ?? String(input.gross);
        await mirrorToLog(
          `Ledger: received ${money} — ${input.memo}`,
          income.id,
          'entry',
        );
      }
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

  /**
   * Imports parsed accounts and entries in one go.
   *
   * @remarks
   * Accounts are created first so entries can name them. An entry naming an
   * account that neither existed nor appeared in the file is left unassigned —
   * it then counts against the primary rather than being dropped, because
   * losing a transaction is worse than filing it in the obvious place.
   *
   * Opening balances are written as their own entries rather than as a field on
   * the account: "what did we start with" is a fact with a date, and burying it
   * in the account record would leave it out of the book it belongs in.
   */
  const importLedger = useCallback(
    async (parsed: {
      accounts: Array<{ name: string; kind: 'asset' | 'liability'; opening?: number; note?: string }>;
      entries: Array<{
        date: string;
        memo: string;
        amount: number;
        accountName?: string;
        counterAccountName?: string;
      }>;
    }) => {
      if (!campaignId) return { accounts: 0, entries: 0 };

      const existing = await ledgerAccountRepository.ensureForCampaign(campaignId);
      const byName = new Map(existing.map(a => [a.name.toLowerCase(), a]));

      let created = 0;
      for (const account of parsed.accounts) {
        const key = account.name.toLowerCase();
        if (byName.has(key)) continue;
        const made = await ledgerAccountRepository.create({
          campaignId,
          name: account.name,
          kind: account.kind,
          note: account.note,
        });
        byName.set(key, made);
        created += 1;
      }

      const today = new Date().toISOString().slice(0, 10);

      // Openings first, so the book reads in the order it happened.
      for (const account of parsed.accounts) {
        if (account.opening === undefined || account.opening === 0) continue;
        const target = byName.get(account.name.toLowerCase());
        if (!target) continue;
        await ledgerRepository.create({
          campaignId,
          date: today,
          memo: `Opening balance — ${account.name}`,
          amount: account.opening,
          accountId: target.id,
          kind: 'opening',
        });
      }

      let written = 0;
      for (const entry of parsed.entries) {
        const near = entry.accountName ? byName.get(entry.accountName.toLowerCase()) : undefined;
        const far = entry.counterAccountName
          ? byName.get(entry.counterAccountName.toLowerCase())
          : undefined;
        await ledgerRepository.create({
          campaignId,
          date: entry.date || today,
          memo: entry.memo,
          amount: entry.amount,
          accountId: near?.id,
          counterAccountId: far?.id,
        });
        written += 1;
      }

      await reload();
      return { accounts: created, entries: written };
    },
    [campaignId, reload],
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
    accounts,
    summary,
    importLedger,
    addAccount: async (name: string, kind: LedgerAccount['kind'], note?: string) => {
      if (!campaignId) return;
      await ledgerAccountRepository.create({ campaignId, name, kind, note });
      await reload();
    },
    updateAccount: async (id: string, patch: { name?: string; kind?: LedgerAccount['kind']; note?: string }) => {
      await ledgerAccountRepository.update(id, patch);
      await reload();
    },
    removeAccount: async (id: string) => {
      const removed = await ledgerAccountRepository.softDelete(id);
      await reload();
      return removed;
    },
    formatMoney,
    baseDenomination,
    currencyLabel: engine?.currency.label ?? 'Money',
    addEntry,
    addDistribution,
    removeEntry,
    reload,
  };
}
