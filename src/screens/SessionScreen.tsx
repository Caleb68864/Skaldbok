import { useState, useEffect, useCallback } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { EndSessionModal } from '../features/campaign/EndSessionModal';
import { useExportActions } from '../features/export/useExportActions';
import { CombatTimeline } from '../features/combat/CombatTimeline';
import { useNoteActions } from '../features/notes/useNoteActions';
import { NotesGrid } from '../features/notes/NotesGrid';
import { SessionQuickActions } from '../features/session/SessionQuickActions';
import { getNotesBySession } from '../storage/repositories/noteRepository';
import { getSessionsByCampaign } from '../storage/repositories/sessionRepository';
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
  const { activeCampaign, activeSession, startSession, endSession, resumeSession } = useCampaignContext();
  const { exportSessionMarkdown, exportSessionBundle, exportAllNotes } = useExportActions();
  const { createNote } = useNoteActions();
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [activeCombatNoteId, setActiveCombatNoteId] = useState<string | null>(null);
  const [showCombatView, setShowCombatView] = useState(false);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);
  const [lastSessionNoteCount, setLastSessionNoteCount] = useState(0);
  const [elapsed, setElapsed] = useState('');

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
  }, [activeCampaign?.id, activeSession]);

  useEffect(() => {
    if (!activeSession) {
      setActiveCombatNoteId(null);
      setShowCombatView(false);
      return;
    }
    let mounted = true;
    getNotesBySession(activeSession.id).then((notes: Note[]) => {
      if (!mounted) return;
      const activeCombat = notes.find(n => n.type === 'combat' && n.status === 'active');
      setActiveCombatNoteId(activeCombat?.id ?? null);
    });
    return () => { mounted = false; };
  }, [activeSession?.id]);

  const handleStartSession = async () => {
    await startSession();
  };

  const handleEndSession = () => {
    setShowEndConfirm(true);
  };

  const confirmEndSession = async () => {
    await endSession();
    setShowEndConfirm(false);
  };

  const handleStartCombat = async () => {
    const note = await createNote({
      title: `Combat — Round 1`,
      type: 'combat',
      body: null,
      pinned: false,
      status: 'active',
      typeData: { rounds: [{ roundNumber: 1, events: [] }], participants: [] },
    });
    if (note) {
      setActiveCombatNoteId(note.id);
      setShowCombatView(true);
    }
  };

  if (!activeCampaign) {
    return <NoCampaignPrompt />;
  }

  return (
    <div className="p-4">
      <h2 className="text-[var(--color-text)] mb-2">{activeCampaign.name}</h2>

      {activeSession ? (
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
          </div>

          {/* Quick session actions — hidden during combat to prevent overlay */}
          {!showCombatView && (
            <div className="mt-4">
              <SessionQuickActions />
            </div>
          )}

          {/* Combat section */}
          {showCombatView && activeCombatNoteId ? (
            <CombatTimeline
              combatNoteId={activeCombatNoteId}
              onClose={() => {
                setShowCombatView(false);
                setActiveCombatNoteId(null);
              }}
            />
          ) : (
            <div className="mt-3">
              {activeCombatNoteId ? (
                <button onClick={() => setShowCombatView(true)} className={actionBtnClass}>
                  Resume Combat
                </button>
              ) : (
                <button onClick={handleStartCombat} className={actionBtnClass}>
                  Start Combat
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
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
          <button onClick={handleStartSession} className={primaryBtnClass}>
            Start Session
          </button>
        </div>
      )}

      {/* Export all notes */}
      <button
        onClick={() => exportAllNotes()}
        className="min-h-11 min-w-11 w-full px-4 py-2 mb-4 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm font-semibold"
      >
        Export All Notes (.zip)
      </button>

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
                  {!activeSession && (
                    <button
                      onClick={() => resumeSession(session.id)}
                      className="min-h-11 px-3 py-1.5 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-md cursor-pointer text-xs font-semibold"
                    >
                      Resume
                    </button>
                  )}
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

      {/* Notes Grid */}
      <NotesGrid
        campaignId={activeCampaign.id}
        activeSessionId={activeSession?.id ?? null}
      />

      {showEndConfirm && activeSession && (
        <EndSessionModal
          sessionTitle={activeSession.title}
          onConfirm={confirmEndSession}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}
    </div>
  );
}
