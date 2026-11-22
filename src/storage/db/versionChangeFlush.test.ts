import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { handleVersionChange } from './client';

/**
 * Another tab upgrading the schema made this one close and reload at once.
 *
 * @remarks
 * `db.close()` turns off Dexie's auto-reopen, so every pending debounced
 * autosave and the `pagehide` flush then hit a closed database, and the last
 * edit was lost. `handleVersionChange` flushes first, with a bound. These fail
 * on the old code, which had no such step (the export did not exist).
 */

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('handleVersionChange', () => {
  it('writes pending autosaves before it closes and reloads', async () => {
    const order: string[] = [];
    await handleVersionChange({
      flush: async () => { await Promise.resolve(); order.push('flush'); },
      close: () => order.push('close'),
      reload: () => order.push('reload'),
    });
    expect(order).toEqual(['flush', 'close', 'reload']);
  });

  it('reloads anyway when the flush never finishes', async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const reload = vi.fn();
    const done = handleVersionChange({ flush: () => new Promise(() => {}), close, reload, timeoutMs: 2000 });
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(close).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when the flush fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    await handleVersionChange({ flush: async () => { throw new Error('quota'); }, close: vi.fn(), reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads with nothing registered', async () => {
    const reload = vi.fn();
    await handleVersionChange({ flush: null, close: vi.fn(), reload });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
