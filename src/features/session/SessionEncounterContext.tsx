import React, { createContext, useContext } from 'react';
import { useSessionEncounter } from './useSessionEncounter';
import type { UseSessionEncounterResult } from './useSessionEncounter';

const SessionEncounterContext = createContext<UseSessionEncounterResult | null>(null);

export function SessionEncounterProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const value = useSessionEncounter(sessionId);
  return (
    <SessionEncounterContext.Provider value={value}>
      {children}
    </SessionEncounterContext.Provider>
  );
}

/**
 * Consume the session-scoped encounter state.
 * MUST be used inside a <SessionEncounterProvider>.
 */
export function useSessionEncounterContext(): UseSessionEncounterResult {
  const ctx = useContext(SessionEncounterContext);
  if (!ctx) {
    throw new Error(
      'useSessionEncounterContext must be used inside a <SessionEncounterProvider>',
    );
  }
  return ctx;
}

/**
 * Safe variant of {@link useSessionEncounterContext} that returns `null`
 * when used outside a provider instead of throwing. Intended for components
 * that may be mounted in either the session-screen tree (wrapped in
 * `SessionEncounterProvider`) or global shell trees (not wrapped), and need
 * to gracefully degrade when the provider is absent.
 */
export function useSessionEncounterContextSafe(): UseSessionEncounterResult | null {
  return useContext(SessionEncounterContext);
}
