import { db } from '../db/client';
import type { LedgerEntry, LedgerLeg, SplitSnapshot } from '../../types/ledger';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';
import { createDeletedListing, createHardDelete, createSoftDeleteOps } from './createRepository';

/**
 * Repository for {@link LedgerEntry} rows — a campaign's shared cashbook.
 *
 * @remarks
 * Campaign-scoped, following the {@link storage/repositories/shipRepository | ship}
 * precedent. Reads filter `deletedAt` unless `{ includeDeleted: true }` is
 * passed, and `listByCampaign` returns entries already in fold order so no
 * caller has to re-derive it.
 *
 * The running balance is **not** stored here — it is folded on read by
 * `utils/ledgerMath.computeRunningBalance`, so an edited or restored row can
 * never leave a stale total behind.
 */

const CURRENT_LEDGER_ENTRY_SCHEMA_VERSION = 1;

/** Orders entries the way the cashbook reads: date, then creation, then id. */
function inFoldOrder(rows: LedgerEntry[]): LedgerEntry[] {
  return [...rows].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

/** Lists a campaign's entries in fold order, excluding soft-deleted rows unless opted in. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<LedgerEntry[]> {
  const rows = await db.ledgerEntries.where('campaignId').equals(campaignId).toArray();
  return inFoldOrder(options?.includeDeleted ? rows : excludeDeleted(rows));
}

/** Fetches one entry by id; a soft-deleted row reads as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<LedgerEntry | undefined> {
  const row = await db.ledgerEntries.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

/**
 * Records one movement of money.
 *
 * @param data - `amount` is signed: positive is money in, negative is out. The
 * UI presents two columns and negates on write, so a user never types a sign.
 * `gross`, `legs` and `splitSnapshot` are present only on a distribution.
 */
export async function create(data: {
  campaignId: string;
  date: string;
  memo?: string;
  amount: number;
  gross?: number;
  legs?: LedgerLeg[];
  splitSnapshot?: SplitSnapshot;
  accountId?: string;
  counterAccountId?: string;
  kind?: 'opening';
}): Promise<LedgerEntry> {
  const now = nowISO();
  const entry: LedgerEntry = {
    id: generateId(),
    campaignId: data.campaignId,
    date: data.date,
    memo: data.memo ?? '',
    amount: data.amount,
    ...(data.accountId ? { accountId: data.accountId } : {}),
    ...(data.counterAccountId ? { counterAccountId: data.counterAccountId } : {}),
    ...(data.kind ? { kind: data.kind } : {}),
    ...(data.gross !== undefined ? { gross: data.gross } : {}),
    ...(data.legs ? { legs: data.legs } : {}),
    // Deep-copied by the caller before it gets here; copied again so a later
    // edit to the live split object cannot reach into stored history.
    ...(data.splitSnapshot
      ? { splitSnapshot: structuredClone(data.splitSnapshot) as SplitSnapshot }
      : {}),
    schemaVersion: CURRENT_LEDGER_ENTRY_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await db.ledgerEntries.add(entry);
  return entry;
}

/** Patches an entry's editable fields. */
export async function update(
  id: string,
  patch: Partial<Pick<LedgerEntry, 'date' | 'memo' | 'amount'>>,
): Promise<void> {
  await db.ledgerEntries.update(id, { ...patch, updatedAt: nowISO() });
}

const lifecycle = createSoftDeleteOps({
  repository: 'ledgerRepository',
  table: 'ledgerEntries',
});

/**
 * Soft-deletes an entry (the user-facing delete).
 *
 * @remarks
 * The doc comment here used to note that the wider `(id, txId?)` signature
 * followed `campaignRepository` "rather than `shipRepository`'s narrower one" —
 * a divergence recorded rather than closed. Both come from the factory now, so
 * there is no narrower one to choose against. The re-delete guard arrives with
 * it: this used to re-stamp `softDeletedBy` on an already-deleted row, which
 * strands the splits that went down with it in the first cascade.
 *
 * @param id - Entry to delete.
 * @param txId - Cascade to join, when a parent is taking this entry down too.
 */
export const softDelete = lifecycle.softDelete;

/** Restores a soft-deleted entry. */
export const restore = lifecycle.restore;

/**
 * Every soft-deleted LedgerEntry in a campaign, newest deletion first.
 *
 * @remarks
 * Feeds the Trash screen, which is the only way a user gets one of these back.
 * A deleted entry still has its legs and split snapshot on the row, so a
 * restore puts the running balance back where it was.
 */
export const getDeleted = createDeletedListing<LedgerEntry>({
  repository: 'ledgerRepository',
  table: 'ledgerEntries',
  scopeIndex: 'campaignId',
});

/** Permanently removes an entry. Internal — never call from UI. */
export const hardDelete = createHardDelete({
  repository: 'ledgerRepository',
  table: 'ledgerEntries',
});
