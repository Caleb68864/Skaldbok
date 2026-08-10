import { db } from '../db/client';
import type { LedgerAccount } from '../../types/ledgerAccount';
import { DEFAULT_PRIMARY_ACCOUNT_NAME } from '../../types/ledgerAccount';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for a campaign's named ledger accounts.
 *
 * @remarks
 * Every campaign has at least one — the primary — created on first read so no
 * screen ever has to cope with a campaign that has money but nowhere to put it.
 */

const CURRENT_LEDGER_ACCOUNT_SCHEMA_VERSION = 1;

/** Lists a campaign's accounts, primary first, then by creation. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<LedgerAccount[]> {
  const rows = await db.ledgerAccounts.where('campaignId').equals(campaignId).toArray();
  const visible = options?.includeDeleted ? rows : excludeDeleted(rows);
  return visible.sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Returns a campaign's accounts, creating the primary on first read.
 *
 * @remarks
 * Idempotent under a concurrent first read, and additionally **repairs** a
 * campaign whose accounts somehow have no primary — promoting the oldest rather
 * than leaving every unassigned entry homeless. An entry naming no account has
 * to land somewhere, and "nowhere" would silently drop it from the balance.
 */
export async function ensureForCampaign(campaignId: string): Promise<LedgerAccount[]> {
  return db.transaction('rw', db.ledgerAccounts, async () => {
    const rows = excludeDeleted(
      await db.ledgerAccounts.where('campaignId').equals(campaignId).toArray(),
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    if (rows.length === 0) {
      const now = nowISO();
      const primary: LedgerAccount = {
        id: generateId(),
        campaignId,
        name: DEFAULT_PRIMARY_ACCOUNT_NAME,
        kind: 'asset',
        isPrimary: true,
        contingent: false,
        note: '',
        schemaVersion: CURRENT_LEDGER_ACCOUNT_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      };
      await db.ledgerAccounts.add(primary);
      return [primary];
    }

    const primaries = rows.filter(r => r.isPrimary);
    if (primaries.length === 0) {
      await db.ledgerAccounts.update(rows[0].id, { isPrimary: true, updatedAt: nowISO() });
      rows[0] = { ...rows[0], isPrimary: true };
    } else if (primaries.length > 1) {
      // Two primaries would make "the account an entry belongs to" ambiguous.
      const now = nowISO();
      await db.ledgerAccounts.bulkUpdate(
        primaries.slice(1).map(p => ({ key: p.id, changes: { isPrimary: false, updatedAt: now } })),
      );
      for (const extra of primaries.slice(1)) {
        const i = rows.findIndex(r => r.id === extra.id);
        if (i >= 0) rows[i] = { ...rows[i], isPrimary: false };
      }
    }

    return rows.sort(
      (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.localeCompare(b.createdAt),
    );
  });
}

/** Creates an account. */
export async function create(data: {
  campaignId: string;
  name: string;
  kind?: LedgerAccount['kind'];
  contingent?: boolean;
  note?: string;
}): Promise<LedgerAccount> {
  const now = nowISO();
  const account: LedgerAccount = {
    id: generateId(),
    campaignId: data.campaignId,
    name: data.name,
    kind: data.kind ?? 'asset',
    isPrimary: false,
    contingent: data.contingent ?? false,
    note: data.note ?? '',
    schemaVersion: CURRENT_LEDGER_ACCOUNT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await db.ledgerAccounts.add(account);
  return account;
}

/** Patches an account's name, kind or note. */
export async function update(
  id: string,
  patch: Partial<Pick<LedgerAccount, 'name' | 'kind' | 'note' | 'contingent'>>,
): Promise<void> {
  await db.ledgerAccounts.update(id, { ...patch, updatedAt: nowISO() });
}

/** Why a {@link softDelete} declined, or `null` when it went ahead. */
export type AccountDeleteRefusal =
  | { reason: 'missing' }
  | { reason: 'primary' }
  | { reason: 'has-entries'; entryCount: number };

/**
 * Soft-deletes an account.
 *
 * @remarks
 * Refuses in three cases, returning why so the caller can say so.
 *
 * The primary is refused because every unassigned entry belongs to it, and
 * deleting it would leave them counted against whatever happened to be oldest.
 *
 * An account with entries is refused because deleting it **unbalances the
 * book**. The row is soft-deleted but its entries keep pointing at it, and both
 * the accounts panel and the cash-on-hand fold walk only live accounts — so the
 * money silently leaves the totals while the entries stay listed in the table,
 * and the ledger stops adding up. Real bookkeeping does not delete an account
 * with transactions in it either. Delete or reassign the entries first.
 *
 * Reassigning them here instead was the tempting alternative and is wrong: the
 * only sane target is the primary, and moving a *liability's* entries onto cash
 * would turn a debt into spending.
 */
export async function softDelete(
  id: string,
  txId?: string,
): Promise<AccountDeleteRefusal | null> {
  const row = await db.ledgerAccounts.get(id);
  if (!row || row.deletedAt) return { reason: 'missing' };
  if (row.isPrimary) return { reason: 'primary' };

  // Scanned in memory off the indexed `campaignId` rather than queried by
  // account: `accountId` and `counterAccountId` are deliberately unindexed on
  // `ledgerEntries` (see the schema note in db/client.ts), so `.where` on either
  // would throw. One campaign's entries is a small set — this runs on a delete,
  // not on every read.
  const campaignEntries = await db.ledgerEntries
    .where('campaignId')
    .equals(row.campaignId)
    .toArray();
  const live = excludeDeleted(campaignEntries).filter(
    e => e.accountId === id || e.counterAccountId === id,
  );
  if (live.length > 0) return { reason: 'has-entries', entryCount: live.length };

  await db.ledgerAccounts.update(id, {
    deletedAt: nowISO(),
    softDeletedBy: txId ?? generateId(),
  });
  return null;
}

/** Restores a soft-deleted account. */
export async function restore(id: string): Promise<void> {
  await db.ledgerAccounts.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes an account. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.ledgerAccounts.delete(id);
}
