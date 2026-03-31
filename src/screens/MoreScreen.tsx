import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagePartyDrawer } from '../features/campaign/ManagePartyDrawer';

export function MoreScreen() {
  const [showParty, setShowParty] = useState(false);

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: '16px' }}>More</h2>

      <button
        onClick={() => setShowParty(true)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '12px 0',
          minHeight: '44px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontSize: '16px',
        } as React.CSSProperties}
      >
        Manage Party
      </button>

      {[
        { to: '/settings', label: 'Settings' },
        { to: '/reference', label: 'Reference' },
        { to: '/library', label: 'Character Library' },
        { to: '/profile', label: 'Profile' },
      ].map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          style={{
            display: 'block',
            padding: '12px 0',
            minHeight: '44px',
            borderBottom: '1px solid var(--color-border)',
            color: 'var(--color-text)',
            textDecoration: 'none',
            fontSize: '16px',
          }}
        >
          {label}
        </Link>
      ))}

      {showParty && <ManagePartyDrawer onClose={() => setShowParty(false)} />}
    </div>
  );
}
