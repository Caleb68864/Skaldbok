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
  note?: string;
}): Promise<LedgerAccount> {
  const now = nowISO();
  const account: LedgerAccount = {
    id: generateId(),
    campaignId: data.campaignId,
    name: data.name,
    kind: data.kind ?? 'asset',
    isPrimary: false,
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
  patch: Partial<Pick<LedgerAccount, 'name' | 'kind' | 'note'>>,
): Promise<void> {
  await db.ledgerAccounts.update(id, { ...patch, updatedAt: nowISO() });
}

/**
 * Soft-deletes an account.
 *
 * @remarks
 * Refuses to remove the primary — every unassigned entry belongs to it, and
 * deleting it would leave them counted against whatever happened to be oldest.
 * Returns `false` when it declined.
 */
export async function softDelete(id: string, txId?: string): Promise<boolean> {
  const row = await db.ledgerAccounts.get(id);
  if (!row || row.deletedAt) return false;
  if (row.isPrimary) return false;
  await db.ledgerAccounts.update(id, {
    deletedAt: nowISO(),
    softDeletedBy: txId ?? generateId(),
  });
  return true;
}

/** Restores a soft-deleted account. */
export async function restore(id: string): Promise<void> {
  await db.ledgerAccounts.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes an account. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.ledgerAccounts.delete(id);
}
