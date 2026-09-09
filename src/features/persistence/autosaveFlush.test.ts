import { describe, it, expect, vi } from 'vitest';
import { registerFlush, flushAll } from './autosaveFlush';

/**
 * The flush registry is the mechanism every lifecycle operation relies on to
 * make a debounced write deterministic — `endSession`, `clearCharacter`,
 * `deleteCharacter` and `setCharacter` all await `flushAll()` before mutating
 * state. It had no tests: the module is pure, but nothing exercised it because
 * its only callers live in components, and there was no DOM environment to
 * mount one in.
 *
 * These are the pure half of that gap, and stay in the default node
 * environment. The half that needs a DOM is in `hooks/useAutosave.test.tsx`.
 */

/** Registers a flush and returns a `finally`-safe unregister for the test. */
function cleanup(handles: { unregister: () => void }[]): void {
  for (const handle of handles) handle.unregister();
}

describe('autosaveFlush registry', () => {
  it('runs every registered flush and waits for all of them', async () => {
    const order: string[] = [];
    const a = registerFlush(async () => { order.push('a'); });
    const b = registerFlush(async () => {
      await Promise.resolve();
      order.push('b');
    });

    const results = await flushAll();

    expect(order.sort()).toEqual(['a', 'b']);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    cleanup([a, b]);
  });

  it('gives each registration a distinct id', () => {
    const a = registerFlush(async () => {});
    const b = registerFlush(async () => {});
    expect(a.id).not.toBe(b.id);
    cleanup([a, b]);
  });

  it('stops calling a flush once it unregisters', async () => {
    const fn = vi.fn(async () => {});
    const handle = registerFlush(fn);
    handle.unregister();

    await flushAll();

    expect(fn).not.toHaveBeenCalled();
  });

  it('unregistering twice is harmless', async () => {
    const fn = vi.fn(async () => {});
    const handle = registerFlush(fn);
    handle.unregister();
    handle.unregister();
    await flushAll();
    expect(fn).not.toHaveBeenCalled();
  });

  it('one rejection does not stop the others', async () => {
    // The whole point of `allSettled` here: a character whose save fails must
    // not take the session's or the note editor's pending write down with it.
    const survivor = vi.fn(async () => {});
    const failing = registerFlush(async () => { throw new Error('disk full'); });
    const ok = registerFlush(survivor);

    const results = await flushAll();

    expect(survivor).toHaveBeenCalledTimes(1);
    expect(results.some(r => r.status === 'rejected')).toBe(true);
    expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    cleanup([failing, ok]);
  });

  it('a flush that unregisters a sibling mid-batch does not cancel it', async () => {
    // `flushAll` snapshots the registry at entry precisely so an unmount
    // triggered by one flush cannot drop another's pending write.
    const sibling = vi.fn(async () => {});
    const siblingHandle = registerFlush(sibling);
    const first = registerFlush(async () => { siblingHandle.unregister(); });

    await flushAll();

    expect(sibling).toHaveBeenCalledTimes(1);
    cleanup([first, siblingHandle]);
  });

  it('resolves to an empty array when nothing is registered', async () => {
    await expect(flushAll()).resolves.toEqual([]);
  });
});
