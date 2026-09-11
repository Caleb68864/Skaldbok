import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerFlush, flushAll, trackPendingWrite, flushWhenPageHides } from './autosaveFlush';

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

/**
 * A registered flush covers a write that has not started. This covers the other
 * half — a write already in flight whose owner has unmounted, which is what
 * `useAutosave`'s unmount flush is. Without it, `flushAll()` could resolve
 * while the user's last edit was still on its way to IndexedDB, and every
 * caller of `flushAll` treats it as "the data is safe now".
 */
describe('in-flight writes', () => {
  /** A promise the test settles by hand. */
  function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
    let resolve!: () => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  it('flushAll does not resolve until a tracked write settles', async () => {
    const gate = deferred();
    trackPendingWrite(gate.promise);

    let done = false;
    const flushing = flushAll().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);

    gate.resolve();
    await flushing;
    expect(done).toBe(true);
  });

  it('returns the same promise, so it can wrap a call in place', async () => {
    const promise = Promise.resolve('written');
    expect(trackPendingWrite(promise)).toBe(promise);
    await expect(promise).resolves.toBe('written');
  });

  it('stops waiting for a write once it has settled', async () => {
    await trackPendingWrite(Promise.resolve());
    // Give the internal `finally` a turn to clear the entry.
    await Promise.resolve();
    await expect(flushAll()).resolves.toEqual([]);
  });

  it('a failed write is waited for, reported, and then forgotten', async () => {
    const gate = deferred();
    // The caller owns the error; this is only bookkeeping.
    trackPendingWrite(gate.promise).catch(() => {});

    let done = false;
    const flushing = flushAll().then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);

    gate.reject(new Error('quota exceeded'));
    const results = await flushing;
    expect(done).toBe(true);
    void results;

    // …and the entry is gone, so the next flush is not stuck behind it.
    await Promise.resolve();
    await expect(flushAll()).resolves.toEqual([]);
  });

  it('waits for a registered flush and an in-flight write together', async () => {
    const order: string[] = [];
    const writeGate = deferred();
    const flushGate = deferred();
    trackPendingWrite(writeGate.promise.then(() => { order.push('write'); }));
    const handle = registerFlush(async () => {
      await flushGate.promise;
      order.push('flush');
    });

    let done = false;
    const flushing = flushAll().then(() => { done = true; });
    flushGate.resolve();
    await Promise.resolve();
    expect(done, 'resolved before the in-flight write finished').toBe(false);

    writeGate.resolve();
    await flushing;
    expect(order.sort()).toEqual(['flush', 'write']);
    handle.unregister();
  });
});

/**
 * The debounce window was the one place an edit could still vanish without a
 * word. `useAutosave` waits a second after the last change before writing, and
 * nothing wrote early when the page went away: reproduced in the built app, a
 * page sent to the background had written nothing. On a tablet that is the
 * common case, not the edge one — a player marks damage and switches to a dice
 * app, and a backgrounded tab can be suspended or evicted before its timer ever
 * fires. (A hard reload inside the window is still lost; see the helper's doc.)
 *
 * Plain `EventTarget`s stand in for `window` and `document`, so this stays in
 * the node environment like the rest of the file.
 */
describe('flushWhenPageHides', () => {
  function fakePage() {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState });
    return { win, doc };
  }

  it('flushes pending saves when the page is hidden', async () => {
    const { win, doc } = fakePage();
    const flush = vi.fn(async () => {});
    const handle = registerFlush(flush);
    const uninstall = flushWhenPageHides(win, doc);

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    expect(flush).toHaveBeenCalledTimes(1);
    uninstall();
    handle.unregister();
  });

  it('does not flush when the page becomes visible again', async () => {
    const { win, doc } = fakePage();
    const flush = vi.fn(async () => {});
    const handle = registerFlush(flush);
    const uninstall = flushWhenPageHides(win, doc);

    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();

    expect(flush).not.toHaveBeenCalled();
    uninstall();
    handle.unregister();
  });

  it('flushes pending saves on pagehide (reload, close, navigate away)', async () => {
    const { win, doc } = fakePage();
    const flush = vi.fn(async () => {});
    const handle = registerFlush(flush);
    const uninstall = flushWhenPageHides(win, doc);

    win.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();

    expect(flush).toHaveBeenCalledTimes(1);
    uninstall();
    handle.unregister();
  });

  it('stops listening once uninstalled', async () => {
    const { win, doc } = fakePage();
    const flush = vi.fn(async () => {});
    const handle = registerFlush(flush);
    flushWhenPageHides(win, doc)();

    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();

    expect(flush).not.toHaveBeenCalled();
    handle.unregister();
  });

  it('is installed by the app entry point', () => {
    // Behaviour in isolation cannot prove the listener is ever attached; a
    // helper nothing calls is the original bug in this family.
    const main = readFileSync(join(process.cwd(), 'src', 'main.tsx'), 'utf8');
    expect(main).toMatch(/^\s*flushWhenPageHides\(\);/m);
  });
});
