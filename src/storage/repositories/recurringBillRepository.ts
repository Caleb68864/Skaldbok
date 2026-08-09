import { db } from '../db/client';
import type { RecurringBill } from '../../types/recurringBill';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for {@link RecurringBill} rows — the costs that come round again.
 *
 * @remarks
 * The bills themselves are templates; the charges they produce are ordinary
 * ledger entries written by `useLedger`. Nothing here posts anything, so a bill
 * can be edited, paused or deleted without touching the money already booked.
 */

const CURRENT_RECURRING_BILL_SCHEMA_VERSION = 1;

/** Lists a campaign's bills, oldest first. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<RecurringBill[]> {
  const rows = await db.recurringBills.where('campaignId').equals(campaignId).toArray();
  const visible = options?.includeDeleted ? rows : excludeDeleted(rows);
  return visible.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** Creates a bill. */
export async function create(data: {
  campaignId: string;
  name: string;
  amount: number;
  everyDays?: number;
  startDate?: string;
  accountId?: string;
  counterAccountId?: string;
  occurrenceLimit?: number;
  note?: string;
}): Promise<RecurringBill> {
  const now = nowISO();
  const bill: RecurringBill = {
    id: generateId(),
    campaignId: data.campaignId,
    name: data.name,
    amount: Math.abs(Math.trunc(data.amount)),
    everyDays: data.everyDays && data.everyDays > 0 ? Math.trunc(data.everyDays) : 30,
    startDate: data.startDate ?? '',
    postedThrough: '',
    postedCount: 0,
    active: true,
    note: data.note ?? '',
    ...(data.accountId ? { accountId: data.accountId } : {}),
    ...(data.counterAccountId ? { counterAccountId: data.counterAccountId } : {}),
    ...(data.occurrenceLimit !== undefined ? { occurrenceLimit: data.occurrenceLimit } : {}),
    schemaVersion: CURRENT_RECURRING_BILL_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
  await db.recurringBills.add(bill);
  return bill;
}

/** Patches a bill's terms. */
export async function update(
  id: string,
  patch: Partial<
    Pick<
      RecurringBill,
      | 'name'
      | 'amount'
      | 'everyDays'
      | 'startDate'
      | 'accountId'
      | 'counterAccountId'
      | 'occurrenceLimit'
      | 'active'
      | 'note'
    >
  >,
): Promise<void> {
  await db.recurringBills.update(id, { ...patch, updatedAt: nowISO() });
}

/**
 * Moves a bill's watermark after its charges have been written.
 *
 * @remarks
 * Kept separate from {@link update} because it is not an edit — it is the record
 * of what has already been charged, and confusing the two is how a bill ends up
 * either double-charging or silently skipping a month.
 */
export async function markPosted(
  id: string,
  postedThrough: string,
  postedCount: number,
): Promise<void> {
  await db.recurringBills.update(id, { postedThrough, postedCount, updatedAt: nowISO() });
}

/** Soft-deletes a bill. Charges already posted are untouched. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  await db.recurringBills.update(id, {
    deletedAt: nowISO(),
    softDeletedBy: txId ?? generateId(),
  });
}

/** Restores a soft-deleted bill. */
export async function restore(id: string): Promise<void> {
  await db.recurringBills.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes a bill. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.recurringBills.delete(id);
}
