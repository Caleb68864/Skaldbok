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

  // Auto-acquire on mount if preference is enabled
  useEffect(() => {
    if (settings.wakeLockEnabled && isSupported) {
      acquire().catch(console.error);
    }
    return () => {
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
