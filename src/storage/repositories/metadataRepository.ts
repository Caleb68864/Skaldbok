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
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to get metadata: ${String(err)}`);
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
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to set metadata: ${String(err)}`);
  }
}
