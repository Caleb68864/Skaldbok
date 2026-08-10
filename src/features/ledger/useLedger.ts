import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';
import * as ledgerRepository from '../../storage/repositories/ledgerRepository';
import * as ledgerAccountRepository from '../../storage/repositories/ledgerAccountRepository';
import * as recurringBillRepository from '../../storage/repositories/recurringBillRepository';
import * as campaignRepository from '../../storage/repositories/campaignRepository';
import { accrueBills } from '../../utils/ledger/accrual';
import type { RecurringBill } from '../../types/recurringBill';
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
  const { activeCampaign, setActiveCampaign } = useCampaignContext();
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const { logToSession, hasActiveSession } = useSessionLog();
  const [rows, setRows] = useState<EntryWithBalance[]>([]);
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaignId = activeCampaign?.id;
  const engine = useMemo(() => (system ? getEngine(system) : null), [system]);
  const calendar = system?.calendar ?? system?.routePlanner?.calendar;
  const campaignDate = activeCampaign?.campaignDate ?? '';

  /**
   * Re-reads the book.
   *
   * @remarks
   * Returns the cash balance it just computed. A caller that has *just* written
   * entries cannot read `balance` off this hook — that state lands on the next
   * render, so the closure would see the figure from before the write. Returning
   * it is what lets bill posting tell whether it is the thing that overdrew the
   * crew.
   */
  const reload = useCallback(async () => {
    if (!campaignId) {
      setRows([]);
      setIsLoading(false);
      return 0;
    }
    const loaded = await ledgerRepository.listByCampaign(campaignId);
    // Accounts first: the running balance folds cash on hand, so it needs to
    // know which accounts are assets before it can fold anything.
    const loadedAccounts = await ledgerAccountRepository.ensureForCampaign(campaignId);
    const computed = computeRunningBalance(loaded, {
      accountIds: new Set(loadedAccounts.filter(a => a.kind === 'asset').map(a => a.id)),
      primaryId: loadedAccounts.find(a => a.isPrimary)?.id,
    });
    setEntries(loaded);
    setRows(computed);
    setAccounts(loadedAccounts);
    setBills(await recurringBillRepository.listByCampaign(campaignId));
    setIsLoading(false);
    return computed.length > 0 ? computed[computed.length - 1].balance : 0;
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
    async (
      title: string,
      /** Empty for a line that summarises a run rather than reporting one entry. */
      ledgerEntryId: string,
      kind: 'entry' | 'distribution' | 'removal' | 'bills',
    ) => {
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
      accounts: Array<{
        name: string;
        kind: 'asset' | 'liability';
        contingent?: boolean;
        opening?: number;
        note?: string;
      }>;
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
          contingent: account.contingent,
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

  /**
   * Writes every charge that has fallen due since the campaign date last moved.
   *
   * @remarks
   * Safe to call on every open because {@link accrueBills} is idempotent — each
   * bill's watermark advances with its charges, so a second run finds nothing.
   *
   * Each charge is an ordinary ledger entry. That matters: it can be read,
   * exported, corrected or deleted like any other, and nothing about it is
   * special once written.
   *
   * Returns what it posted so the caller can say so. Posting money silently
   * would be indistinguishable from a bug.
   */
  const postDueBills = useCallback(async () => {
    if (!campaignId || campaignDate.trim() === '') return { count: 0, total: 0, truncated: false, cashAfter: balance };

    const live = await recurringBillRepository.listByCampaign(campaignId);
    const result = accrueBills({ bills: live, campaignDate, calendar });
    if (result.charges.length === 0) return { count: 0, total: 0, truncated: false, cashAfter: balance };

    for (const charge of result.charges) {
      await ledgerRepository.create({
        campaignId,
        date: charge.date,
        memo: charge.bill.name,
        amount: -charge.bill.amount,
        accountId: charge.bill.accountId,
        counterAccountId: charge.bill.counterAccountId,
      });
    }

    // Watermarks last: if the entry writes fail partway, the bill still shows
    // the charges as outstanding rather than silently swallowing them.
    for (const accrual of result.accruals) {
      if (accrual.charges.length === 0) continue;
      await recurringBillRepository.markPosted(
        accrual.bill.id,
        accrual.postedThrough,
        accrual.postedCount,
      );
    }

    // One line per posting run, not one per charge. Advancing the date three
    // months posts a dozen charges and catching up on the benefactor's whole
    // term posts eighty; a log line each would bury the session's actual events
    // under the ship's standing costs. The summary names every bill and what it
    // took, which is what the log gets asked months later.
    const money = (n: number) => engine?.currency.formatAmount(n) ?? String(n);
    const perBill = result.accruals
      .filter(a => a.charges.length > 0)
      .map(a => `${a.bill.name} x${a.charges.length} ${money(a.bill.amount * a.charges.length)}`)
      .join(', ');
    await mirrorToLog(
      `Ledger: posted ${result.charges.length} recurring charge` +
        `${result.charges.length === 1 ? '' : 's'} through ${campaignDate}` +
        ` — ${money(result.total)}${perBill ? ` (${perBill})` : ''}` +
        // A capped run is not a caught-up book. The toast says so and then it is
        // gone; the log is what gets read months later, and a line reporting
        // sixty charges with no caveat reads as "the ship is paid up" when the
        // cap stopped it partway and the rest are still owed.
        (result.truncated ? '. Stopped at the per-run limit — more still due' : ''),
      '',
      'bills',
    );

    const cashAfter = await reload();
    return {
      count: result.charges.length,
      total: result.total,
      truncated: result.truncated,
      /** Cash on hand once these charges landed. Negative means overdrawn. */
      cashAfter,
    };
  }, [campaignId, campaignDate, calendar, reload, engine, mirrorToLog]);

  /** Sets the campaign's in-world date. Bills catch up on the next post. */
  const setCampaignDate = useCallback(
    async (next: string) => {
      if (!campaignId) return;
      await campaignRepository.updateCampaign(campaignId, { campaignDate: next });
      // Re-selecting the campaign is how the context reloads it; there is no
      // narrower refresh, and a stale campaign here would silently stop bills
      // accruing.
      await setActiveCampaign(campaignId);
    },
    [campaignId, setActiveCampaign],
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
    bills,
    calendar,
    campaignDate,
    setCampaignDate,
    postDueBills,
    addBill: async (data: Omit<Parameters<typeof recurringBillRepository.create>[0], 'campaignId'>) => {
      if (!campaignId) return;
      await recurringBillRepository.create({ ...data, campaignId });
      await reload();
    },
    updateBill: async (id: string, patch: Parameters<typeof recurringBillRepository.update>[1]) => {
      await recurringBillRepository.update(id, patch);
      await reload();
    },
    removeBill: async (id: string) => {
      await recurringBillRepository.softDelete(id);
      await reload();
    },
    /**
     * Opens an account, booking any opening balance as a dated entry.
     *
     * @remarks
     * The opening is an entry rather than a column on the account, for the same
     * reason it is one on import: "what did this start at" is a fact with a
     * date, and keeping it in the book means it shows up in the running
     * balance, the export and the session log like every other movement. An
     * opening stored on the account would be a second, invisible source of
     * truth that the arithmetic would have to remember to add.
     *
     * `opening` is signed — the caller has already decided that a liability's
     * is negative.
     */
    addAccount: async (input: {
      name: string;
      kind: LedgerAccount['kind'];
      note?: string;
      contingent?: boolean;
      opening?: number;
    }) => {
      if (!campaignId) return;
      const account = await ledgerAccountRepository.create({
        campaignId,
        name: input.name,
        kind: input.kind,
        note: input.note,
        contingent: input.contingent,
      });
      const opening = Math.trunc(input.opening ?? 0);
      if (opening !== 0) {
        const entry = await ledgerRepository.create({
          campaignId,
          date: new Date().toISOString().slice(0, 10),
          memo: `Opening balance — ${input.name}`,
          amount: opening,
          accountId: account.id,
          kind: 'opening',
        });
        const money = engine?.currency.formatAmount(Math.abs(opening)) ?? String(opening);
        await mirrorToLog(
          `Ledger: opened ${input.name} at ${money}`,
          entry.id,
          'entry',
        );
      }
      await reload();
    },
    /**
     * Edits an account, reconciling its opening balance.
     *
     * @remarks
     * `opening` is *set*, not added. Because the opening lives as a ledger entry
     * rather than a column, "change the opening to X" has three shapes and all
     * three have to be handled or the book quietly stops adding up: amend the
     * existing entry, write a first one, or delete it when the opening goes back
     * to zero. Writing a second entry instead of amending the first would leave
     * the account holding both, and the balance would read as their sum.
     *
     * Omitting `opening` leaves any existing opening alone — renaming an account
     * must not touch its money.
     */
    updateAccount: async (
      id: string,
      patch: {
        name?: string;
        kind?: LedgerAccount['kind'];
        note?: string;
        contingent?: boolean;
        /** Signed, already converted by the caller. */
        opening?: number;
      },
    ) => {
      if (!campaignId) return;
      const { opening, ...fields } = patch;
      if (Object.keys(fields).length > 0) {
        await ledgerAccountRepository.update(id, fields);
      }

      if (opening !== undefined) {
        const account = accounts.find(a => a.id === id);
        const name = patch.name ?? account?.name ?? 'account';
        const existing = entries.find(e => e.kind === 'opening' && e.accountId === id);
        const next = Math.trunc(opening);

        if (existing && next === 0) {
          await ledgerRepository.softDelete(existing.id);
        } else if (existing) {
          await ledgerRepository.update(existing.id, {
            amount: next,
            memo: `Opening balance — ${name}`,
          });
        } else if (next !== 0) {
          await ledgerRepository.create({
            campaignId,
            date: new Date().toISOString().slice(0, 10),
            memo: `Opening balance — ${name}`,
            amount: next,
            accountId: id,
            kind: 'opening',
          });
        }

        // Compare the before and after, not "was an opening supplied". The form
        // always supplies one, so `!existing` alone logged "set opening to Cr 0"
        // every time somebody merely renamed an account that never had an
        // opening — a log line for a change that did not happen.
        const before = existing?.amount ?? 0;
        if (before !== next) {
          const money = engine?.currency.formatAmount(Math.abs(next)) ?? String(next);
          await mirrorToLog(`Ledger: set ${name} opening balance to ${money}`, '', 'entry');
        }
      }

      await reload();
    },
    /** Returns the refusal when the account could not be removed, else `null`. */
    removeAccount: async (id: string) => {
      const refusal = await ledgerAccountRepository.softDelete(id);
      if (refusal === null) await reload();
      return refusal;
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
