import { useCallback, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface UseUpdateAvailableOptions {
  /**
   * Background poll interval (ms) for `registration.update()`. Lets
   * long-lived tabs discover new deploys without a manual refresh.
   * Default: 1 hour. Set to 0 to disable.
   */
  checkIntervalMs?: number;
  /** Called once the service worker is registered. */
  onRegistered?: (registration?: ServiceWorkerRegistration) => void;
  /** Called if registration fails. */
  onError?: (error: unknown) => void;
}

export interface UpdateAvailableState {
  /** A newer service worker is installed and waiting to activate. */
  updateAvailable: boolean;
  /** Caches are populated; app will work offline now. */
  offlineReady: boolean;
  /**
   * Tell the waiting SW to `skipWaiting` and reload the page once it takes
   * control. No-op when no update is pending — always safe to call.
   * User-driven only; never call on a timer.
   */
  applyUpdate: () => void;
  /** Hide the update prompt. Re-surfaces when the next update arrives. */
  dismiss: () => void;
  /** Hide the offline-ready confirmation. */
  dismissOfflineReady: () => void;
}

/**
 * Self-contained PWA update-available hook for Vite + vite-plugin-pwa apps.
 *
 * Owns the service-worker registration internally via `useRegisterSW`, so
 * the consuming app only needs to:
 *   1. Configure VitePWA with `registerType: 'prompt'` (NOT `'autoUpdate'`).
 *   2. Mount `<UpdatePrompt />` once near the root of its React tree.
 *
 * Why the update is never auto-applied:
 *   Reloading mid-session destroys in-flight UI state (open drawers, unsaved
 *   inputs, active flows). The user sees a visible prompt and chooses.
 *
 * Lifecycle:
 *   1. New SW detected → installed → waiting.
 *   2. `updateAvailable` flips to true.
 *   3. UI renders the prompt.
 *   4. User clicks apply → `applyUpdate()` posts SKIP_WAITING → plugin waits
 *      for `controllerchange` → reloads the page.
 *   5. If user dismisses, the flag goes false; the waiting SW stays waiting
 *      until the user applies or closes every tab. No broken loop — the
 *      next detected update re-opens the prompt.
 */
export function useUpdateAvailable(
  options: UseUpdateAvailableOptions = {}
): UpdateAvailableState {
  const { checkIntervalMs = 60 * 60 * 1000 } = options;

  // Keep callbacks stable without re-registering on every render.
  const optsRef = useRef(options);
  optsRef.current = options;

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      try {
        optsRef.current.onRegistered?.(registration);
      } catch (err) {
        console.error('[pwa] onRegistered handler threw', err);
      }
      if (!registration || !checkIntervalMs) return;

      const timer = setInterval(() => {
        registration.update().catch((err) => {
          console.warn('[pwa] background update check failed', err);
        });
      }, checkIntervalMs);
      window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration error', error);
      try {
        optsRef.current.onError?.(error);
      } catch (err) {
        console.error('[pwa] onError handler threw', err);
      }
    },
  });

  const applyUpdate = useCallback(() => {
    // `true` = reload after new SW takes control. The plugin handles the
    // postMessage → controllerchange → location.reload() sequence.
    void updateServiceWorker(true).catch((err) => {
      console.error('[pwa] failed to apply update', err);
    });
  }, [updateServiceWorker]);

  const dismiss = useCallback(() => setNeedRefresh(false), [setNeedRefresh]);
  const dismissOfflineReady = useCallback(() => setOfflineReady(false), [setOfflineReady]);

  return {
    updateAvailable: needRefresh,
    offlineReady,
    applyUpdate,
    dismiss,
    dismissOfflineReady,
  };
}
