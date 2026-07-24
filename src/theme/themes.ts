export type ThemeName =
  | 'dark'
  | 'parchment'
  | 'light'
  | 'starfarers-cockpit'
  | 'deep-space'
  | 'databank'
  | 'neon-sprawl';

export const DEFAULT_THEME: ThemeName = 'dark';
export const THEME_STORAGE_KEY = 'skaldbok-theme';

export const THEME_DISPLAY_NAMES: Record<ThemeName, string> = {
  light: 'Camp Before the Hunt',
  dark: 'Torchlight in the Barrow',
  parchment: "The Adventurer's Ledger",
  'starfarers-cockpit': "Starfarer's Cockpit",
  'deep-space': 'Deep Space',
  databank: 'Databank',
  'neon-sprawl': 'Neon Sprawl',
};

export const THEME_LIST: ThemeName[] = [
  'light',
  'dark',
  'parchment',
  'starfarers-cockpit',
  'deep-space',
  'databank',
  'neon-sprawl',
];
