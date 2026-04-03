import { useLocation, Link } from 'react-router-dom';

/**
 * Top-level navigation tabs rendered inside {@link BottomNav}.
 *
 * Each entry defines the route `to` path and the human-readable `label` shown
 * in the tab bar. The array is `as const` so TypeScript can narrow the literal
 * types when computing the active state.
 */
const NAV_TABS = [
  { to: '/character/sheet', label: 'Characters' },
  { to: '/session', label: 'Session' },
  { to: '/reference', label: 'Reference' },
] as const;

/**
 * Persistent bottom navigation bar rendered by {@link ShellLayout} on every
 * route.
 *
 * @remarks
 * Renders three top-level tabs — Characters, Session, and Reference — as
 * React Router `<Link>` elements. The active tab is highlighted using the
 * accent colour and increased font weight.
 *
 * Active-tab detection uses path-prefix matching so that any nested route
 * under `/character/**` keeps the "Characters" tab highlighted. The "Session"
 * and "Reference" tabs match their root path exactly or as a prefix.
 *
 * All interactive targets meet the 44 × 44 px minimum touch target size.
 *
 * @example
 * // Rendered automatically by ShellLayout — no props required.
 * <BottomNav />
 */
export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        display: 'flex',
        flexDirection: 'row',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      {NAV_TABS.map(({ to, label }) => {
        const isActive =
          label === 'Characters'
            ? location.pathname.startsWith('/character')
            : label === 'Session'
            ? location.pathname === '/session' || location.pathname.startsWith('/session/')
            : label === 'Reference'
            ? location.pathname === '/reference' || location.pathname.startsWith('/reference/')
            : false;

        return (
          <Link
            key={to}
            to={to}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              minWidth: '44px',
              textDecoration: 'none',
              color: isActive ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontWeight: isActive ? 600 : 400,
              fontSize: '12px',
              padding: '6px 4px',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
