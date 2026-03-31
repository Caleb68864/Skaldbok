import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCampaignContext } from '../../features/campaign/CampaignContext';
import { useAppState } from '../../context/AppStateContext';
import { useFullscreen } from '../../hooks/useFullscreen';
import { useWakeLock } from '../../hooks/useWakeLock';
import { db } from '../../storage/db/client';
import type { Campaign } from '../../types/campaign';

// ── Campaign Selector Overlay ───────────────────────────────────

interface CampaignSelectorOverlayProps {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  onSelect: (campaignId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

function CampaignSelectorOverlay({
  campaigns,
  activeCampaignId,
  onSelect,
  onCreateNew,
  onClose,
}: CampaignSelectorOverlayProps) {
  return (
    <div
      role="dialog"
      aria-label="Campaign selector"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '0 0 12px 12px',
          width: '100%',
          maxWidth: 480,
          padding: '8px 0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        {campaigns.length === 0 && (
          <div style={{ padding: '12px 16px', color: 'var(--color-text-muted)' }}>
            No campaigns yet
          </div>
        )}
        {campaigns.map(campaign => (
          <button
            key={campaign.id}
            onClick={() => { onSelect(campaign.id); onClose(); }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 16px',
              minHeight: '44px',
              background: 'none',
              border: 'none',
              color: campaign.id === activeCampaignId ? 'var(--color-accent)' : 'var(--color-text)',
              fontWeight: campaign.id === activeCampaignId ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {campaign.name}
          </button>
        ))}
        <button
          onClick={() => { onCreateNew(); onClose(); }}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '12px 16px',
            minHeight: '44px',
            background: 'none',
            border: 'none',
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-accent)',
            cursor: 'pointer',
          }}
        >
          + Create Campaign
        </button>
      </div>
    </div>
  );
}

// ── Hamburger Menu ──────────────────────────────────────────────

function HamburgerMenu({ onClose, onManageParty }: { onClose: () => void; onManageParty: () => void }) {
  const { settings, toggleMode } = useAppState();
  const { isFullscreen, toggleFullscreen, isSupported: fsSupported } = useFullscreen();
  const { isActive: wakeLockActive, toggleWakeLock, isSupported: wlSupported } = useWakeLock();
  const isPlayMode = settings.mode === 'play';

  const menuItemStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '12px 16px',
    minHeight: '44px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '16px',
    textDecoration: 'none',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 250,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '280px',
          maxWidth: '80vw',
          background: 'var(--color-surface)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          maxHeight: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Mode toggle */}
        <button
          onClick={() => { toggleMode(); onClose(); }}
          style={{
            ...menuItemStyle,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            color: isPlayMode ? 'var(--color-mode-play, #27ae60)' : 'var(--color-mode-edit, #e67e22)',
          }}
        >
          {isPlayMode ? '⚔️ PLAY MODE' : '📝 EDIT MODE'}
        </button>

        <button onClick={() => { onManageParty(); onClose(); }} style={menuItemStyle}>
          Manage Party
        </button>

        <Link to="/settings" onClick={onClose} style={menuItemStyle}>Settings</Link>
        <Link to="/reference" onClick={onClose} style={menuItemStyle}>Reference</Link>
        <Link to="/library" onClick={onClose} style={menuItemStyle}>Character Library</Link>
        <Link to="/profile" onClick={onClose} style={menuItemStyle}>Profile</Link>

        {fsSupported && (
          <button onClick={() => { toggleFullscreen(); onClose(); }} style={menuItemStyle}>
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        )}

        {wlSupported && (
          <button onClick={() => { toggleWakeLock(); onClose(); }} style={menuItemStyle}>
            {wakeLockActive ? '🔒 Wake Lock On' : '🔓 Wake Lock Off'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Campaign Header ─────────────────────────────────────────────

interface CampaignHeaderProps {
  onCreateCampaign?: () => void;
  onManageParty?: () => void;
}

export function CampaignHeader({ onCreateCampaign, onManageParty }: CampaignHeaderProps) {
  const { activeCampaign, activeSession, activeCharacterInCampaign, setActiveCampaign } = useCampaignContext();
  const [showSelector, setShowSelector] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!showSelector) return;
    let mounted = true;
    db.campaigns.toArray().then(all => {
      if (mounted) setCampaigns(all);
    });
    return () => { mounted = false; };
  }, [showSelector]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          minHeight: '44px',
          background: 'var(--color-surface-raised)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Campaign selector button */}
        <button
          onClick={() => setShowSelector(true)}
          aria-label="Select campaign"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            minHeight: '44px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text)',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          <span style={{ flex: 1, textAlign: 'left' }}>
            <span>{activeCampaign ? activeCampaign.name : 'No campaign'}</span>
            {activeSession && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '12px', marginLeft: '8px' }}>
                {activeSession.title}
              </span>
            )}
            {activeCharacterInCampaign?.name && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, fontSize: '12px', marginLeft: '8px' }}>
                · {activeCharacterInCampaign.name}
              </span>
            )}
          </span>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>▼</span>
        </button>

        {/* Hamburger menu button */}
        <button
          onClick={() => setShowMenu(true)}
          aria-label="Menu"
          style={{
            minHeight: '44px',
            minWidth: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderLeft: '1px solid var(--color-border)',
            cursor: 'pointer',
            color: 'var(--color-text)',
            fontSize: '20px',
          }}
        >
          ☰
        </button>
      </div>

      {showSelector && (
        <CampaignSelectorOverlay
          campaigns={campaigns}
          activeCampaignId={activeCampaign?.id ?? null}
          onSelect={setActiveCampaign}
          onCreateNew={() => onCreateCampaign?.()}
          onClose={() => setShowSelector(false)}
        />
      )}
      {showMenu && (
        <HamburgerMenu
          onClose={() => setShowMenu(false)}
          onManageParty={() => onManageParty?.()}
        />
      )}
    </>
  );
}
