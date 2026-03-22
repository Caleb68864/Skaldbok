import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAppSettings } from '../features/settings/useAppSettings';
import { useTheme } from '../theme/ThemeProvider';
import * as systemRepository from '../storage/repositories/systemRepository';
import { dragonbaneSystem } from '../systems/dragonbane';
import type { AppSettings, ModeName } from '../types/settings';

interface AppStateContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  isLoading: boolean;
  toggleMode: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

interface AppStateProviderProps {
  children: ReactNode;
}

export function AppStateProvider({ children }: AppStateProviderProps) {
  const { settings, updateSettings, isLoading } = useAppSettings();
  const { setTheme } = useTheme();

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

  return (
    <AppStateContext.Provider value={{ settings, updateSettings, isLoading, toggleMode }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
