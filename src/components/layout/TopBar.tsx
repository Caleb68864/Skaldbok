import { useAppState } from '../../context/AppStateContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';

export function TopBar() {
  const { settings, toggleMode } = useAppState();
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();

  const isPlayMode = settings.mode === 'play';

  return (
    <header className="top-bar" style={{
      backgroundColor: isPlayMode ? 'var(--color-surface)' : 'var(--color-surface)',
      borderBottom: isPlayMode
        ? '3px solid var(--color-mode-play)'
        : '3px solid var(--color-mode-edit)',
    }}>
      <span className="top-bar__title">Skaldbok</span>
      <div className="top-bar__actions">
        <button
          className="top-bar__btn"
          onClick={toggleMode}
          aria-label={`Switch to ${isPlayMode ? 'Edit' : 'Play'} mode`}
          style={{
            backgroundColor: isPlayMode ? 'var(--color-mode-play)' : 'var(--color-mode-edit)',
            color: 'var(--color-text-inverse)',
            fontWeight: 'bold',
            border: 'none',
          }}
        >
          {isPlayMode ? 'PLAY' : 'EDIT'}
        </button>

        {fsSupported && (
          <button
            className="top-bar__btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? '⊡' : '⊞'}
          </button>
        )}

        {wlSupported && (
          <button
            className="top-bar__btn"
            onClick={toggleWakeLock}
            aria-label={wakeLockActive ? 'Disable wake lock' : 'Enable wake lock'}
            title={wakeLockActive ? 'Wake lock active' : 'Wake lock inactive'}
            style={{
              color: wakeLockActive ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            {wakeLockActive ? '🔒' : '🔓'}
          </button>
        )}
      </div>
    </header>
  );
}
