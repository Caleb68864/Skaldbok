import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Shared refresh signal for session-scoped UI that needs to re-query after a
 * quick-log action fires from anywhere in the shell.
 *
 * @remarks
 * Prior to this context, quick-log callbacks (Quick Note, NPC, encounter
 * logger, etc.) bumped local-state refresh tokens on {@link SessionScreen}.
 * That worked when the quick-log panel lived on the session screen, but broke
 * the moment the same actions were triggered from {@link GlobalFAB} — the FAB
 * lives in {@link ShellLayout} and has no way to poke SessionScreen's local
 * state. Session notes and the timeline appeared stale until a manual reload.
 *
 * This context sits between the FAB (publisher) and session-scoped views
 * (subscribers). Any component that mutates session notes/encounters calls
 * {@link SessionRefreshContextValue.bumpSessionNotes} and/or
 * {@link SessionRefreshContextValue.bumpTimeline}; consumers watch the
 * matching numeric token and re-query when it changes.
 */
interface SessionRefreshContextValue {
  timelineRefreshToken: number;
  sessionNotesRefreshToken: number;
  bumpTimeline: () => void;
  bumpSessionNotes: () => void;
  /** Bump both tokens — the common case after a quick-log action. */
  bumpAll: () => void;

  /**
   * Signals that the FAB should open its quick-log drawer. Optional `actionId`
   * pre-selects a specific quick-log action (e.g. `'note'`). The nonce increments
   * on every call so the FAB's useEffect fires even if the same action is requested
   * twice in a row.
   */
  openQuickLog: (actionId?: string | null) => void;
  /**
   * Clears the last requested quick-log action so a later remount of the
   * quick-log surface does not re-open a stale sub-drawer. Call from whoever
   * closes the drawer.
   */
  clearQuickLogRequest: () => void;
  requestedQuickLogAction: string | null;
  requestedQuickLogNonce: number;
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
  const [requestedQuickLogAction, setRequestedQuickLogAction] = useState<string | null>(null);
  const [requestedQuickLogNonce, setRequestedQuickLogNonce] = useState(0);

  const bumpTimeline = useCallback(() => setTimelineToken((t) => t + 1), []);
  const bumpSessionNotes = useCallback(() => setSessionNotesToken((t) => t + 1), []);
  const bumpAll = useCallback(() => {
    setTimelineToken((t) => t + 1);
    setSessionNotesToken((t) => t + 1);
  }, []);
  const openQuickLog = useCallback((actionId: string | null = null) => {
    setRequestedQuickLogAction(actionId);
    setRequestedQuickLogNonce((n) => n + 1);
  }, []);
  const clearQuickLogRequest = useCallback(() => {
    setRequestedQuickLogAction(null);
  }, []);

  const value = useMemo<SessionRefreshContextValue>(
    () => ({
      timelineRefreshToken,
      sessionNotesRefreshToken,
      bumpTimeline,
      bumpSessionNotes,
      bumpAll,
      openQuickLog,
      clearQuickLogRequest,
      requestedQuickLogAction,
      requestedQuickLogNonce,
    }),
    [
      timelineRefreshToken,
      sessionNotesRefreshToken,
      bumpTimeline,
      bumpSessionNotes,
      bumpAll,
      openQuickLog,
      clearQuickLogRequest,
      requestedQuickLogAction,
      requestedQuickLogNonce,
    ],
  );

  return (
    <SessionRefreshContext.Provider value={value}>{children}</SessionRefreshContext.Provider>
  );
}
