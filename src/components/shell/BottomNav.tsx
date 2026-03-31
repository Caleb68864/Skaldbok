import { useLocation, Link } from 'react-router-dom';

const NAV_TABS = [
  { to: '/session', label: 'Session' },
  { to: '/notes', label: 'Notes' },
  { to: '/character/sheet', label: 'Character' },
] as const;

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
          label === 'Character'
            ? location.pathname.startsWith('/character')
            : location.pathname === to || location.pathname.startsWith(to + '/');

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
