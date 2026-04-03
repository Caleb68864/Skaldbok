import { useLocation, Link } from 'react-router-dom';

/**
 * Secondary navigation tabs displayed below the campaign header when the user
 * is inside the `/character` section of the app.
 *
 * Each entry maps a route `to` path to a `label` rendered in the pill chip.
 * The array is `as const` so TypeScript narrows the literal types used during
 * active-state calculation.
 */
const CHARACTER_TABS = [
  { to: '/character/sheet', label: 'Sheet' },
  { to: '/character/skills', label: 'Skills' },
  { to: '/character/gear', label: 'Gear' },
  { to: '/character/magic', label: 'Magic' },
] as const;

/**
 * Horizontal pill-chip sub-navigation bar for the character section.
 *
 * @remarks
 * Rendered by {@link ShellLayout} only when the current route starts with
 * `/character`. Provides four tabs — Sheet, Skills, Gear, and Magic — as
 * React Router `<Link>` elements styled as pill-shaped chips.
 *
 * The active chip uses the accent background colour and white text. The row
 * scrolls horizontally (`overflow-x: auto`) on narrow viewports so all tabs
 * remain reachable without wrapping.
 *
 * Active-tab detection matches the exact path or any sub-route beneath it
 * (e.g., `/character/sheet/some-sub-view` keeps the "Sheet" chip active).
 *
 * All chips meet the 44 px minimum touch target height.
 *
 * @example
 * // Rendered automatically by ShellLayout when on a /character/* route.
 * <CharacterSubNav />
 */
export function CharacterSubNav() {
  const location = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        padding: '8px 12px',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        overflowX: 'auto',
      }}
    >
      {CHARACTER_TABS.map(({ to, label }) => {
        const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
        return (
          <Link
            key={to}
            to={to}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              padding: '0 16px',
              borderRadius: '22px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'var(--color-accent)' : 'var(--color-surface-raised)',
              color: isActive ? 'var(--color-on-accent, #fff)' : 'var(--color-text)',
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
