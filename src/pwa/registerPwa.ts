import { registerSW } from 'virtual:pwa-register';

const UPDATE_AVAILABLE_EVENT = 'pwa-update-available';
const HOURLY = 60 * 60 * 1000;

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;
let updateAvailable = false;

export function registerPwa() {
  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable = true;
      window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT));
    },
    onOfflineReady() {
      console.info('[PWA] App is ready to work offline');
    },
    onRegistered(registration) {
      console.info('[PWA] Service worker registered', registration);
      if (!registration) return;
      const timer = setInterval(() => {
        registration.update().catch((err) => {
          console.warn('[PWA] background update check failed', err);
        });
      }, HOURLY);
      window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error', error);
    },
  });
}

/**
 * True when a newer service worker is installed and waiting to activate.
 * Useful for components that mount after the `pwa-update-available` event
 * already fired — they can sync initial state from here.
 */
export function isUpdateAvailable(): boolean {
  return updateAvailable;
}

/**
 * Trigger the waiting service worker to `skipWaiting` and reload the page
 * once it takes control. Safe to call when no update is pending — no-op.
 * User-driven only; never call on a timer.
 */
export function updateServiceWorker(reloadPage = true) {
  return updateSWFn?.(reloadPage);
}
