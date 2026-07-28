import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAppState } from './AppStateContext';
import * as characterRepository from '../storage/repositories/characterRepository';
import { flushAll } from '../features/persistence/autosaveFlush';
import type { CharacterRecord } from '../types/character';
import { normalizeCharacter } from '../utils/characterNormalization';

export type CharacterUpdater = Partial<CharacterRecord> | ((prev: CharacterRecord) => Partial<CharacterRecord>);

/** The active character and the operations for switching, editing, and clearing it. */
export interface ActiveCharacterContextValue {
  /** The character currently open on the sheet, or `null` when none is selected. */
  character: CharacterRecord | null;
  /** Selects a character by id and persists the choice to settings. */
  setCharacter: (id: string) => Promise<void>;
  /** Merges a partial (or reducer-style) update into the in-memory character; autosave persists it. */
  updateCharacter: (partialOrFn: CharacterUpdater) => void;
  /** Deselects the active character, flushing any pending autosave first. */
  clearCharacter: () => Promise<void>;
  isLoading: boolean;
}

const ActiveCharacterContext = createContext<ActiveCharacterContextValue | null>(null);

export interface ActiveCharacterProviderProps {
  children: ReactNode;
}

/**
 * Provides the active character to the tree and keeps it in sync with settings.
 *
 * @remarks
 * The active character id lives in persisted settings, so the character reloads
 * on app restart and survives navigation. Edits are held in memory here and
 * written by the autosave layer; `clearCharacter` flushes that autosave
 * before clearing so a debounced save cannot fire afterwards and resurrect the
 * data. A character deleted out from under the provider self-heals by clearing
 * the stale `activeCharacterId`.
 */
export function ActiveCharacterProvider({ children }: ActiveCharacterProviderProps) {
  const { settings, updateSettings, isLoading: settingsLoading } = useAppState();
  const [character, setCharacterState] = useState<CharacterRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load active character on mount / when activeCharacterId changes
  useEffect(() => {
    if (settingsLoading) {
      setIsLoading(true);
      return;
    }

    if (!settings.activeCharacterId) {
      setCharacterState(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    characterRepository.getById(settings.activeCharacterId).then(char => {
      if (!mounted) return;
      if (char) {
        setCharacterState(normalizeCharacter(char));
      } else {
        // Character was deleted; clear activeCharacterId
        updateSettings({ activeCharacterId: null }).catch(console.error);
        setCharacterState(null);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted) {
        setCharacterState(null);
        setIsLoading(false);
      }
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.activeCharacterId, settingsLoading]);

  const setCharacter = useCallback(async (id: string) => {
    const char = await characterRepository.getById(id);
    if (char) {
      // Flush the outgoing character's pending autosave before switching, so a
      // debounced edit can't fire against — or be dropped in favour of — the new
      // character. Mirrors clearCharacter; matters now that campaign-switch
      // reconciliation calls setCharacter in place while the sheet stays mounted.
      await flushAll();
      setCharacterState(normalizeCharacter(char));
      await updateSettings({ activeCharacterId: id });
    }
  }, [updateSettings]);

  const updateCharacter = useCallback((partialOrFn: CharacterUpdater) => {
    setCharacterState(prev => {
      if (!prev) return null;
      const partial = typeof partialOrFn === 'function' ? partialOrFn(prev) : partialOrFn;
      return { ...prev, ...partial };
    });
  }, []);

  const clearCharacter = useCallback(async () => {
    // Flush any pending character autosave before mutating state, so a
    // debounced save doesn't fire after the clear and re-insert data.
    await flushAll();
    setCharacterState(null);
    await updateSettings({ activeCharacterId: null });
  }, [updateSettings]);

  return (
    <ActiveCharacterContext.Provider value={{ character, setCharacter, updateCharacter, clearCharacter, isLoading }}>
      {children}
    </ActiveCharacterContext.Provider>
  );
}

/** Accesses the active-character context; throws if used outside {@link ActiveCharacterProvider}. */
export function useActiveCharacter(): ActiveCharacterContextValue {
  const ctx = useContext(ActiveCharacterContext);
  if (!ctx) throw new Error('useActiveCharacter must be used within ActiveCharacterProvider');
  return ctx;
}
