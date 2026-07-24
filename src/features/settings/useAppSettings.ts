import { useState, useEffect, useCallback, useRef } from 'react';
import * as settingsRepository from '../../storage/repositories/settingsRepository';
import type { AppSettings } from '../../types/settings';

/** Default visibility of each bottom-nav tab, merged into stored settings so new tabs appear for existing users. */
export const DEFAULT_BOTTOM_NAV_TABS: Record<string, boolean> = {
  sheet: true,
  skills: true,
  gear: true,
  magic: true,
  combat: true,
  reference: true,
  profile: false,
};

const DEFAULT_SETTINGS: AppSettings = {
  id: 'default',
  schemaVersion: 1,
  activeCharacterId: null,
  theme: 'dark',
  mode: 'play',
  wakeLockEnabled: false,
  bottomNavTabs: DEFAULT_BOTTOM_NAV_TABS,
  showGlobalFAB: true,
};

/**
 * Loads and persists the singleton app settings, merging in defaults for
 * forward compatibility.
 *
 * @remarks
 * Writes are composed off a synchronously-updated ref, not the `settings` state,
 * so two `updateSettings` calls in the same tick both build on the latest value
 * instead of the second silently reverting the first. Stored settings are merged
 * over {@link DEFAULT_SETTINGS} on load so a record written by an older build
 * gains any new fields.
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * The authoritative settings value for merging.
   *
   * @remarks
   * Merging off the `settings` state variable loses writes: two
   * `updateSettings` calls in the same tick both close over the pre-update
   * snapshot, so the second silently reverts the first. That is how
   * "Set Active & Edit" used to reactivate the *previous* character —
   * `setCharacter` wrote `activeCharacterId`, then `updateSettings({ mode })`
   * overwrote it with the stale one. The ref is updated synchronously, so
   * sequential calls compose.
   */
  const latestSettings = useRef<AppSettings>(DEFAULT_SETTINGS);

  const applySettings = useCallback((next: AppSettings) => {
    latestSettings.current = next;
    setSettings(next);
  }, []);

  useEffect(() => {
    let mounted = true;
    settingsRepository.get().then(stored => {
      if (!mounted) return;
      if (stored) {
        // Merge with defaults to handle old stored data that lacks new fields
        applySettings({ ...DEFAULT_SETTINGS, ...stored });
      } else {
        // First launch: persist defaults
        settingsRepository.save(DEFAULT_SETTINGS).catch(console.error);
        applySettings(DEFAULT_SETTINGS);
      }
      setIsLoading(false);
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });
    return () => { mounted = false; };
  }, [applySettings]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...latestSettings.current, ...partial };
    applySettings(updated);
    try {
      await settingsRepository.save(updated);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError('Failed to save settings: ' + message);
    }
  }, [applySettings]);

  return { settings, updateSettings, isLoading, error };
}
