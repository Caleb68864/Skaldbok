export type ThemeName =
  | 'dark'
  | 'parchment'
  | 'light'
  | 'starfarers-cockpit'
  | 'deep-space'
  | 'databank'
  | 'neon-sprawl'
  | 'notebook-paper'
  | 'traveller-dark'
  | 'traveller-light';

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
  'notebook-paper': 'Notebook Paper',
  'traveller-dark': 'Traveller — Black Book',
  'traveller-light': 'Traveller — Printed Sheet',
};

export const THEME_LIST: ThemeName[] = [
  'light',
  'dark',
  'parchment',
  'starfarers-cockpit',
  'deep-space',
  'databank',
  'neon-sprawl',
  'notebook-paper',
  'traveller-dark',
  'traveller-light',
];
