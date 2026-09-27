import { useAppState } from '../../context/AppStateContext';
import { DEFAULT_TRAVELLER_JUMP_RANGE, DEFAULT_TRAVELLER_SECTORS, DEFAULT_TRAVELLER_WORLD_FILTERS, TRAVELLER_STARPORT_CODES } from '../../config/defaults/travellerBriefing';

export function useBriefingPreferences() {
  const { settings, updateSettings } = useAppState();
  const storedFilters = settings.travellerWorldFilters;
  const filters = storedFilters ? {
    starports: Array.isArray(storedFilters.starports) ? storedFilters.starports.filter(code => TRAVELLER_STARPORT_CODES.includes(code)) : [],
    gasGiantOnly: storedFilters.gasGiantOnly === true,
    zone: storedFilters.zone === 'noRed' || storedFilters.zone === 'greenOnly' ? storedFilters.zone : 'all' as const,
  } : DEFAULT_TRAVELLER_WORLD_FILTERS;
  return {
    sectors: settings.travellerBriefingSectors ?? DEFAULT_TRAVELLER_SECTORS,
    jumpRange: Number.isInteger(settings.travellerExploreJumpRange) && (settings.travellerExploreJumpRange ?? 0) >= 1 && (settings.travellerExploreJumpRange ?? 0) <= 12
      ? settings.travellerExploreJumpRange! : DEFAULT_TRAVELLER_JUMP_RANGE,
    filters,
    starportCodes: TRAVELLER_STARPORT_CODES,
    recent: settings.recentBriefingWorlds ?? [],
    overrides: settings.briefingWorldOverrides ?? {},
    updateSettings,
  };
}
