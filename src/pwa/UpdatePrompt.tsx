import { UpdateAvailableBanner } from './UpdateAvailableBanner';
import { useUpdateAvailable } from './useUpdateAvailable';

/**
 * Drop-in PWA update prompt. Mount once near the root of the React tree.
 * Renders nothing until a waiting service worker is detected.
 */
export function UpdatePrompt() {
  const { updateAvailable, applyUpdate, dismiss } = useUpdateAvailable();

  return (
    <UpdateAvailableBanner
      open={updateAvailable}
      onApply={applyUpdate}
      onDismiss={dismiss}
    />
  );
}
