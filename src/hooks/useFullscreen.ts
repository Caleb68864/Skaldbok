import { useState, useEffect, useCallback } from 'react';

export function useFullscreen() {
  const isSupported = !!document.documentElement.requestFullscreen;
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    function handleChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!isSupported) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(console.error);
    } else {
      document.documentElement.requestFullscreen().catch(console.error);
    }
  }, [isSupported]);

  return { isFullscreen, toggleFullscreen, isSupported };
}
