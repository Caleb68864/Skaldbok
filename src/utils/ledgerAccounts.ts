import type { LedgerEntry } from '../types/ledger';
import type { LedgerAccount } from '../types/ledgerAccount';

/**
 * Balances across a campaign's named accounts.
 *
 * @remarks
 * Pure, and derived on every read like the running balance — a stored balance
 * goes stale the moment an entry is edited or restored, and this one has more
 * ways to go stale than most.
 *
 * The sign convention is the only thing here worth reading twice:
 *
 * - An **asset** holds what you have. Positive is money in hand.
 * - A **liability** holds what you owe, as a **negative** number. Owing forty
 *   million is `-40_000_000`, and paying it down moves it *toward* zero.
 *
 * That falls out of the transfer rule rather than being special-cased: the
 * counter side of an entry receives the opposite sign, so a payment of
 * `-201,335` against Cash adds `+201,335` to the loan. One rule, no exceptions,
 * and no branch on account kind anywhere in the arithmetic.
 */

/** An account with its computed balance. */
export interface AccountBalance {
  account: LedgerAccount;
  /** Signed. Negative on a liability means that much is still owed. */
  balance: number;
  /** How many entries touched it, either side. */
  entryCount: number;
}

/** Everything the accounts panel needs. */
export interface AccountSummary {
  balances: AccountBalance[];
  /** The primary account, or `null` when a campaign has none yet. */
  primary: LedgerAccount | null;
  /** Assets minus what is owed — what the crew is actually worth. */
  netWorth: number;
  /** Total of the asset accounts alone. */
  totalAssets: number;
  /** Total still owed, as a positive number for display. Excludes contingent debt. */
  totalOwed: number;
  /**
   * Debt owed only if something goes wrong, as a positive number.
   *
   * @remarks
   * Reported separately and kept out of {@link netWorth}. Real accounting
   * discloses a contingent liability rather than booking it, and booking the
   * benefactor's mortgage cover would make the crew look bankrupt for money they
   * will probably never pay.
   */
  totalAtRisk: number;
}

/** The account an entry belongs to when it names none. */
export function primaryAccount(accounts: LedgerAccount[]): LedgerAccount | null {
  return accounts.find(a => a.isPrimary) ?? accounts[0] ?? null;
}

/**
 * Folds every entry into per-account balances.
 *
 * @remarks
 * An entry naming an account that no longer exists is counted against the
 * primary rather than dropped. Losing money from the books because somebody
 * deleted an account is worse than showing it in the wrong pot, and the total
 * stays honest either way.
 *
 * A transfer whose two sides name the *same* account is a no-op by
 * construction: `+amount` then `-amount`. That is correct — it is a mistake the
 * user made, and silently netting to zero is better than double-counting it.
 */
export function computeAccountBalances(
  accounts: LedgerAccount[],
  entries: LedgerEntry[],
): AccountSummary {
  const primary = primaryAccount(accounts);
  const byId = new Map(accounts.map(a => [a.id, a]));
  const totals = new Map<string, { balance: number; entryCount: number }>();
  for (const account of accounts) totals.set(account.id, { balance: 0, entryCount: 0 });

  const resolve = (id: string | undefined): string | null => {
    if (id && byId.has(id)) return id;
    return primary?.id ?? null;
  };

  for (const entry of entries) {
    const near = resolve(entry.accountId);
    if (near) {
      const row = totals.get(near)!;
      row.balance += entry.amount;
      row.entryCount += 1;
    }

    if (entry.counterAccountId && byId.has(entry.counterAccountId)) {
      const row = totals.get(entry.counterAccountId)!;
      row.balance -= entry.amount;
      row.entryCount += 1;
    }
  }

  const balances: AccountBalance[] = accounts.map(account => ({
    account,
    balance: totals.get(account.id)?.balance ?? 0,
    entryCount: totals.get(account.id)?.entryCount ?? 0,
  }));

  const totalAssets = balances
    .filter(b => b.account.kind === 'asset')
    .reduce((sum, b) => sum + b.balance, 0);
  // Liabilities are held negative; report the debt as a positive figure so the
  // UI never has to print "owed -39,798,665".
  // `|| 0` on each: negating a zero total yields -0, which renders as "-0" and
  // compares unequal to 0 under Object.is. Third time this has bitten in this
  // codebase — see `ledgerMath.computeDistribution`.
  const totalOwed =
    -balances
      .filter(b => b.account.kind === 'liability' && !b.account.contingent)
      .reduce((sum, b) => sum + b.balance, 0) || 0;
  const totalAtRisk =
    -balances
      .filter(b => b.account.kind === 'liability' && b.account.contingent)
      .reduce((sum, b) => sum + b.balance, 0) || 0;

  return {
    balances,
    primary,
    totalAssets,
    totalOwed,
    totalAtRisk,
    netWorth: totalAssets - totalOwed,
  };
}

/**
 * The entries belonging to one account, either side of a transfer.
 *
 * @remarks
 * The sign is flipped for entries where this account is the *counter* side, so
 * the column always reads from that account's point of view. A mortgage payment
 * shows as money out of Cash and money in against the loan, which is what each
 * account actually experienced.
 */
export function entriesForAccount(
  accountId: string,
  isPrimary: boolean,
  entries: LedgerEntry[],
): Array<LedgerEntry & { signedForAccount: number }> {
  const rows: Array<LedgerEntry & { signedForAccount: number }> = [];
  for (const entry of entries) {
    const belongsNear = entry.accountId === accountId || (isPrimary && !entry.accountId);
    if (belongsNear) rows.push({ ...entry, signedForAccount: entry.amount });
    else if (entry.counterAccountId === accountId) {
      rows.push({ ...entry, signedForAccount: -entry.amount });
    }
  }
  return rows;
}
