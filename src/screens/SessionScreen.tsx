import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { EndSessionModal } from '../features/campaign/EndSessionModal';
import { useExportActions } from '../features/export/useExportActions';
import { useToast } from '../context/ToastContext';
// NotesGrid kept for rollback safety — file not deleted per spec
// import { NotesGrid } from '../features/notes/NotesGrid';
import { VaultBrowser } from '../features/kb/VaultBrowser';
import { SessionQuickActions } from '../features/session/SessionQuickActions';
import { useEncounterList } from '../features/encounters/useEncounterList';
import { EncounterScreen } from '../features/encounters/EncounterScreen';
import {
  SessionEncounterProvider,
  useSessionEncounterContext,
} from '../features/session/SessionEncounterContext';
import { SessionTimelinePanel } from '../features/session/SessionTimelinePanel';
import { TiptapNoteEditor } from '../components/notes/TiptapNoteEditor';
import { getSessionsByCampaign } from '../storage/repositories/sessionRepository';
import { getNotesBySession } from '../storage/repositories/noteRepository';
import * as encounterRepository from '../storage/repositories/encounterRepository';
import type { Session } from '../types/session';
import type { Note } from '../types/note';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

const actionBtnClass = "min-h-11 min-w-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm font-medium whitespace-nowrap";
const primaryBtnClass = "min-h-11 min-w-11 px-5 py-2 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-base font-semibold cursor-pointer whitespace-nowrap";

export function SessionScreen() {
  const { activeCampaign, activeSession } = useCampaignContext();

  if (!activeCampaign) {
    return <NoCampaignPrompt />;
  }

  // When a session is active, wrap the session-scoped content in
  // SessionEncounterProvider so SessionBar, the Start Encounter form, and the
  // embedded EncounterScreen can all consume the same hook instance. When no
  // session is active, render the fallback view without the provider (the
  // provider requires a sessionId).
  if (activeSession) {
    return (
      <SessionEncounterProvider sessionId={activeSession.id}>
        <ActiveSessionContent />
      </SessionEncounterProvider>
    );
  }

  return <NoActiveSessionContent />;
}

/**
 * Rendered when the user has selected a campaign but has no currently active
 * session. Shows past sessions and the "Start Session" button. Rendered
 * OUTSIDE SessionEncounterProvider because the provider requires a sessionId.
 */
function NoActiveSessionContent() {
  const navigate = useNavigate();
  const { activeCampaign, startSession, resumeSession } = useCampaignContext();
  const { exportSessionMarkdown, exportSessionBundle } = useExportActions();
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [lastSessionNoteCount, setLastSessionNoteCount] = useState(0);

  useEffect(() => {
    if (!activeCampaign) return;
    let mounted = true;
    setLoadingPast(true);
    getSessionsByCampaign(activeCampaign.id).then(sessions => {
      if (!mounted) return;
      const ended = sessions
        .filter(s => s.status === 'ended')
        .sort((a, b) => b.date.localeCompare(a.date));
      setPastSessions(ended);
      if (ended.length > 0) {
        getNotesBySession(ended[0].id).then((notes: Note[]) => {
          if (mounted) setLastSessionNoteCount(notes.length);
        });
      }
      setLoadingPast(false);
    }).catch(() => {
      if (mounted) setLoadingPast(false);
    });
    return () => { mounted = false; };
  }, [activeCampaign?.id]);

  if (!activeCampaign) return null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[var(--color-text)] m-0">{activeCampaign.name}</h2>
        <button
          onClick={() => navigate('/bestiary')}
          className={actionBtnClass}
        >
          Bestiary
        </button>
      </div>

      <div className="mb-4">
        {pastSessions.length > 0 ? (
          <div className="bg-[var(--color-surface-raised)] rounded-lg px-4 py-3 mb-3">
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-[0.05em] mb-1">
              Last Session
            </p>
            <p className="text-[var(--color-text)] font-semibold mb-0.5">
              {pastSessions[0].title}
            </p>
            <p className="text-[var(--color-text-muted)] text-[13px]">
              {formatDate(pastSessions[0].date)}
              {lastSessionNoteCount > 0 && ` · ${lastSessionNoteCount} note${lastSessionNoteCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        ) : (
          <p className="text-[var(--color-text-muted)] mb-3 text-sm">
            No sessions yet.
          </p>
        )}
        <button onClick={() => startSession()} className={primaryBtnClass}>
          Start Session
        </button>
      </div>

      {!loadingPast && pastSessions.length > 0 && (
        <div>
          <h3 className="text-[var(--color-text)] mb-2">Past Sessions</h3>
          {pastSessions.map(session => (
            <div
              key={session.id}
              className="bg-[var(--color-surface-raised)] rounded-lg p-3 mb-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--color-text)] font-semibold mb-0.5">
                    {session.title}
                  </p>
                  <p className="text-[var(--color-text-muted)] text-xs">
                    {formatDate(session.date)}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => resumeSession(session.id)}
                    className="min-h-11 px-3 py-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-md cursor-pointer text-xs font-semibold"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => exportSessionMarkdown(session.id)}
                    className="min-h-11 px-3 py-1.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
                  >
                    .md
                  </button>
                  <button
                    onClick={() => exportSessionBundle(session.id)}
                    className="min-h-11 px-3 py-1.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
                  >
                    .zip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <VaultBrowser campaignId={activeCampaign.id} compact />
    </div>
  );
}

/**
 * Rendered inside <SessionEncounterProvider> when the user has an active
 * session. Has access to useSessionEncounterContext for all encounter
 * lifecycle operations.
 */
function ActiveSessionContent() {
  const navigate = useNavigate();
  const { activeCampaign, activeSession, endSession } = useCampaignContext();
  const { exportSessionMarkdown, exportSessionBundle, exportSessionSkaldmark } = useExportActions();
  const { showToast } = useToast();

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [elapsed, setElapsed] = useState('');
  const [viewingEncounterId, setViewingEncounterId] = useState<string | null>(null);
  const [showStartEncounter, setShowStartEncounter] = useState(false);
  const [newEncounterType, setNewEncounterType] = useState<'combat' | 'social' | 'exploration'>('combat');
  const [newEncounterTitle, setNewEncounterTitle] = useState('');
  const [newEncounterDescription, setNewEncounterDescription] = useState<unknown>(null);
  const [newEncounterTagsInput, setNewEncounterTagsInput] = useState('');
  const [newEncounterLocation, setNewEncounterLocation] = useState('');
  const [newEncounterParentOverride, setNewEncounterParentOverride] = useState<'auto' | 'none' | string>('auto');
  const [submittingEncounter, setSubmittingEncounter] = useState(false);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [timelineRefreshToken, setTimelineRefreshToken] = useState(0);

  const { encounters, refresh: refreshEncounters } = useEncounterList(activeSession?.id ?? null);
  const {
    activeEncounter,
    recentEnded,
    startEncounter,
    reopenEncounter,
  } = useSessionEncounterContext();

  // Session timer
  const formatElapsed = useCallback((startedAt: string) => {
    const ms = Date.now() - new Date(startedAt).getTime();
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, []);

  useEffect(() => {
    if (!activeSession?.startedAt) { setElapsed(''); return; }
    setElapsed(formatElapsed(activeSession.startedAt));
    const interval = setInterval(() => {
      setElapsed(formatElapsed(activeSession.startedAt));
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSession?.startedAt, formatElapsed]);

  useEffect(() => {
    if (!activeCampaign) return;
    let mounted = true;
    setLoadingPast(true);
    getSessionsByCampaign(activeCampaign.id).then(sessions => {
      if (!mounted) return;
      const ended = sessions
        .filter(s => s.status === 'ended')
        .sort((a, b) => b.date.localeCompare(a.date));
      setPastSessions(ended);
      setLoadingPast(false);
    }).catch(() => {
      if (mounted) setLoadingPast(false);
    });
    return () => { mounted = false; };
  }, [activeCampaign?.id, activeSession]);

  const handleEndSession = () => {
    setShowEndConfirm(true);
  };

  const confirmEndSession = async () => {
    // End any active encounters before ending the session
    if (activeEncounter) {
      await encounterRepository.end(activeEncounter.id);
      refreshEncounters();
    }
    await endSession();
    setShowEndConfirm(false);
  };

  const resetStartEncounterForm = () => {
    setNewEncounterTitle('');
    setNewEncounterDescription(null);
    setNewEncounterTagsInput('');
    setNewEncounterLocation('');
    setNewEncounterParentOverride('auto');
    setNewEncounterType('combat');
  };

  const handleStartEncounter = async () => {
    if (!newEncounterTitle.trim() || submittingEncounter) return;
    setSubmittingEncounter(true);
    try {
      const tags = newEncounterTagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      let parentOverride: string | null | undefined;
      if (newEncounterParentOverride === 'auto') {
        parentOverride = undefined;
      } else if (newEncounterParentOverride === 'none') {
        parentOverride = null;
      } else {
        parentOverride = newEncounterParentOverride;
      }

      // Read BEFORE calling startEncounter so we can show an auto-end toast.
      const prior = activeEncounter;

      const newEnc = await startEncounter({
        title: newEncounterTitle.trim(),
        type: newEncounterType,
        description: newEncounterDescription ?? undefined,
        tags,
        location: newEncounterLocation.trim() || undefined,
        parentOverride,
      });

      if (prior && prior.id !== newEnc.id) {
        showToast(`${prior.title} ended, ${newEnc.title} started`, 'info', 3000);
      }

      setShowStartEncounter(false);
      resetStartEncounterForm();
      refreshEncounters();
      setTimelineRefreshToken((currentToken) => currentToken + 1);
    } finally {
      setSubmittingEncounter(false);
    }
  };

  if (!activeCampaign || !activeSession) return null;

  // Show full encounter screen when viewing one. The EncounterScreen sits
  // INSIDE the SessionEncounterProvider so it can call endEncounter via the
  // context.
  if (viewingEncounterId) {
    return (
      <EncounterScreen
        encounterId={viewingEncounterId}
        sessionId={activeSession.id}
        campaignId={activeCampaign.id}
        onClose={() => {
          setViewingEncounterId(null);
          refreshEncounters();
          setTimelineRefreshToken((currentToken) => currentToken + 1);
        }}
      />
    );
  }

  // Options for the "Started during" parent-override picker. Uses recentEnded
  // + the current active encounter if present (dedup by id).
  const parentOptionIds = new Set<string>();
  const parentOptions: { id: string; label: string }[] = [];
  if (activeEncounter) {
    parentOptionIds.add(activeEncounter.id);
    parentOptions.push({ id: activeEncounter.id, label: `${activeEncounter.title} (active)` });
  }
  for (const enc of recentEnded) {
    if (!parentOptionIds.has(enc.id)) {
      parentOptionIds.add(enc.id);
      parentOptions.push({ id: enc.id, label: enc.title });
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2 mt-3">
        <h2 className="text-[var(--color-text)] m-0">{activeCampaign.name}</h2>
        <button
          onClick={() => navigate('/bestiary')}
          className={actionBtnClass}
        >
          Bestiary
        </button>
      </div>

      <div className="bg-[var(--color-surface-raised)] rounded-lg p-4 mb-4">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className="text-[var(--color-text)] m-0">{activeSession.title}</h3>
          {elapsed && (
            <span className="text-[var(--color-accent)] text-sm font-semibold tabular-nums">
              {elapsed}
            </span>
          )}
        </div>
        <p className="text-[var(--color-text-muted)] mb-3 text-sm">
          Started: {formatDateTime(activeSession.startedAt)}
        </p>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleEndSession} className={primaryBtnClass}>
            End Session
          </button>
          <button onClick={() => exportSessionMarkdown(activeSession.id)} className={actionBtnClass}>
            Export Session
          </button>
          <button onClick={() => exportSessionBundle(activeSession.id)} className={actionBtnClass}>
            Export + Notes (ZIP)
          </button>
          <button onClick={() => exportSessionSkaldmark(activeSession.id, false)} className={actionBtnClass}>
            Export (.skaldbok)
          </button>
        </div>

        <div className="mt-4">
          <SessionQuickActions onLogComplete={() => setTimelineRefreshToken((currentToken) => currentToken + 1)} />
        </div>
      </div>

      <SessionTimelinePanel
        session={activeSession}
        encounters={encounters}
        activeEncounter={activeEncounter}
        onStartEncounter={() => setShowStartEncounter(true)}
        onOpenEncounter={(encounterId) => setViewingEncounterId(encounterId)}
        onReopenEncounter={async (encounterId) => {
          await reopenEncounter(encounterId);
          await refreshEncounters();
          setTimelineRefreshToken((currentToken) => currentToken + 1);
        }}
        onOpenNote={(noteId) => navigate(`/note/${noteId}/edit`)}
        refreshToken={timelineRefreshToken}
      />

      {/* Start encounter modal */}
      {showStartEncounter && (
        <div
          role="dialog"
          aria-label="Start encounter"
          onClick={() => {
            if (!submittingEncounter) setShowStartEncounter(false);
          }}
          className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] px-4 pt-5 pb-6 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-[var(--color-text)] mb-3">Start Encounter</h3>

            {/* Type */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Type
            </label>
            <div className="flex gap-2 mb-3">
              {(['combat', 'social', 'exploration'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewEncounterType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-none cursor-pointer ${
                    newEncounterType === t
                      ? 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Title */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Title
            </label>
            <input
              type="text"
              placeholder="Encounter title"
              value={newEncounterTitle}
              onChange={e => setNewEncounterTitle(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base mb-3 box-border"
              autoFocus
            />

            {/* Description */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Description
            </label>
            <div className="mb-3">
              <TiptapNoteEditor
                initialContent={newEncounterDescription}
                onChange={setNewEncounterDescription}
                campaignId={activeSession.campaignId}
                placeholder="Scene-setting (optional)…"
                showToolbar={false}
                minHeight="100px"
              />
            </div>

            {/* Tags */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. ambush, forest, kobolds"
              value={newEncounterTagsInput}
              onChange={e => setNewEncounterTagsInput(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-3 box-border"
            />

            {/* Location */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. Riverside Clearing"
              value={newEncounterLocation}
              onChange={e => setNewEncounterLocation(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-3 box-border"
            />

            {/* Started during override */}
            <label className="block text-[var(--color-text-muted)] text-xs uppercase tracking-wide mb-1">
              Started during
            </label>
            <select
              value={newEncounterParentOverride}
              onChange={e => setNewEncounterParentOverride(e.target.value)}
              className="w-full px-3 py-2.5 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm mb-3 box-border"
            >
              <option value="auto">Auto (current active)</option>
              <option value="none">None (unrelated)</option>
              {parentOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleStartEncounter}
                disabled={!newEncounterTitle.trim() || submittingEncounter}
                className={`flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-sm font-semibold cursor-pointer ${
                  !newEncounterTitle.trim() || submittingEncounter ? 'opacity-60' : ''
                }`}
              >
                {submittingEncounter ? 'Starting…' : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!submittingEncounter) {
                    setShowStartEncounter(false);
                    resetStartEncounterForm();
                  }
                }}
                className="min-h-11 px-4 bg-[var(--color-surface-raised)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past sessions list */}
      {!loadingPast && pastSessions.length > 0 && (
        <div>
          <h3 className="text-[var(--color-text)] mb-2">Past Sessions</h3>
          {pastSessions.map(session => (
            <div
              key={session.id}
              className="bg-[var(--color-surface-raised)] rounded-lg p-3 mb-2"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[var(--color-text)] font-semibold mb-0.5">
                    {session.title}
                  </p>
                  <p className="text-[var(--color-text-muted)] text-xs">
                    {formatDate(session.date)}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <button
                    onClick={() => exportSessionMarkdown(session.id)}
                    className="min-h-11 px-3 py-1.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
                  >
                    .md
                  </button>
                  <button
                    onClick={() => exportSessionBundle(session.id)}
                    className="min-h-11 px-3 py-1.5 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-xs"
                  >
                    .zip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vault Browser (compact mode — session-scoped notes) */}
      <VaultBrowser
        campaignId={activeCampaign.id}
        sessionId={activeSession.id}
        compact
      />

      {showEndConfirm && (
        <EndSessionModal
          sessionTitle={activeSession.title}
          hasActiveEncounter={!!activeEncounter}
          onConfirm={confirmEndSession}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}
