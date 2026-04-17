import { UpdateAvailableBanner } from './UpdateAvailableBanner';
import { useUpdateAvailable, type UseUpdateAvailableOptions } from './useUpdateAvailable';

export interface UpdatePromptProps extends UseUpdateAvailableOptions {
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  /** Override the banner's wrapper className entirely. */
  className?: string;
}

/**
 * Drop-in PWA update prompt. Mount once near the root of the React tree.
 * Renders nothing until a waiting service worker is detected.
 *
 * This is the public entry point — the hook and banner are split so either
 * can be swapped (e.g. pipe the hook's state into a toast instead).
 */
export function UpdatePrompt({
  title,
  description,
  primaryLabel,
  secondaryLabel,
  className,
  checkIntervalMs,
  onRegistered,
  onError,
}: UpdatePromptProps = {}) {
  const { updateAvailable, applyUpdate, dismiss } = useUpdateAvailable({
    checkIntervalMs,
    onRegistered,
    onError,
  });

  return (
    <UpdateAvailableBanner
      open={updateAvailable}
      title={title}
      description={description}
      primaryLabel={primaryLabel}
      secondaryLabel={secondaryLabel}
      onApply={applyUpdate}
      onDismiss={dismiss}
      className={className}
    />
  );
}
