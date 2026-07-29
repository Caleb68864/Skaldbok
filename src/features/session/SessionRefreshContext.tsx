import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Shared refresh signal for session-scoped UI that needs to re-query after
 * something elsewhere in the shell mutates a session's notes or encounters.
 *
 * @remarks
 * The problem this solves is that the writer and the reader often sit in
 * different subtrees. Promoting log entries happens on `/session/log`, and
 * combat writes happen inside an encounter view, but the surfaces that must
 * react — the session timeline and the Session Notes panel — live on
 * {@link screens/SessionScreen!SessionScreen | SessionScreen} and cannot see
 * either one's local state. Before this context they stayed stale until a
 * manual reload.
 *
 * A component that mutates session notes calls
 * {@link SessionRefreshContextValue.bumpAll} — promotion, combat writes, and
 * note edits, since a note's title shows in both surfaces.
 * {@link SessionRefreshContextValue.bumpTimeline} is for encounter-lifecycle
 * changes, which move the timeline without touching a note. Consumers watch
 * the matching numeric token and re-query when it changes.
 */
export interface SessionRefreshContextValue {
  timelineRefreshToken: number;
  sessionNotesRefreshToken: number;
  bumpTimeline: () => void;
  /** Bump both tokens — the common case after promoting or logging. */
  bumpAll: () => void;
}

const SessionRefreshContext = createContext<SessionRefreshContextValue | null>(null);

export function useSessionRefresh(): SessionRefreshContextValue {
  const ctx = useContext(SessionRefreshContext);
  if (!ctx) {
    throw new Error('useSessionRefresh must be used within SessionRefreshProvider');
  }
  return ctx;
}

/**
 * Optional variant — returns `null` when no provider is mounted. Useful for
 * components that can render both inside and outside the session-scoped tree.
 */
export function useSessionRefreshSafe(): SessionRefreshContextValue | null {
  return useContext(SessionRefreshContext);
}

export function SessionRefreshProvider({ children }: { children: ReactNode }) {
  const [timelineRefreshToken, setTimelineToken] = useState(0);
  const [sessionNotesRefreshToken, setSessionNotesToken] = useState(0);

  const bumpTimeline = useCallback(() => setTimelineToken((t) => t + 1), []);
  const bumpAll = useCallback(() => {
    setTimelineToken((t) => t + 1);
    setSessionNotesToken((t) => t + 1);
  }, []);

  const value = useMemo<SessionRefreshContextValue>(
    () => ({
      timelineRefreshToken,
      sessionNotesRefreshToken,
      bumpTimeline,
      bumpAll,
    }),
    [timelineRefreshToken, sessionNotesRefreshToken, bumpTimeline, bumpAll],
  );

  return (
    <SessionRefreshContext.Provider value={value}>{children}</SessionRefreshContext.Provider>
  );
}
