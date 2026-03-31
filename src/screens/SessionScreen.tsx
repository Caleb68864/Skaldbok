import { useState, useEffect, useCallback } from 'react';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { EndSessionModal } from '../features/campaign/EndSessionModal';
import { useExportActions } from '../features/export/useExportActions';
import { CombatTimeline } from '../features/combat/CombatTimeline';
import { useNoteActions } from '../features/notes/useNoteActions';
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

export function SessionScreen() {
  const { activeCampaign, activeSession, startSession, endSession } = useCampaignContext();
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
    }, 10000); // update every 10s
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
      // Get note count for last ended session (for recap card)
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

  // Check for active combat note when session changes
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
    <div style={{ padding: '16px' }}>
      <h2 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>{activeCampaign.name}</h2>

      {activeSession ? (
        <div
          style={{
            background: 'var(--color-surface-raised)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
            <h3 style={{ color: 'var(--color-text)', margin: 0 }}>{activeSession.title}</h3>
            {elapsed && (
              <span style={{ color: 'var(--color-accent)', fontSize: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {elapsed}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '12px', fontSize: '14px' }}>
            Started: {formatDateTime(activeSession.startedAt)}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleEndSession}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 20px',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent, #fff)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              End Session
            </button>
            <button
              onClick={() => exportSessionMarkdown(activeSession.id)}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 12px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Export Session
            </button>
            <button
              onClick={() => exportSessionBundle(activeSession.id)}
              style={{
                minHeight: '44px',
                minWidth: '44px',
                padding: '0 12px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Export + Notes (ZIP)
            </button>
          </div>

          {/* Quick session actions — hidden during combat to prevent overlay */}
          {!showCombatView && (
            <div style={{ marginTop: '16px' }}>
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
            <div style={{ marginTop: '12px' }}>
              {activeCombatNoteId ? (
                <button
                  onClick={() => setShowCombatView(true)}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Resume Combat
                </button>
              ) : (
                <button
                  onClick={handleStartCombat}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 16px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Start Combat
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: '16px' }}>
          {pastSessions.length > 0 ? (
            <div
              style={{
                background: 'var(--color-surface-raised)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '12px',
              }}
            >
              <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Last Session
              </p>
              <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '2px' }}>
                {pastSessions[0].title}
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                {formatDate(pastSessions[0].date)}
                {lastSessionNoteCount > 0 && ` · ${lastSessionNoteCount} note${lastSessionNoteCount !== 1 ? 's' : ''}`}
              </p>
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '12px', fontSize: '14px' }}>
              No sessions yet.
            </p>
          )}
          <button
            onClick={handleStartSession}
            style={{
              minHeight: '44px',
              minWidth: '44px',
              padding: '0 20px',
              background: 'var(--color-accent)',
              color: 'var(--color-on-accent, #fff)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start Session
          </button>
        </div>
      )}

      {/* Export all notes */}
      <button
        onClick={() => exportAllNotes()}
        style={{
          minHeight: '44px',
          minWidth: '44px',
          width: '100%',
          padding: '0 16px',
          marginBottom: '16px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Export All Notes (.zip)
      </button>

      {/* Past sessions list */}
      {!loadingPast && pastSessions.length > 0 && (
        <div>
          <h3 style={{ color: 'var(--color-text)', marginBottom: '8px' }}>Past Sessions</h3>
          {pastSessions.map(session => (
            <div
              key={session.id}
              style={{
                background: 'var(--color-surface-raised)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '2px' }}>
                    {session.title}
                  </p>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                    {formatDate(session.date)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => exportSessionMarkdown(session.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0 8px',
                      background: 'none',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    .md
                  </button>
                  <button
                    onClick={() => exportSessionBundle(session.id)}
                    style={{
                      minHeight: '44px',
                      padding: '0 8px',
                      background: 'none',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    .zip
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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
