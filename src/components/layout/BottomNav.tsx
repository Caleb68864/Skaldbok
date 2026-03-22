import { NavLink } from 'react-router-dom';
import { GameIcon } from '../primitives/GameIcon';

const NAV_ITEMS = [
  { to: '/sheet', label: 'Sheet', icon: 'person' },
  { to: '/skills', label: 'Skills', icon: 'dice-six-faces-six' },
  { to: '/gear', label: 'Gear', icon: 'backpack' },
  { to: '/magic', label: 'Magic', icon: 'spell-book' },
  { to: '/combat', label: 'Combat', icon: 'crossed-swords' },
  { to: '/reference', label: 'Reference', icon: 'scroll-unfurled' },
] as const;

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'
          }
        >
          <GameIcon name={icon} size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
