import { db } from '../db/client';
import type { RoutePlan } from '../../types/routePlan';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for a campaign's journey-level route schedule — one live row.
 *
 * @remarks
 * Same shape as `ledgerSplitRepository`: created lazily, collapses duplicates
 * under a concurrent first read, and never hands the screen a null.
 */

const CURRENT_ROUTE_PLAN_SCHEMA_VERSION = 1;

/**
 * Returns a campaign's route plan, creating a blank one on first read.
 *
 * @remarks
 * Idempotent under a concurrent first read: more than one live row means keeping
 * the oldest and soft-deleting the rest, rather than assuming the race cannot
 * happen. The whole read-decide-write runs in one transaction.
 */
export async function getOrCreateForCampaign(campaignId: string): Promise<RoutePlan> {
  return db.transaction('rw', db.routePlans, async () => {
    const rows = excludeDeleted(
      await db.routePlans.where('campaignId').equals(campaignId).toArray(),
    ).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

    if (rows.length > 0) {
      const [keep, ...duplicates] = rows;
      if (duplicates.length > 0) {
        const txId = generateId();
        const now = nowISO();
        await db.routePlans.bulkUpdate(
          duplicates.map(d => ({ key: d.id, changes: { deletedAt: now, softDeletedBy: txId } })),
        );
      }
      return keep;
    }

    const now = nowISO();
    const plan: RoutePlan = {
      id: generateId(),
      campaignId,
      startDate: '',
      targetDate: '',
      targetNote: '',
      schemaVersion: CURRENT_ROUTE_PLAN_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    await db.routePlans.add(plan);
    return plan;
  });
}

/** Patches the journey's start, deadline, or what the deadline is for. */
export async function update(
  id: string,
  patch: Partial<Pick<RoutePlan, 'startDate' | 'targetDate' | 'targetNote'>>,
): Promise<void> {
  await db.routePlans.update(id, { ...patch, updatedAt: nowISO() });
}

/** Soft-deletes a plan. Enlist in a wider cascade via `txId`. */
export async function softDelete(id: string, txId?: string): Promise<void> {
  await db.routePlans.update(id, { deletedAt: nowISO(), softDeletedBy: txId ?? generateId() });
}

/** Restores a soft-deleted plan. */
export async function restore(id: string): Promise<void> {
  await db.routePlans.update(id, { deletedAt: undefined, softDeletedBy: undefined });
}

/** Permanently removes a plan. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.routePlans.delete(id);
}
