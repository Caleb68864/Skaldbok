import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppState } from '../../context/AppStateContext';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { GameIcon } from '../primitives/GameIcon';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { EndOfSessionModal } from '../modals/EndOfSessionModal';

export function TopBar() {
  const { settings, toggleMode } = useAppState();
  const { character } = useActiveCharacter();
  const navigate = useNavigate();
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();
  const [menuOpen, setMenuOpen] = useState(false);
  const [endOfSessionOpen, setEndOfSessionOpen] = useState(false);
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
    <header
      className="top-bar"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderBottom: isPlayMode
          ? '3px solid var(--color-mode-play)'
          : '3px solid var(--color-mode-edit)',
      }}
    >
      {/* LEFT ZONE: title + character name */}
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

      {/* CENTER ZONE: dedicated mode toggle slot */}
      <div className="top-bar__mode-toggle">
        <button
          className="top-bar__btn"
          onClick={toggleMode}
          aria-label={isPlayMode ? 'Switch to Edit Mode' : 'Switch to Play Mode'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: isPlayMode ? 'var(--color-mode-play)' : 'var(--color-mode-edit)',
            color: 'var(--color-bg)',
            fontWeight: 'bold',
            border: 'none',
          }}
        >
          <GameIcon name={isPlayMode ? 'crossed-swords' : 'open-book'} size={16} />
          <span className="top-bar__mode-label">
            {isPlayMode ? 'PLAY MODE' : 'EDIT MODE'}
          </span>
        </button>
      </div>

      {/* RIGHT ZONE: fullscreen, wake-lock, hamburger */}
      <div className="top-bar__actions">
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
                to="/sheet"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                📋 Sheet
              </NavLink>
              <NavLink
                to="/skills"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                🎲 Skills
              </NavLink>
              <NavLink
                to="/gear"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                🎒 Gear
              </NavLink>
              <NavLink
                to="/magic"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                📖 Magic
              </NavLink>
              <NavLink
                to="/combat"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                ⚔️ Combat
              </NavLink>
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
                to="/profile"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                🧑 Profile
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
              <button
                className="topbar-menu__item topbar-menu__item--action"
                onClick={() => { setMenuOpen(false); setEndOfSessionOpen(true); }}
              >
                🐉 End of Session
              </button>
            </nav>
          )}
        </div>
      </div>

      {endOfSessionOpen && (
        <EndOfSessionModal
          open={endOfSessionOpen}
          onClose={() => setEndOfSessionOpen(false)}
        />
      )}
    </header>
  );
}
