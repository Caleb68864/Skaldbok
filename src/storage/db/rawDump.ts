import { nowISO } from '../../utils/dates';

/**
 * A raw copy of the database, read without Dexie.
 *
 * @remarks
 * For the storage-unavailable screen. When a schema upgrade throws, Dexie
 * cannot open the database and the only action the app offered was Reload,
 * which runs the same upgrade again (roadmap Q, recorded: "a throwing
 * migration leaves only Reload"). A failed upgrade rolls back, so the data is
 * still there at its old version, and IndexedDB will open it if asked for no
 * particular version. This reads every object store as it is and returns it,
 * Blobs as data URLs, so the user can keep a copy before trying anything else.
 *
 * Read-only: no version is requested, and if the database does not exist the
 * open's upgrade is aborted so none is created.
 *
 * **Decided by agent 2026-11-21 (owner may revisit):** the recovery surface is
 * a download of the raw rows, not an in-app repair. It changes nothing, so it
 * is safe to offer whatever the failure was; it is not an importable backup.
 */

/** The database the app keeps everything in (`SkaldbokDatabase`). */
export const DATABASE_NAME = 'skaldbok-db';

/** Every object store's rows, keyed by store name, plus what was read. */
export interface RawDatabaseDump {
  database: string;
  version: number;
  exportedAt: string;
  stores: Record<string, unknown[]>;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/** Replaces Blobs anywhere in a row with data URLs, so the row survives JSON. */
async function serialisable(value: unknown): Promise<unknown> {
  if (typeof Blob !== 'undefined' && value instanceof Blob) return blobToDataUrl(value);
  if (Array.isArray(value)) return Promise.all(value.map(serialisable));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await serialisable(v);
    return out;
  }
  return value;
}

/**
 * Reads every object store of the database without upgrading it.
 *
 * @param factory - The IndexedDB factory; a parameter for the test.
 * @param name - The database to read.
 * @returns Every row of every store. A database that does not exist yields no stores.
 */
export async function dumpRawDatabase(
  factory: IDBFactory = indexedDB,
  name: string = DATABASE_NAME,
): Promise<RawDatabaseDump> {
  const open = factory.open(name);
  let created = false;
  open.onupgradeneeded = () => {
    // No version was asked for, so this only fires for a database that did not
    // exist. Abort rather than create an empty one.
    created = true;
    open.transaction?.abort();
  };
  let db: IDBDatabase;
  try {
    db = await request(open);
  } catch (e) {
    if (created) return { database: name, version: 0, exportedAt: nowISO(), stores: {} };
    throw e;
  }
  try {
    const names = Array.from(db.objectStoreNames);
    const stores: Record<string, unknown[]> = {};
    if (names.length > 0) {
      // Every read is issued before anything else is awaited: a transaction
      // closes once it has no pending request, and converting a Blob awaits.
      const tx = db.transaction(names, 'readonly');
      const reads = names.map((storeName) => request(tx.objectStore(storeName).getAll()));
      const results = await Promise.all(reads);
      for (let i = 0; i < names.length; i++) {
        stores[names[i]!] = (await serialisable(results[i])) as unknown[];
      }
    }
    return { database: name, version: db.version, exportedAt: nowISO(), stores };
  } finally {
    db.close();
  }
}
