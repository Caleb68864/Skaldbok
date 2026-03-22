import { registerSW } from 'virtual:pwa-register';

let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | undefined;

export function registerPwa() {
  updateSWFn = registerSW({
    onNeedRefresh() {
      // Dispatch a custom event so UI can show update prompt
      window.dispatchEvent(new CustomEvent('pwa-update-available'));
    },
    onOfflineReady() {
      console.info('[PWA] App is ready to work offline');
    },
    onRegistered(r) {
      console.info('[PWA] Service worker registered', r);
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error', error);
    },
  });
}

export function updateServiceWorker(reloadPage = true) {
  return updateSWFn?.(reloadPage);
}
