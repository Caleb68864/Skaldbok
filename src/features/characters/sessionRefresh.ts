import type { CharacterRecord } from '../../types/character';
import type { SystemDefinition } from '../../types/system';

/**
 * The resource patch a character needs when a new session starts.
 *
 * @remarks
 * `ResourceDefinition.refresh: 'session'` means "back to full at the start of
 * each session" — Savage Worlds Bennies are the reason the field exists. It was
 * declared on the resource, documented on the type, validated by the schema, and
 * **read by nothing**, so Bennies never refreshed and a SWADE table had to
 * remember to reset three counters by hand every week.
 *
 * Returns `null` when nothing needs changing, so a caller can skip the write
 * entirely rather than bumping `updatedAt` on every character at every session
 * start.
 *
 * Only touches resources the character already has: a definition naming a
 * resource the record lacks is older or imported data, and fabricating a
 * maxless resource here would put a broken entry on the sheet.
 *
 * A `'rest'` refresh is deliberately **not** handled — that fires on a rest
 * action, which is the rest model's business, not a session boundary's.
 */
export function sessionRefreshPatch(
  system: SystemDefinition | null | undefined,
  character: Pick<CharacterRecord, 'resources'>,
): Pick<CharacterRecord, 'resources'> | null {
  const refreshing = (system?.resources ?? []).filter(r => r.refresh === 'session');
  if (refreshing.length === 0) return null;

  const resources = { ...(character.resources ?? {}) };
  let changed = false;

  for (const definition of refreshing) {
    const existing = resources[definition.id];
    if (!existing) continue;
    // A depleting pool refills to its max; an accumulating one empties to its
    // min. Bennies are the former, and reading the polarity rather than
    // assuming it is what keeps this correct for a system that ever declares a
    // session-refreshing track that counts up.
    const target = definition.direction === 'accumulates'
      ? (definition.min ?? 0)
      : (existing.max ?? definition.defaultMax);
    if (existing.current === target) continue;
    resources[definition.id] = { ...existing, current: target };
    changed = true;
  }

  return changed ? { resources } : null;
}
