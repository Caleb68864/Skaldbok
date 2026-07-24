import { generateId } from './ids';

/**
 * Drops soft-deleted rows from a query result.
 *
 * @remarks
 * The shared filter every repository read path runs so deleted rows never leak
 * into the UI. Any read that neither calls this nor filters `deletedAt` inline
 * is a bug — see the Soft Deletes convention. Rows carrying a `deletedAt`
 * timestamp are excluded; a `null`/`undefined` timestamp means live.
 */
export function excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

/**
 * Mints the transaction id shared by every row deleted together in one cascade.
 *
 * @remarks
 * Stamped into `softDeletedBy` so a later `restore` can bring back exactly the
 * rows that went down together, atomically. Just a UUID; a distinct name marks
 * the intent at call sites.
 */
export function generateSoftDeleteTxId(): string {
  return generateId();
}
