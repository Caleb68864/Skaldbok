/**
 * Autosave flush registry.
 *
 * Lifecycle operations like `endSession`, `clearCharacter`, and
 * `deleteCharacter` need to deterministically wait for pending debounced
 * writes before mutating state. This registry is the single mechanism
 * that makes that possible. Consumers (useAutosave, NoteEditorScreen,
 * CombatEncounterView) register a flush callback on mount and
 * unregister on cleanup. Callers of `flushAll()` get a snapshot of the
 * currently-registered flushes executed through `Promise.allSettled`
 * so a single rejection doesn't stop the others.
 */

import { generateId } from '../../utils/ids';

const registry = new Map<string, () => Promise<void>>();

/**
 * Writes that have already been started and have not settled yet.
 *
 * @remarks
 * A registered flush covers a write that has not begun. This covers the other
 * half: a write already in flight, started by a component that has since
 * unmounted and so has nobody left to await it. `useAutosave`'s unmount flush
 * is exactly that — fire-and-forget by necessity, because the component is
 * gone — and until this existed, `flushAll()` could resolve while the last
 * edit was still on its way to IndexedDB. Every caller of `flushAll` means
 * "everything is on disk"; this is what makes that true.
 */
const inFlight = new Set<Promise<unknown>>();

/**
 * Registers a pending-write flush callback and returns its unregister handle.
 *
 * @remarks
 * Components with debounced autosaves register on mount and must call
 * `unregister` on cleanup so a stale flush is never invoked after unmount.
 */
export function registerFlush(fn: () => Promise<void>): {
  id: string;
  unregister: () => void;
} {
  const id = generateId();
  registry.set(id, fn);
  return {
    id,
    unregister: () => {
      registry.delete(id);
    },
  };
}

/**
 * Runs every registered flush and waits for all of them to settle.
 *
 * @remarks
 * Called by lifecycle operations (end session, clear/delete character) before
 * they mutate state, so a debounced write cannot fire afterwards and resurrect
 * data. Uses `allSettled` on a snapshot so one rejection does not abort the rest
 * and late unregisters do not disturb the in-flight batch.
 */
export function flushAll(): Promise<PromiseSettledResult<void>[]> {
  // Snapshot at entry — late unregisters don't affect the in-flight batch.
  const snapshot = Array.from(registry.values());
  const started = Array.from(inFlight);
  return Promise.allSettled([
    ...snapshot.map((fn) => fn()),
    // Already-started writes are awaited too, so `flushAll()` resolving means
    // the data is written, not merely that nothing new was queued.
    ...started.map((promise) => promise.then(() => undefined)),
  ]);
}

/**
 * Registers an already-started write so {@link flushAll} waits for it.
 *
 * @remarks
 * For writes with no owner left to await them — chiefly `useAutosave`'s
 * unmount flush, which fires precisely when the user navigates away mid-edit.
 * The promise is removed once it settles, and a rejection is neither swallowed
 * nor re-raised here: the caller keeps its own error handling, and `flushAll`
 * uses `allSettled` so one failed write cannot abort the rest.
 *
 * @param promise - The write in progress.
 * @returns The same promise, so this can wrap a call in place.
 */
export function trackPendingWrite<T>(promise: Promise<T>): Promise<T> {
  inFlight.add(promise);
  // `finally` rather than `then`, so a rejection still clears the entry — and
  // the catch keeps this bookkeeping from raising an unhandled rejection of its
  // own when the caller has already attached a handler to `promise`.
  const settled = promise.finally(() => { inFlight.delete(promise); });
  settled.catch(() => {});
  return promise;
}
