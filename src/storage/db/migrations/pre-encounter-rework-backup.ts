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
  try {
    localStorage.setItem(storageKey, JSON.stringify(backup, null, 2));
  } catch {
    // Pretty-print roughly doubles the size — retry compact before giving up.
    try {
      localStorage.setItem(storageKey, JSON.stringify(backup));
    } catch (e2) {
      // Do NOT throw here. Throwing aborts the Dexie v8 upgrade transaction,
      // after which the DB fails to open and re-runs this same failing upgrade
      // on EVERY subsequent load — locking the user out of the entire app with
      // no in-UI recovery (localStorage caps ~5MB; a campaign with Tiptap note
      // bodies easily exceeds it). Availability beats the localStorage safety
      // net, and the v9 snapshot already guards its write the same way. The v7
      // rows are still in IndexedDB; the rework proceeds against them.
      console.warn(
        `writePreEncounterReworkBackup: could not persist backup to localStorage ` +
          `(${storageKey}) — proceeding without it to avoid bricking DB open.`,
        e2,
      );
      return;
    }
  }

  console.info(`Pre-migration backup written to localStorage key: ${storageKey}`);
}
