import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ManagePartyDrawer } from '../features/campaign/ManagePartyDrawer';

export function MoreScreen() {
  const [showParty, setShowParty] = useState(false);

  return (
    <div className="p-4">
      <h2 className="text-[var(--color-text)] mb-4">More</h2>

      <button
        onClick={() => setShowParty(true)}
        className="block w-full text-left py-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base"
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
          className="block py-3 min-h-11 border-b border-b-[var(--color-border)] text-[var(--color-text)] no-underline text-base"
        >
          {label}
        </Link>
      ))}

      {showParty && <ManagePartyDrawer onClose={() => setShowParty(false)} />}
    </div>
  );
}
