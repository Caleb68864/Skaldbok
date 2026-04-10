import { useEffect, useState } from 'react';
import { useSessionEncounterContextSafe } from '../SessionEncounterContext';
import { useCampaignContext } from '../../campaign/CampaignContext';
import * as encounterRepository from '../../../storage/repositories/encounterRepository';
import type { Encounter } from '../../../types/encounter';

/**
 * Sentinel value meaning "resolve target at submit time to whatever encounter
 * is currently active for the session (or session-only if none is active)."
 */
export type AttachToValue = string | null | 'auto';

export interface AttachToControlProps {
  /** Current value: `'auto'`, `null` (session only), or an encounter id. */
  value: AttachToValue;
  /** Called when the user changes the selection. */
  onChange: (value: AttachToValue) => void;
}

/**
 * Resolves an {@link AttachToValue} into the shape expected by `useSessionLog`
 * helpers' `options.targetEncounterId`:
 * - `'auto'` → `undefined` (let the log helper auto-attach to the active encounter)
 * - `null`   → `null` (explicit "no encounter")
 * - `string` → the encounter id
 */
export function resolveAttach(value: AttachToValue): string | null | undefined {
  if (value === 'auto') return undefined;
  return value;
}

/**
 * Per-entry "Attach to:" select control for Quick Log forms.
 *
 * @remarks
 * On every mount the control forces its value back to `'auto'`, so the default
 * resets to the active encounter on every form open (non-sticky). This matches
 * the Sub-Spec 8 "per-entry reset" requirement.
 *
 * The control prefers the session-encounter context supplied by
 * {@link SessionEncounterProvider}; when mounted outside the provider (e.g. in
 * shell-level drawers) it falls back to `useCampaignContext().activeSession`
 * and reads the active encounter directly from the repository.
 */
export function AttachToControl({ value, onChange }: AttachToControlProps) {
  const sessionEncounterCtx = useSessionEncounterContextSafe();
  const { activeSession } = useCampaignContext();
  const [fallbackActive, setFallbackActive] = useState<Encounter | null>(null);
  const [allEncounters, setAllEncounters] = useState<Encounter[]>([]);

  const activeEncounter = sessionEncounterCtx?.activeEncounter ?? fallbackActive;
  const sessionId = activeSession?.id ?? null;

  // Per-entry reset: force default back to 'auto' whenever this control mounts.
  useEffect(() => {
    onChange('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the fallback active encounter when the context is not available.
  useEffect(() => {
    if (sessionEncounterCtx || !sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const active = await encounterRepository.getActiveEncounterForSession(sessionId);
        if (!cancelled) setFallbackActive(active);
      } catch {
        if (!cancelled) setFallbackActive(null);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionEncounterCtx, sessionId]);

  // Load all non-deleted encounters in this session for the dropdown options.
  useEffect(() => {
    if (!sessionId) {
      setAllEncounters([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await encounterRepository.listBySession(sessionId);
        if (!cancelled) setAllEncounters(rows);
      } catch {
        if (!cancelled) setAllEncounters([]);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const selectValue =
    value === 'auto' ? 'auto' : value === null ? 'none' : value;

  const handleChange = (next: string) => {
    if (next === 'auto') onChange('auto');
    else if (next === 'none') onChange(null);
    else onChange(next);
  };

  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)] mb-2">
      Attach to
      <select
        value={selectValue}
        onChange={(e) => handleChange(e.target.value)}
        className="px-2 py-1 border border-[var(--color-border)] rounded text-sm text-[var(--color-text)] bg-[var(--color-surface-raised)]"
      >
        <option value="auto">
          {activeEncounter
            ? `Active: ${activeEncounter.title}`
            : 'Session only (no encounter)'}
        </option>
        {allEncounters
          .filter((e) => e.id !== activeEncounter?.id)
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} ({e.status})
            </option>
          ))}
        <option value="none">Session only (no encounter)</option>
      </select>
    </label>
  );
}
