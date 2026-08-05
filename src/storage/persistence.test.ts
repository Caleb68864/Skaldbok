import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePersistentStorage,
  formatBytes,
  readStorageEstimate,
  readStoragePersistence,
} from './persistence';

/**
 * Storage durability, which is the difference between "the browser may delete
 * your campaigns" and "it may not".
 *
 * @remarks
 * The behaviour worth pinning is the short-circuit: an origin that already holds
 * the grant must never call `persist()` again. Some browsers surface a prompt on
 * that call, and re-prompting a user who already said yes is how a permission
 * gets revoked. That property was previously asserted only in a comment.
 */

const original = Object.getOwnPropertyDescriptor(navigator, 'storage');

function stubStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'storage', original);
  else stubStorage(undefined);
  vi.restoreAllMocks();
});

describe('ensurePersistentStorage', () => {
  it('reports unsupported when the Storage API is absent', async () => {
    stubStorage(undefined);
    expect(await ensurePersistentStorage()).toEqual({ supported: false, persisted: false });
  });

  it('does not re-request when the grant is already held', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    expect(await ensurePersistentStorage()).toEqual({ supported: true, persisted: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it('requests the grant when it is not yet held', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    expect(await ensurePersistentStorage()).toEqual({ supported: true, persisted: true });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('reports a denial without throwing', async () => {
    // A denial is not an error — browsers decide on engagement heuristics and
    // may grant later, so the app must carry on and simply say so.
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });
    expect(await ensurePersistentStorage()).toEqual({ supported: true, persisted: false });
  });

  it('survives a Storage API that throws', async () => {
    // This runs before first paint. A throwing Storage API must never stop the
    // app booting; the worst case is the storage we already had.
    stubStorage({
      persisted: vi.fn().mockRejectedValue(new Error('nope')),
      persist: vi.fn(),
    });
    expect(await ensurePersistentStorage()).toEqual({ supported: false, persisted: false });
  });

  it('handles a browser exposing persist() but not persisted()', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist });
    expect(await ensurePersistentStorage()).toEqual({ supported: true, persisted: true });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});

describe('readStoragePersistence', () => {
  it('reports state without requesting anything', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    expect(await readStoragePersistence()).toEqual({ supported: true, persisted: false });
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports unsupported when the API is absent', async () => {
    stubStorage({});
    expect(await readStoragePersistence()).toEqual({ supported: false, persisted: false });
  });
});

describe('readStorageEstimate', () => {
  it('returns usage and quota when available', async () => {
    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: 1000, quota: 5000 }) });
    expect(await readStorageEstimate()).toEqual({ usage: 1000, quota: 5000 });
  });

  it('returns null when either figure is missing', async () => {
    // Some browsers omit quota. A partial estimate must not render as "0 available".
    stubStorage({ estimate: vi.fn().mockResolvedValue({ usage: 1000 }) });
    expect(await readStorageEstimate()).toBeNull();
  });

  it('returns null when the API is absent or throws', async () => {
    stubStorage({});
    expect(await readStorageEstimate()).toBeNull();
    stubStorage({ estimate: vi.fn().mockRejectedValue(new Error('nope')) });
    expect(await readStorageEstimate()).toBeNull();
  });
});

describe('formatBytes', () => {
  it('stays in bytes below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('steps up a unit exactly at the boundary', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB');
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB');
  });

  it('drops the decimal once the value reaches double digits', () => {
    expect(formatBytes(1024 * 9.5)).toBe('9.5 KB');
    expect(formatBytes(1024 * 42)).toBe('42 KB');
  });

  it('does not run past its largest unit', () => {
    // No TB entry: a petabyte must render as a large GB figure, not as
    // `undefined` from walking off the end of the unit list.
    expect(formatBytes(1024 ** 5)).toBe('1048576 GB');
  });
});
