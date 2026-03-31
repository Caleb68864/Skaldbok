import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CampaignHeader } from './CampaignHeader';
import { CharacterSubNav } from './CharacterSubNav';
import { BottomNav } from './BottomNav';
import { CampaignCreateModal } from '../../features/campaign/CampaignCreateModal';
import { ManagePartyDrawer } from '../../features/campaign/ManagePartyDrawer';
import { SessionLogOverlay } from '../../features/session/SessionLogOverlay';

export function ShellLayout() {
  const location = useLocation();
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showManageParty, setShowManageParty] = useState(false);
  const isCharacterTab = location.pathname.startsWith('/character');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <CampaignHeader
        onCreateCampaign={() => setShowCreateCampaign(true)}
        onManageParty={() => setShowManageParty(true)}
      />
      {isCharacterTab && <CharacterSubNav />}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <Outlet />
      </main>
      <BottomNav />
      {isCharacterTab && <SessionLogOverlay />}
      {showCreateCampaign && (
        <CampaignCreateModal onClose={() => setShowCreateCampaign(false)} />
      )}
      {showManageParty && (
        <ManagePartyDrawer onClose={() => setShowManageParty(false)} />
      )}
    </div>
  );
}
