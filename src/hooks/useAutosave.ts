import { useEffect, useRef, useState } from 'react';
import type { CharacterRecord } from '../types/character';
import { registerFlush } from '../features/persistence/autosaveFlush';

export function useAutosave(
  character: CharacterRecord | null,
  saveFn: (c: CharacterRecord) => Promise<void>,
  debounceMs = 1000,
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<CharacterRecord | null>(null);

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
      if (!pendingRef.current) return;
      setIsSaving(true);
      setError(null);
      try {
        await saveFn(pendingRef.current);
        setLastSaved(new Date().toISOString());
      } catch (e) {
        setError(`Failed to save changes. ${String(e)}`);
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

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        if (pendingRef.current) {
          saveFn(pendingRef.current).catch(console.error);
        }
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
