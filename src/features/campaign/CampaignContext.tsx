import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { db } from '../../storage/db/client';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useToast } from '../../context/ToastContext';
import type { Campaign } from '../../types/campaign';
import type { Session } from '../../types/session';
import type { Party, PartyMember } from '../../types/party';

interface StaleSessionModalProps {
  sessionTitle: string;
  onEnd: () => void;
  onContinue: () => void;
}

function StaleSessionModal({ sessionTitle, onEnd, onContinue }: StaleSessionModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Stale session warning"
      onClick={onContinue}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: 360,
          padding: '24px 16px',
        }}
      >
        <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>Stale Session</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
          &ldquo;{sessionTitle}&rdquo; has been running for more than 24 hours. Would you like to end it or continue?
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onEnd}
            style={{
              flex: 1,
              minHeight: '44px',
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent, #fff)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            End It
          </button>
          <button
            onClick={onContinue}
            style={{
              flex: 1,
              minHeight: '44px',
              background: 'var(--color-surface-raised)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ActivePartyWithMembers extends Party {
  members: PartyMember[];
}

export interface CampaignContextValue {
  activeCampaign: Campaign | null;
  activeSession: Session | null;
  activeParty: ActivePartyWithMembers | null;
  activeCharacterInCampaign: PartyMember | null;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  setActiveCampaign: (campaignId: string) => Promise<void>;
  refreshParty: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function useCampaignContext(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaignContext must be used within CampaignProvider');
  return ctx;
}

const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

async function resolvePartyWithMembers(campaignId: string): Promise<ActivePartyWithMembers | null> {
  const party = await db.parties.where('campaignId').equals(campaignId).first();
  if (!party) return null;
  const members = await db.partyMembers.where('partyId').equals(party.id).toArray();
  return { ...party, members };
}

export function CampaignProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();
  const [activeCampaign, setActiveCampaign_] = useState<Campaign | null>(null);
  const [activeSession, setActiveSession_] = useState<Session | null>(null);
  const [activeParty, setActiveParty_] = useState<ActivePartyWithMembers | null>(null);
  const [activeCharacterInCampaign, setActiveCharacterInCampaign_] = useState<PartyMember | null>(null);
  const [staleSession, setStaleSession] = useState<Session | null>(null);

  // Hydrate on mount
  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const campaign = await db.campaigns.where('status').equals('active').first();
        if (!mounted) return;

        if (!campaign) {
          setActiveCampaign_(null);
          setActiveSession_(null);
          setActiveParty_(null);
          setActiveCharacterInCampaign_(null);
          return;
        }

        setActiveCampaign_(campaign);

        const session = await db.sessions
          .where({ campaignId: campaign.id, status: 'active' })
          .first();
        if (!mounted) return;
        setActiveSession_(session ?? null);

        const party = await resolvePartyWithMembers(campaign.id);
        if (!mounted) return;
        setActiveParty_(party);

        // Resolve active character in campaign
        if (campaign.activeCharacterMemberId && party) {
          const member = party.members.find(m => m.id === campaign.activeCharacterMemberId) ?? null;
          setActiveCharacterInCampaign_(member);
        } else {
          setActiveCharacterInCampaign_(null);
        }

        // Stale session warning (AC-S3-06)
        if (session && Date.now() - new Date(session.startedAt).getTime() > STALE_SESSION_MS) {
          setStaleSession(session);
        }
      } catch (e) {
        console.error('CampaignProvider hydration failed:', e);
      }
    }

    hydrate();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback(async () => {
    if (!activeCampaign) {
      showToast('No active campaign');
      return;
    }
    if (activeSession) {
      showToast('A session is already active');
      return;
    }

    try {
      const sessionCount = await db.sessions.where('campaignId').equals(activeCampaign.id).count();
      const now = nowISO();
      const dateStr = now.slice(0, 10);
      const title = `Session ${sessionCount + 1} — ${dateStr}`;

      const newSession: Session = {
        id: generateId(),
        campaignId: activeCampaign.id,
        title,
        status: 'active',
        date: dateStr,
        startedAt: now,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };

      await db.sessions.add(newSession);
      setActiveSession_(newSession);
    } catch (e) {
      showToast('Failed to start session');
      console.error('startSession failed:', e);
    }
  }, [activeCampaign, activeSession, showToast]);

  const endSession = useCallback(async () => {
    if (!activeSession) return;

    try {
      const now = nowISO();
      await db.sessions.update(activeSession.id, {
        status: 'ended',
        endedAt: now,
        updatedAt: now,
      });
      setActiveSession_(null);
    } catch (e) {
      showToast('Failed to end session');
      console.error('endSession failed:', e);
    }
  }, [activeSession, showToast]);

  const setActiveCampaign = useCallback(async (campaignId: string) => {
    try {
      const campaign = await db.campaigns.get(campaignId);
      if (!campaign) {
        showToast('Campaign not found');
        return;
      }

      setActiveCampaign_(campaign);

      const session = await db.sessions
        .where({ campaignId, status: 'active' })
        .first();
      setActiveSession_(session ?? null);

      const party = await resolvePartyWithMembers(campaignId);
      setActiveParty_(party);

      if (campaign.activeCharacterMemberId && party) {
        const member = party.members.find(m => m.id === campaign.activeCharacterMemberId) ?? null;
        setActiveCharacterInCampaign_(member);
      } else {
        setActiveCharacterInCampaign_(null);
      }
    } catch (e) {
      showToast('Failed to switch campaign');
      console.error('setActiveCampaign failed:', e);
    }
  }, [showToast]);

  const refreshParty = useCallback(async () => {
    if (!activeCampaign) return;
    try {
      const party = await resolvePartyWithMembers(activeCampaign.id);
      setActiveParty_(party);

      if (activeCampaign.activeCharacterMemberId && party) {
        const member = party.members.find(m => m.id === activeCampaign.activeCharacterMemberId) ?? null;
        setActiveCharacterInCampaign_(member);
      } else {
        setActiveCharacterInCampaign_(null);
      }
    } catch (e) {
      console.error('refreshParty failed:', e);
    }
  }, [activeCampaign]);

  const handleStaleEnd = useCallback(async () => {
    if (!staleSession) return;
    try {
      const now = nowISO();
      await db.sessions.update(staleSession.id, {
        status: 'ended',
        endedAt: now,
        updatedAt: now,
      });
      setActiveSession_(null);
    } catch (e) {
      showToast('Failed to end stale session');
      console.error('handleStaleEnd failed:', e);
    }
    setStaleSession(null);
  }, [staleSession, showToast]);

  const handleStaleContinue = useCallback(() => {
    setStaleSession(null);
  }, []);

  return (
    <CampaignContext.Provider
      value={{
        activeCampaign,
        activeSession,
        activeParty,
        activeCharacterInCampaign,
        startSession,
        endSession,
        setActiveCampaign,
        refreshParty,
      }}
    >
      {children}
      {staleSession && (
        <StaleSessionModal
          sessionTitle={staleSession.title}
          onEnd={handleStaleEnd}
          onContinue={handleStaleContinue}
        />
      )}
    </CampaignContext.Provider>
  );
}
