export type ThemeName = 'dark' | 'parchment' | 'light';

export const DEFAULT_THEME: ThemeName = 'dark';
export const THEME_STORAGE_KEY = 'skaldbok-theme';

export const THEME_DISPLAY_NAMES: Record<ThemeName, string> = {
  light: 'Camp Before the Hunt',
  dark: 'Torchlight in the Barrow',
  parchment: "The Adventurer's Ledger",
};

export const THEME_LIST: ThemeName[] = ['light', 'dark', 'parchment'];
