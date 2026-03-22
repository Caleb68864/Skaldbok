import { db } from '../db/client';
import { generateId } from '../../utils/ids';

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
