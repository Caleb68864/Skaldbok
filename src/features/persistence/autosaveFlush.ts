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
  return Promise.allSettled(snapshot.map((fn) => fn()));
}
