import { db } from '../db/client';
import { generateId } from '../../utils/ids';

/**
 * Reads an app-level key/value metadata string.
 *
 * @remarks
 * The metadata table is a small key-value store used for cross-cutting flags —
 * notably one-time migration guards (e.g. `migration_v6_combat`) — not domain
 * data. Returns `undefined` when the key is unset.
 */
export async function get(key: string): Promise<string | undefined> {
  try {
    const record = await db.metadata.where('key').equals(key).first();
    return record?.value;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.', { cause: err });
    }
    throw new Error(`Failed to get metadata: ${String(err)}`, { cause: err });
  }
}

/** Upserts a metadata key/value pair, creating the row if the key is new. */
export async function set(key: string, value: string): Promise<void> {
  try {
    const existing = await db.metadata.where('key').equals(key).first();
    if (existing) {
      await db.metadata.update(existing.id, { value });
    } else {
      await db.metadata.put({ id: generateId(), key, value });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.', { cause: err });
    }
    throw new Error(`Failed to set metadata: ${String(err)}`, { cause: err });
  }
}

/** Atomically reserve one future request slot across browser tabs and reloads. */
export async function reserveRateLimitSlot(key: string, intervalMs: number, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.metadata, async () => {
    const existing = await db.metadata.where('key').equals(key).first();
    const previous = Number(existing?.value);
    const slot = Math.max(now, Number.isFinite(previous) ? previous : now);
    const next = String(slot + intervalMs);
    if (existing) await db.metadata.update(existing.id, { value: next });
    else await db.metadata.add({ id: generateId(), key, value: next });
    return slot;
  });
}
