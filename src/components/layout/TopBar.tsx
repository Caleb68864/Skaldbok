import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppStateContext';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';

export function TopBar() {
  const { settings, toggleMode } = useAppState();
  const { character } = useActiveCharacter();
  const navigate = useNavigate();
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPlayMode = settings.mode === 'play';

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <header className="top-bar" style={{
      backgroundColor: isPlayMode ? 'var(--color-surface)' : 'var(--color-surface)',
      borderBottom: isPlayMode
        ? '3px solid var(--color-mode-play)'
        : '3px solid var(--color-mode-edit)',
    }}>
      <div className="top-bar__title-group">
        <span
          className="top-bar__title top-bar__title--link"
          onClick={() => navigate('/library')}
          role="button"
          tabIndex={0}
          title="Character Library"
        >
          Skaldbok
        </span>
        {character && (
          <span
            className="top-bar__character"
            onClick={() => navigate('/library')}
            role="button"
            tabIndex={0}
            title="Switch character"
          >
            {character.name || 'Unnamed'}
          </span>
        )}
      </div>
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

        {/* Hamburger menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            className="top-bar__btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            title="More options"
          >
            ☰
          </button>

          {menuOpen && (
            <nav className="topbar-menu" aria-label="Navigation menu">
              <NavLink
                to="/reference"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                📖 Reference
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                ⚙️ Settings
              </NavLink>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
