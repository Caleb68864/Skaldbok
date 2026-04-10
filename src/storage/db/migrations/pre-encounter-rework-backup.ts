import type { Transaction } from 'dexie';

/**
 * Write a full JSON dump of all domain tables to localStorage
 * before the v8 destructive migration runs.
 *
 * Throws if the write fails, which will abort the containing
 * Dexie upgrade transaction and leave the database at v7.
 *
 * NOTE on backup target: the master spec calls for a `tmp-backup/`
 * filesystem path, but Dexie upgrades run in the browser with no
 * filesystem access. The in-browser equivalent is a namespaced
 * localStorage key. A future restore UI can read the key and offer
 * the JSON as a Blob download.
 */
export async function writePreEncounterReworkBackup(tx: Transaction): Promise<void> {
  const tables = [
    'encounters',
    'notes',
    'entityLinks',
    'creatureTemplates',
    'characters',
    'sessions',
    'campaigns',
    'parties',
    'partyMembers',
  ] as const;

  const backup: Record<string, unknown[]> = {};
  for (const name of tables) {
    try {
      backup[name] = await tx.table(name).toArray();
    } catch (e) {
      // Table may not exist in older schemas; record the skip but do not abort.
      console.warn(`writePreEncounterReworkBackup: table ${name} not readable, skipping`, e);
      backup[name] = [];
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const filename = `pre-encounter-rework-${date}.json`;
  const storageKey = `forge:backup:${filename}`;
  const json = JSON.stringify(backup, null, 2);

  try {
    localStorage.setItem(storageKey, json);
  } catch (e) {
    throw new Error(
      `Pre-migration backup failed to write to localStorage (${storageKey}). ` +
        `Aborting migration to preserve v7 data. Error: ${String(e)}`,
    );
  }

  console.info(`Pre-migration backup written to localStorage key: ${storageKey}`);
}
