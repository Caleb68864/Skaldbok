import { useCallback, useEffect, useState } from 'react';
import { isUpdateAvailable, updateServiceWorker } from './registerPwa';

const UPDATE_AVAILABLE_EVENT = 'pwa-update-available';

export interface UpdateAvailableState {
  /** A newer service worker is installed and waiting to activate. */
  updateAvailable: boolean;
  /**
   * Tell the waiting SW to `skipWaiting` and reload once it takes control.
   * User-driven only — never auto-call this. No-op when no update is waiting.
   */
  applyUpdate: () => void;
  /** Hide the banner without applying. Re-surfaces on the next update. */
  dismiss: () => void;
}

/**
 * React binding for Skaldbok's PWA update lifecycle.
 *
 * The service worker is registered outside React in `registerPwa.ts`. That
 * module fires a `pwa-update-available` window event when a new SW is waiting;
 * this hook just listens and exposes it to UI.
 *
 * Why the update is never auto-applied:
 *   Reloading mid-session destroys in-flight UI state (open panels, unsaved
 *   inputs, active encounter drawers). Users get a visible prompt and choose.
 */
export function useUpdateAvailable(): UpdateAvailableState {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(() => isUpdateAvailable());

  useEffect(() => {
    const onUpdate = () => setUpdateAvailable(true);
    window.addEventListener(UPDATE_AVAILABLE_EVENT, onUpdate);
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, onUpdate);
  }, []);

  const applyUpdate = useCallback(() => {
    const p = updateServiceWorker(true);
    if (p) {
      p.catch((err) => console.error('[PWA] failed to apply update', err));
    }
  }, []);

  const dismiss = useCallback(() => setUpdateAvailable(false), []);

  return { updateAvailable, applyUpdate, dismiss };
}
