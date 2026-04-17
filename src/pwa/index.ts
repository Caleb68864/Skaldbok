// Public API for the PWA update-prompt module.
// Copy this folder (`src/pwa/`) into another Vite + vite-plugin-pwa project
// and it will work unchanged. See README.md for the theme-token contract and
// the required VitePWA config.

export { UpdatePrompt } from './UpdatePrompt';
export type { UpdatePromptProps } from './UpdatePrompt';

export { UpdateAvailableBanner } from './UpdateAvailableBanner';
export type { UpdateAvailableBannerProps } from './UpdateAvailableBanner';

export { useUpdateAvailable } from './useUpdateAvailable';
export type {
  UpdateAvailableState,
  UseUpdateAvailableOptions,
} from './useUpdateAvailable';
