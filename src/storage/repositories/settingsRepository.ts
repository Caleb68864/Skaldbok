import { db } from '../db/client';
import type { AppSettings } from '../../types/settings';

const SETTINGS_ID = 'default';

export async function get(): Promise<AppSettings | undefined> {
  return db.appSettings.get(SETTINGS_ID);
}

export async function save(settings: AppSettings): Promise<void> {
  try {
    await db.appSettings.put({ ...settings, id: SETTINGS_ID });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      throw new Error('Storage is full. Please free up space and try again.');
    }
    throw new Error(`Failed to save settings: ${String(err)}`);
  }
}
