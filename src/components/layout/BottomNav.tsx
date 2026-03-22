import { NavLink } from 'react-router-dom';

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/sheet" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Sheet
      </NavLink>
      <NavLink to="/skills" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Skills
      </NavLink>
      <NavLink to="/gear" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Gear
      </NavLink>
      <NavLink to="/magic" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Magic
      </NavLink>
      <NavLink to="/combat" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Combat
      </NavLink>
      <NavLink to="/reference" className={({ isActive }) => isActive ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}>
        Reference
      </NavLink>
    </nav>
  );
}
