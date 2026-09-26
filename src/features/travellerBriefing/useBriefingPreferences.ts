import { useAppState } from '../../context/AppStateContext';
import { DEFAULT_TRAVELLER_SECTORS } from '../../config/defaults/travellerBriefing';

export function useBriefingPreferences() {
  const { settings, updateSettings } = useAppState();
  return {
    sectors: settings.travellerBriefingSectors ?? DEFAULT_TRAVELLER_SECTORS,
    recent: settings.recentBriefingWorlds ?? [],
    overrides: settings.briefingWorldOverrides ?? {},
    updateSettings,
  };
}
