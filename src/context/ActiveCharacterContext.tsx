import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAppState } from './AppStateContext';
import * as characterRepository from '../storage/repositories/characterRepository';
import type { CharacterRecord } from '../types/character';

type CharacterUpdater = Partial<CharacterRecord> | ((prev: CharacterRecord) => Partial<CharacterRecord>);

interface ActiveCharacterContextValue {
  character: CharacterRecord | null;
  setCharacter: (id: string) => Promise<void>;
  updateCharacter: (partialOrFn: CharacterUpdater) => void;
  clearCharacter: () => Promise<void>;
  isLoading: boolean;
}

const ActiveCharacterContext = createContext<ActiveCharacterContextValue | null>(null);

interface ActiveCharacterProviderProps {
  children: ReactNode;
}

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
        setCharacterState(char);
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
      setCharacterState(char);
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
    setCharacterState(null);
    await updateSettings({ activeCharacterId: null });
  }, [updateSettings]);

  return (
    <ActiveCharacterContext.Provider value={{ character, setCharacter, updateCharacter, clearCharacter, isLoading }}>
      {children}
    </ActiveCharacterContext.Provider>
  );
}

export function useActiveCharacter(): ActiveCharacterContextValue {
  const ctx = useContext(ActiveCharacterContext);
  if (!ctx) throw new Error('useActiveCharacter must be used within ActiveCharacterProvider');
  return ctx;
}
