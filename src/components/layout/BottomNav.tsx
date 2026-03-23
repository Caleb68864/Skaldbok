import { NavLink } from 'react-router-dom';
import { GameIcon } from '../primitives/GameIcon';
import { useAppState } from '../../context/AppStateContext';
import { DEFAULT_BOTTOM_NAV_TABS } from '../../features/settings/useAppSettings';

const NAV_ITEMS = [
  { to: '/sheet', label: 'Sheet', icon: 'person', defaultVisible: true },
  { to: '/skills', label: 'Skills', icon: 'dice-six-faces-six', defaultVisible: true },
  { to: '/gear', label: 'Gear', icon: 'backpack', defaultVisible: true },
  { to: '/magic', label: 'Magic', icon: 'spell-book', defaultVisible: true },
  { to: '/combat', label: 'Combat', icon: 'crossed-swords', defaultVisible: true },
  { to: '/reference', label: 'Reference', icon: 'scroll-unfurled', defaultVisible: true },
  // Profile tab — off by default; configurable via Settings (SS-08)
  { to: '/profile', label: 'Profile', icon: 'person', defaultVisible: false },
] as const;

export function BottomNav() {
  const { settings } = useAppState();
  // Merge stored bottomNavTabs with defaults to ensure all keys are present
  const bottomNavTabs: Record<string, boolean> = {
    ...DEFAULT_BOTTOM_NAV_TABS,
    ...(settings.bottomNavTabs ?? {}),
  };

  // Filter tabs by visibility settings
  const visibleItems = NAV_ITEMS.filter(item =>
    bottomNavTabs[item.label.toLowerCase()] ?? item.defaultVisible
  );

  // If all tabs are hidden, render nothing — hamburger menu remains fallback
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <nav className="bottom-nav" aria-label="Bottom navigation">
      {visibleItems.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'
          }
        >
          <GameIcon name={icon} size={20} />
          <span className="bottom-nav__label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
