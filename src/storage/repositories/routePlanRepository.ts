import { db } from '../db/client';
import type { RoutePlan } from '../../types/routePlan';
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';
import { createHardDelete, createSoftDeleteOps } from './createRepository';

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
        const txId = generateSoftDeleteTxId();
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

/**
 * Lists a campaign's route plan rows without creating one.
 *
 * @remarks
 * The read-only counterpart to {@link getOrCreateForCampaign}, for callers that
 * must not write — an export has to be able to observe that a campaign has no
 * plan rather than bring one into existence while backing the campaign up.
 */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<RoutePlan[]> {
  const rows = await db.routePlans.where('campaignId').equals(campaignId).toArray();
  return options?.includeDeleted ? rows : excludeDeleted(rows);
}

/** Patches the journey's start, deadline, or what the deadline is for. */
export async function update(
  id: string,
  patch: Partial<Pick<RoutePlan, 'startDate' | 'targetDate' | 'targetNote'>>,
): Promise<void> {
  await db.routePlans.update(id, { ...patch, updatedAt: nowISO() });
}

const lifecycle = createSoftDeleteOps({
  repository: 'routePlanRepository',
  table: 'routePlans',
});

/**
 * Soft-deletes a plan. Enlist in a wider cascade via `txId`.
 *
 * @param id - Plan to delete.
 * @param txId - Cascade to join.
 */
export const softDelete = lifecycle.softDelete;

/** Restores a soft-deleted plan. */
export const restore = lifecycle.restore;

/**
 * Permanently removes a plan. Internal — never call from UI.
 *
 * @remarks
 * No `getDeleted`, for the same reason as `ledgerSplitRepository`: a campaign
 * has one live plan created lazily on first read, so a tombstoned one is a
 * collapsed duplicate rather than something a user chose to delete.
 */
export const hardDelete = createHardDelete({
  repository: 'routePlanRepository',
  table: 'routePlans',
});
