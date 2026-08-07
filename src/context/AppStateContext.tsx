import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAppSettings } from '../features/settings/useAppSettings';
import { useTheme } from '../theme/ThemeProvider';
import * as systemRepository from '../storage/repositories/systemRepository';
import { classicFantasySystem } from '../systems/classic-fantasy';
import type { AppSettings, ModeName, BoonBaneState, SessionState } from '../types/settings';

/** App-wide settings plus the in-memory, per-run session state (boon/bane selections). */
export interface AppStateContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
  settingsError: string | null;
  /** Flips between play and edit mode. */
  toggleMode: () => void;
  /** Transient roll-advantage state; in-memory only and reset on app restart. */
  sessionState: SessionState;
  /** Sets the table-wide boon/bane selector. */
  setGlobalBoonBane: (value: BoonBaneState) => void;
  /** Sets or clears (with `undefined`) a per-skill boon/bane override. */
  setSkillOverride: (skillId: string, value: 'boon' | 'bane' | undefined) => void;
  /** Sets or clears (with `undefined`) a per-skill linked-characteristic swap. */
  setSkillAttributeOverride: (skillId: string, attributeId: string | undefined) => void;
}

const INITIAL_SESSION_STATE: SessionState = {
  globalBoonBane: 'none',
  skillOverrides: {},
  skillAttributeOverrides: {},
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export interface AppStateProviderProps {
  children: ReactNode;
}

/**
 * Provides persisted app settings and transient session state to the tree.
 *
 * @remarks
 * Bridges two lifetimes: `settings` are durable (theme, mode, active ids) and
 * `sessionState` is per-run advantage state that intentionally resets on
 * restart. Also drives two side effects — syncing the theme from loaded settings
 * and seeding the bundled classic-fantasy system into IndexedDB on first run.
 */
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

  // Seed default system if absent
  useEffect(() => {
    systemRepository.getById('classic-fantasy').then(existing => {
      if (!existing) {
        systemRepository.save(classicFantasySystem).catch(console.error);
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

  function setSkillAttributeOverride(skillId: string, attributeId: string | undefined) {
    setSessionState(prev => {
      const overrides = { ...prev.skillAttributeOverrides };
      if (attributeId === undefined) {
        delete overrides[skillId];
      } else {
        overrides[skillId] = attributeId;
      }
      return { ...prev, skillAttributeOverrides: overrides };
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
        setSkillAttributeOverride,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

/** Accesses app settings and session state; throws if used outside {@link AppStateProvider}. */
export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
