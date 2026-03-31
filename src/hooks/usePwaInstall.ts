import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // If we already captured the event before this hook mounted
    if (deferredPrompt) {
      setCanInstall(true);
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    function handleAppInstalled() {
      deferredPrompt = null;
      setCanInstall(false);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      setCanInstall(false);
    }
  }

  return { canInstall, install };
}
