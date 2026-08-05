/**
 * Storage durability for a local-first app.
 *
 * @remarks
 * Skaldbok treats IndexedDB as the source of truth — there is no server to
 * reconcile against. By default a browser classifies origin storage as
 * **best-effort**, which it may evict under storage pressure with no prompt and
 * no warning. For an app whose only copy of a campaign lives there, that is the
 * difference between "your data is probably fine" and "your data is protected".
 *
 * Chrome usually grants persistence automatically to an installed PWA. This app
 * is frequently *not* installed as one — it is served from a self-signed LAN
 * origin, which Google's WebAPK minting service cannot reach, so it commonly
 * runs as a plain bookmark shortcut. Asking explicitly is therefore not
 * redundant with installing; it is the only reliable path.
 */

/** Outcome of a persistence request. */
export interface StoragePersistence {
  /** Whether the browser exposes the Storage API at all. */
  supported: boolean;
  /** Whether storage is now exempt from eviction under pressure. */
  persisted: boolean;
}

/**
 * Asks the browser to exempt this origin's storage from eviction.
 *
 * @remarks
 * Idempotent and safe to call on every start: it checks the existing grant
 * first, so a granted origin never re-prompts. A denial is not an error — some
 * browsers decide on engagement heuristics and may grant later — so this
 * resolves with `persisted: false` rather than throwing, and the caller decides
 * whether to say anything.
 */
export async function ensurePersistentStorage(): Promise<StoragePersistence> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return { supported: false, persisted: false };
  }
  try {
    if (await navigator.storage.persisted?.()) {
      return { supported: true, persisted: true };
    }
    return { supported: true, persisted: await navigator.storage.persist() };
  } catch {
    // A throwing Storage API must never stop the app booting — the worst case
    // is the storage we already had, on best-effort terms.
    return { supported: false, persisted: false };
  }
}

/** Current persistence state, without requesting anything. */
export async function readStoragePersistence(): Promise<StoragePersistence> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return { supported: false, persisted: false };
  }
  try {
    return { supported: true, persisted: await navigator.storage.persisted() };
  } catch {
    return { supported: false, persisted: false };
  }
}

/** Bytes used and available to this origin, or `null` when unknown. */
export interface StorageEstimate {
  usage: number;
  quota: number;
}

/**
 * Reads how much storage the app occupies against its quota.
 *
 * @remarks
 * Both figures are deliberately coarse — browsers pad them to avoid
 * fingerprinting — so treat this as an order of magnitude for a Settings
 * readout, not an accounting figure.
 */
export async function readStorageEstimate(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (typeof usage !== 'number' || typeof quota !== 'number') return null;
    return { usage, quota };
  } catch {
    return null;
  }
}

/** Formats a byte count for display, e.g. `4.2 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
