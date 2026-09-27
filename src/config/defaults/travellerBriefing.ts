/** Starting catalog. Preferences may add or remove sectors. */
export const DEFAULT_TRAVELLER_SECTORS = ['Spinward Marches'];
/** Nearby destinations shown when a world is selected. */
export const DEFAULT_TRAVELLER_JUMP_RANGE = 2;
export const DEFAULT_TRAVELLER_MILIEU = 'M1105';
/** Optional filters for the nearby-world list. Empty starports means any type. */
export const DEFAULT_TRAVELLER_WORLD_FILTERS = {
  starports: [] as string[],
  gasGiantOnly: false,
  zone: 'all' as 'all' | 'noRed' | 'greenOnly',
};
export const TRAVELLER_STARPORT_CODES = ['A', 'B', 'C', 'D', 'E', 'X'];
