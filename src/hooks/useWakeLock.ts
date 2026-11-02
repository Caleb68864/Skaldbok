import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppState } from '../context/AppStateContext';

export function useWakeLock() {
  const isSupported = 'wakeLock' in navigator;
  const [isActive, setIsActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const { settings, updateSettings } = useAppState();

  const acquire = useCallback(async () => {
    if (!isSupported) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      sentinelRef.current = sentinel;
      setIsActive(true);
      sentinel.addEventListener('release', () => {
        setIsActive(false);
        sentinelRef.current = null;
      });
    } catch {
      setIsActive(false);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (sentinelRef.current) {
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Acquire when the preference is on, including when it arrives after mount:
  // settings load asynchronously, so a mount-only effect saw only the default and
  // ignored the saved preference until the tab was next hidden and shown.
  useEffect(() => {
    if (settings.wakeLockEnabled && isSupported && !sentinelRef.current) {
      acquire().catch(console.error);
    }
  }, [settings.wakeLockEnabled, isSupported, acquire]);

  useEffect(() => {
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(console.error);
      }
    };
  }, []);

  // Re-acquire on visibility change if preference enabled
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible' && settings.wakeLockEnabled && !sentinelRef.current) {
        acquire().catch(console.error);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [settings.wakeLockEnabled, acquire]);

  const toggleWakeLock = useCallback(async () => {
    if (isActive) {
      await release();
      await updateSettings({ wakeLockEnabled: false });
    } else {
      await acquire();
      await updateSettings({ wakeLockEnabled: true });
    }
  }, [isActive, release, acquire, updateSettings]);

  return { isActive, toggleWakeLock, isSupported };
}
