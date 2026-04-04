import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, Maximize, Minimize, Lock, Unlock, ClipboardList, Dices, Backpack, BookOpen, Swords, BookMarked, User, Settings, Drama } from 'lucide-react';
import { useAppState } from '../../context/AppStateContext';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { GameIcon } from '../primitives/GameIcon';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { EndOfSessionModal } from '../modals/EndOfSessionModal';
import { cn } from '@/lib/utils';

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
      className={cn(
        'top-bar bg-surface',
        isPlayMode ? 'border-b-[3px] border-b-[var(--color-mode-play)]' : 'border-b-[3px] border-b-[var(--color-mode-edit)]',
      )}
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
          className={cn(
            'top-bar__btn inline-flex items-center gap-2 font-bold border-none',
            isPlayMode ? 'bg-[var(--color-mode-play)] text-bg' : 'bg-[var(--color-mode-edit)] text-bg',
          )}
          onClick={toggleMode}
          aria-label={isPlayMode ? 'Switch to Edit Mode' : 'Switch to Play Mode'}
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
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        )}

        {wlSupported && (
          <button
            className={cn(
              'top-bar__btn',
              wakeLockActive ? 'text-success' : 'text-text-muted',
            )}
            onClick={toggleWakeLock}
            aria-label={wakeLockActive ? 'Disable wake lock' : 'Enable wake lock'}
            title={wakeLockActive ? 'Wake lock active' : 'Wake lock inactive'}
          >
            {wakeLockActive ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </button>
        )}

        {/* Hamburger menu */}
        <div ref={menuRef} className="relative">
          <button
            className="top-bar__btn"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            title="More options"
          >
            <Menu className="h-5 w-5" />
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
                <ClipboardList className="h-4 w-4 inline mr-2" /> Sheet
              </NavLink>
              <NavLink
                to="/skills"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <Dices className="h-4 w-4 inline mr-2" /> Skills
              </NavLink>
              <NavLink
                to="/gear"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <Backpack className="h-4 w-4 inline mr-2" /> Gear
              </NavLink>
              <NavLink
                to="/magic"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <BookOpen className="h-4 w-4 inline mr-2" /> Magic
              </NavLink>
              <NavLink
                to="/combat"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <Swords className="h-4 w-4 inline mr-2" /> Combat
              </NavLink>
              <NavLink
                to="/reference"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <BookMarked className="h-4 w-4 inline mr-2" /> Reference
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <User className="h-4 w-4 inline mr-2" /> Profile
              </NavLink>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  isActive ? 'topbar-menu__item topbar-menu__item--active' : 'topbar-menu__item'
                }
                onClick={() => setMenuOpen(false)}
              >
                <Settings className="h-4 w-4 inline mr-2" /> Settings
              </NavLink>
              <button
                className="topbar-menu__item topbar-menu__item--action"
                onClick={() => { setMenuOpen(false); setEndOfSessionOpen(true); }}
              >
                <Drama className="h-4 w-4 inline mr-2" /> End of Session
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
