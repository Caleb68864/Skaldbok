import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppSettings } from '../features/settings/useAppSettings';
import { useTheme } from '../theme/ThemeProvider';
import * as systemRepository from '../storage/repositories/systemRepository';
import { dragonbaneSystem } from '../systems/dragonbane';
import type { AppSettings, ModeName, BoonBaneState, SessionState } from '../types/settings';

interface AppStateContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
  settingsError: string | null;
  toggleMode: () => void;
  // Session state (in-memory only, resets on app restart)
  sessionState: SessionState;
  setGlobalBoonBane: (value: BoonBaneState) => void;
  setSkillOverride: (skillId: string, value: 'boon' | 'bane' | undefined) => void;
}

const INITIAL_SESSION_STATE: SessionState = {
  globalBoonBane: 'none',
  skillOverrides: {},
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const { settings, updateSettings, isLoading, error: settingsError } = useAppSettings();
  const { setTheme } = useTheme();
  const [sessionState, setSessionState] = useState<SessionState>(INITIAL_SESSION_STATE);

  // Sync theme from loaded settings
  useEffect(() => {
    if (!isLoading) {
      setTheme(settings.theme);
    }
  }, [isLoading, settings.theme, setTheme]);

  // Seed Dragonbane system if absent
  useEffect(() => {
    systemRepository.getById('dragonbane').then(existing => {
      if (!existing) {
        systemRepository.save(dragonbaneSystem).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  function toggleMode() {
    const newMode: ModeName = settings.mode === 'play' ? 'edit' : 'play';
    updateSettings({ mode: newMode }).catch(console.error);
  }

  function setGlobalBoonBane(value: BoonBaneState) {
    setSessionState(prev => ({ ...prev, globalBoonBane: value }));
  }

  function setSkillOverride(skillId: string, value: 'boon' | 'bane' | undefined) {
    setSessionState(prev => {
      const overrides = { ...prev.skillOverrides };
      if (value === undefined) {
        delete overrides[skillId];
      } else {
        overrides[skillId] = value;
      }
      return { ...prev, skillOverrides: overrides };
    });
  }

  return (
    <AppStateContext.Provider
      value={{
        settings,
        updateSettings,
        isLoading,
        settingsError,
        toggleMode,
        sessionState,
        setGlobalBoonBane,
        setSkillOverride,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
