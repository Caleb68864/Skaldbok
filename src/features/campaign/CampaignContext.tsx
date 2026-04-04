import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { db } from '../../storage/db/client';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { useToast } from '../../context/ToastContext';
import type { Campaign } from '../../types/campaign';
import type { Session } from '../../types/session';
import type { Party, PartyMember } from '../../types/party';

/**
 * Props for the internal {@link StaleSessionModal} dialog.
 */
interface StaleSessionModalProps {
  /** Title of the stale session shown in the dialog body. */
  sessionTitle: string;
  /** Called when the user chooses to end the session. */
  onEnd: () => void;
  /** Called when the user chooses to continue the session (dismisses the dialog). */
  onContinue: () => void;
}

/**
 * Modal dialog shown when an active session has been running for more than 24 hours.
 * Prompts the GM to either end or continue the session.
 *
 * @param props - {@link StaleSessionModalProps}
 */
function StaleSessionModal({ sessionTitle, onEnd, onContinue }: StaleSessionModalProps) {
  return (
    <div
      role="dialog"
      aria-label="Stale session warning"
      onClick={onContinue}
      className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-xl w-full max-w-[360px] px-4 py-6"
      >
        <h3 className="text-[var(--color-text)] mb-2">Stale Session</h3>
        <p className="text-[var(--color-text-muted)] mb-6">
          &ldquo;{sessionTitle}&rdquo; has been running for more than 24 hours. Would you like to end it or continue?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onEnd}
            className="flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer"
          >
            End It
          </button>
          <button
            onClick={onContinue}
            className="flex-1 min-h-11 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-base cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A {@link Party} record hydrated with its full list of {@link PartyMember} rows.
 *
 * @remarks
 * Used throughout the app wherever both party metadata and member details are
 * needed at the same time, avoiding a separate member lookup.
 */
export interface ActivePartyWithMembers extends Party {
  /** All members belonging to this party, loaded from `partyMembers`. */
  members: PartyMember[];
}

/**
 * Shape of the value provided by {@link CampaignContext} / consumed by
 * {@link useCampaignContext}.
 */
export interface CampaignContextValue {
  /** The currently active {@link Campaign}, or `null` when none is selected. */
  activeCampaign: Campaign | null;
  /** The currently active {@link Session}, or `null` when no session is running. */
  activeSession: Session | null;
  /**
   * The active party for the current campaign, hydrated with members, or `null`
   * when no party has been created yet.
   */
  activeParty: ActivePartyWithMembers | null;
  /**
   * The {@link PartyMember} that the local user has designated as "my character"
   * for this campaign, or `null` when none is set.
   */
  activeCharacterInCampaign: PartyMember | null;
  /**
   * Starts a new session for the active campaign.
   * No-op (with toast) when no campaign is active or a session is already running.
   */
  startSession: () => Promise<void>;
  /**
   * Marks the currently active session as ended.
   * No-op when no session is running.
   */
  endSession: () => Promise<void>;
  /**
   * Re-activates a previously ended session by ID.
   * No-op (with toast) when another session is already running.
   *
   * @param sessionId - ID of the session to resume.
   */
  resumeSession: (sessionId: string) => Promise<void>;
  /**
   * Switches the context to a different campaign, loading its active session
   * and party in the process.
   *
   * @param campaignId - ID of the campaign to activate.
   */
  setActiveCampaign: (campaignId: string) => Promise<void>;
  /**
   * Re-fetches the active party and its members from the database and updates
   * context state. Call after any mutation that adds, removes, or changes party
   * members or the active-character designation.
   */
  refreshParty: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

/**
 * Returns the nearest {@link CampaignContextValue} from the React tree.
 *
 * @remarks
 * Must be called inside a component that is a descendant of {@link CampaignProvider}.
 * Throws an error if called outside of that tree, making context misconfiguration
 * immediately obvious during development.
 *
 * @throws {Error} When called outside of a `CampaignProvider`.
 *
 * @returns The current {@link CampaignContextValue}.
 *
 * @example
 * ```tsx
 * const { activeCampaign, startSession } = useCampaignContext();
 * ```
 */
export function useCampaignContext(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error('useCampaignContext must be used within CampaignProvider');
  return ctx;
}

/** Threshold in milliseconds after which an active session is considered stale (24 hours). */
const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

/**
 * Queries the database for the party belonging to `campaignId` and joins its members.
 *
 * @param campaignId - Campaign whose party should be loaded.
 * @returns The party with members, or `null` if no party exists for this campaign.
 */
async function resolvePartyWithMembers(campaignId: string): Promise<ActivePartyWithMembers | null> {
  const party = await db.parties.where('campaignId').equals(campaignId).first();
  if (!party) return null;
  const members = await db.partyMembers.where('partyId').equals(party.id).toArray();
  return { ...party, members };
}

/**
 * Context provider that owns and exposes all active-campaign state.
 *
 * @remarks
 * Place this near the root of the application (inside `ToastProvider`). On mount
 * it hydrates from IndexedDB, picking up the most recently active campaign and
 * any running session. When the restored session is older than 24 hours a
 * {@link StaleSessionModal} is rendered asking the GM whether to end or continue it.
 *
 * @param props.children - React subtree that will have access to campaign context.
 *
 * @example
 * ```tsx
 * <ToastProvider>
 *   <CampaignProvider>
 *     <App />
 *   </CampaignProvider>
 * </ToastProvider>
 * ```
 */
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

  const resumeSession = useCallback(async (sessionId: string) => {
    if (activeSession) {
      showToast('End the current session first');
      return;
    }
    try {
      const session = await db.sessions.get(sessionId);
      if (!session) { showToast('Session not found'); return; }
      const now = nowISO();
      await db.sessions.update(sessionId, {
        status: 'active' as const,
        endedAt: undefined,
        updatedAt: now,
      });
      setActiveSession_({ ...session, status: 'active', endedAt: undefined, updatedAt: now });
    } catch (e) {
      showToast('Failed to resume session');
      console.error('resumeSession failed:', e);
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

  /** Ends the stale session and dismisses the modal. */
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

  /** Dismisses the stale-session modal without ending the session. */
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
        resumeSession,
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
