import { useLocation, Link } from 'react-router-dom';

const CHARACTER_TABS = [
  { to: '/character/sheet', label: 'Sheet' },
  { to: '/character/skills', label: 'Skills' },
  { to: '/character/gear', label: 'Gear' },
  { to: '/character/magic', label: 'Magic' },
  { to: '/character/combat', label: 'Combat' },
] as const;

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
