import { useState, useEffect, useCallback } from 'react';
import * as settingsRepository from '../../storage/repositories/settingsRepository';
import type { AppSettings } from '../../types/settings';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  schemaVersion: 1,
  activeCharacterId: null,
  theme: 'dark',
  mode: 'play',
  wakeLockEnabled: false,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    settingsRepository.get().then(stored => {
      if (!mounted) return;
      if (stored) {
        setSettings(stored);
      } else {
        // First launch: persist defaults
        settingsRepository.save(DEFAULT_SETTINGS).catch(console.error);
        setSettings(DEFAULT_SETTINGS);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    try {
      await settingsRepository.save(updated);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError('Failed to save settings: ' + message);
    }
  }, [settings]);

  return { settings, updateSettings, isLoading, error };
}
