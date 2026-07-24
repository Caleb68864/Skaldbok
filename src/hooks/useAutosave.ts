import { useEffect, useRef, useState } from 'react';
import type { CharacterRecord } from '../types/character';
import { registerFlush } from '../features/persistence/autosaveFlush';
import { useToast } from '../context/ToastContext';

export function useAutosave(
  character: CharacterRecord | null,
  saveFn: (c: CharacterRecord) => Promise<void>,
  debounceMs = 1000,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Holds the most recent character with an *unsaved* change. Cleared once that
  // exact record is persisted, so the unmount flush below can tell "genuinely
  // dirty" from "already saved" and never re-saves needlessly.
  const pendingRef = useRef<CharacterRecord | null>(null);
  const { showToast } = useToast();
  // Guards against toast spam: while saves keep failing on every debounce tick,
  // surface the error once per failure streak, not once per keystroke.
  const erroredRef = useRef(false);

  useEffect(() => {
    if (!character) {
      pendingRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    pendingRef.current = character;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const record = pendingRef.current;
      if (!record) return;
      setIsSaving(true);
      setError(null);
      try {
        await saveFn(record);
        setLastSaved(new Date().toISOString());
        erroredRef.current = false;
        // Only clear if nothing newer arrived while we were awaiting, so a change
        // made mid-save is still flagged dirty for the next tick / unmount flush.
        if (pendingRef.current === record) pendingRef.current = null;
      } catch (e) {
        setError(`Failed to save changes. ${String(e)}`);
        if (!erroredRef.current) {
          erroredRef.current = true;
          showToast(`Couldn't save changes — ${String(e)}`, 'error', { duration: 8000 });
        }
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      // Cancel pending debounce timer on re-render or dependency change
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  // We deliberately key on character object identity (not deep comparison) for debounce
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  // Flush pending save on unmount. Gated on pendingRef (the dirty flag), NOT on
  // timerRef — the debounce-cancel cleanup above runs first on unmount and nulls
  // timerRef, so a timer-gated flush would always skip and silently drop the edit
  // made in the last debounce window (e.g. tapping a tab mid-edit).
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingRef.current) {
        saveFn(pendingRef.current).catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register with the flush bus so lifecycle operations (endSession,
  // clearCharacter, deleteCharacter) can wait for pending debounced saves
  // before mutating state.
  //
  // Register ONCE on mount with an empty dep array. The flush closure reads
  // pendingRef.current at flush time (stable ref). saveFn must be a stable
  // reference (module-level function or memoized callback); inline arrows
  // captured here will go stale.
  useEffect(() => {
    const { unregister } = registerFlush(async () => {
      if (pendingRef.current) {
        await saveFn(pendingRef.current);
        pendingRef.current = null;
      }
    });
    return unregister;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { isSaving, lastSaved, error };
}
