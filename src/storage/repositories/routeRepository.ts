import { db } from '../db/client';
import type { RouteStop } from '../../types/routeStop';
import { excludeDeleted } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import { generateId } from '../../utils/ids';

/**
 * Repository for {@link RouteStop} rows — a campaign's jump route.
 *
 * @remarks
 * Campaign-scoped and dense-ordered. Reads filter `deletedAt` unless
 * `{ includeDeleted: true }` is passed. Field values are stored generically in
 * `values`, keyed by the ids a system declares in
 * `SystemDefinition.routePlanner.fields`.
 */

const CURRENT_ROUTE_STOP_SCHEMA_VERSION = 1;

/** Lists a campaign's stops in route order, excluding soft-deleted rows unless opted in. */
export async function listByCampaign(
  campaignId: string,
  options?: { includeDeleted?: boolean },
): Promise<RouteStop[]> {
  const rows = await db.routeStops.where('campaignId').equals(campaignId).toArray();
  const visible = options?.includeDeleted ? rows : excludeDeleted(rows);
  return visible.sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

/** Fetches one stop by id; a soft-deleted row reads as absent unless opted in. */
export async function getById(
  id: string,
  options?: { includeDeleted?: boolean },
): Promise<RouteStop | undefined> {
  const row = await db.routeStops.get(id);
  if (!row) return undefined;
  if (!options?.includeDeleted && row.deletedAt) return undefined;
  return row;
}

/**
 * Appends a stop to the end of the route.
 *
 * @remarks
 * The new `order` is derived from the current live count inside a transaction,
 * so two quick taps cannot both claim the same index.
 */
export async function create(data: {
  campaignId: string;
  name: string;
  values?: Record<string, string>;
}): Promise<RouteStop> {
  return db.transaction('rw', db.routeStops, async () => {
    const existing = excludeDeleted(
      await db.routeStops.where('campaignId').equals(data.campaignId).toArray(),
    );
    const now = nowISO();
    const stop: RouteStop = {
      id: generateId(),
      campaignId: data.campaignId,
      name: data.name,
      order: existing.length,
      values: data.values ?? {},
      schemaVersion: CURRENT_ROUTE_STOP_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    };
    await db.routeStops.add(stop);
    return stop;
  });
}

/** Patches a stop's name and/or declared field values. */
export async function update(
  id: string,
  patch: Partial<Pick<RouteStop, 'name' | 'values' | 'estimatedDays' | 'arrivedOn' | 'departedOn'>>,
): Promise<void> {
  await db.routeStops.update(id, { ...patch, updatedAt: nowISO() });
}

/**
 * Adds many stops at once, appending them in the order given.
 *
 * @remarks
 * One transaction for the whole file: a half-imported route is worse than a
 * failed import, because it looks like it worked. `replace` soft-deletes the
 * existing stops in the same transaction, so the route is never briefly empty
 * and an interrupted import cannot lose the old route without adding the new.
 *
 * @param replace - Clear the campaign's current route first. Importing a route
 * planned elsewhere usually means "this is the route now", but appending is the
 * right call when adding a leg, so the caller chooses.
 */
export async function importStops(
  campaignId: string,
  stops: Array<{ name: string; values?: Record<string, string> }>,
  options?: { replace?: boolean },
): Promise<number> {
  return db.transaction('rw', db.routeStops, async () => {
    const existing = excludeDeleted(
      await db.routeStops.where('campaignId').equals(campaignId).toArray(),
    );
    const now = nowISO();

    let base = existing.length;
    if (options?.replace && existing.length > 0) {
      const txId = generateId();
      await db.routeStops.bulkUpdate(
        existing.map(s => ({ key: s.id, changes: { deletedAt: now, softDeletedBy: txId } })),
      );
      base = 0;
    }

    await db.routeStops.bulkAdd(
      stops.map((stop, i) => ({
        id: generateId(),
        campaignId,
        name: stop.name,
        order: base + i,
        values: stop.values ?? {},
        schemaVersion: CURRENT_ROUTE_STOP_SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return stops.length;
  });
}

/**
 * Persists a whole new route order.
 *
 * @remarks
 * Writes every affected row inside **one** transaction: a partial write would
 * leave two stops sharing an index, and the list would render in an order
 * nobody chose.
 *
 * @param orderedIds - Every live stop id for the campaign, in the new order.
 */
export async function reorder(campaignId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.routeStops, async () => {
    const now = nowISO();
    const current = excludeDeleted(
      await db.routeStops.where('campaignId').equals(campaignId).toArray(),
    );
    const live = new Set(current.map(s => s.id));
    const changes = orderedIds
      .filter(id => live.has(id))
      .map((id, index) => ({ key: id, changes: { order: index, updatedAt: now } }));
    await db.routeStops.bulkUpdate(changes);
  });
}

/**
 * Soft-deletes a stop and closes the gap it leaves in the ordering.
 *
 * @param txId - Pass an existing transaction id to enlist this row in a wider
 * cascade, following `campaignRepository`'s signature.
 */
export async function softDelete(id: string, txId?: string): Promise<void> {
  await db.transaction('rw', db.routeStops, async () => {
    const row = await db.routeStops.get(id);
    if (!row || row.deletedAt) return;
    const now = nowISO();
    await db.routeStops.update(id, { deletedAt: now, softDeletedBy: txId ?? generateId() });

    const remaining = excludeDeleted(
      await db.routeStops.where('campaignId').equals(row.campaignId).toArray(),
    ).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
    await db.routeStops.bulkUpdate(
      remaining
        .map((s, index) => ({ key: s.id, changes: { order: index, updatedAt: now } }))
        .filter((c, i) => remaining[i].order !== c.changes.order),
    );
  });
}

/**
 * Restores a soft-deleted stop.
 *
 * @remarks
 * Appends it to the end rather than trying to reclaim its original index —
 * the route has moved on, and forcing it back into a position that no longer
 * exists would renumber everything around it.
 */
export async function restore(id: string): Promise<void> {
  await db.transaction('rw', db.routeStops, async () => {
    const row = await db.routeStops.get(id);
    if (!row) return;
    const live = excludeDeleted(
      await db.routeStops.where('campaignId').equals(row.campaignId).toArray(),
    );
    await db.routeStops.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      order: live.length,
      updatedAt: nowISO(),
    });
  });
}

/** Permanently removes a stop. Internal — never call from UI. */
export async function hardDelete(id: string): Promise<void> {
  await db.routeStops.delete(id);
}
