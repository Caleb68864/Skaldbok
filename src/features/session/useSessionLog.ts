import { useCallback, useRef, useEffect } from 'react';
import { useCampaignContext } from '../campaign/CampaignContext';
import { db } from '../../storage/db/client';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { generateSoftDeleteTxId } from '../../utils/softDelete';

/**
 * Options accepted by {@link useSessionLog.logToSession} and the typed log
 * helpers that forward through it.
 *
 * @remarks
 * - `undefined` — auto-attach to the currently-active encounter (default).
 * - `null`      — do NOT attach to any encounter (session-level log).
 * - string id   — attach to the specified encounter.
 */
export interface LogToSessionOptions {
  /** Explicit encounter target for the `contains` edge. */
  targetEncounterId?: string | null;
}

/**
 * Input shape for {@link useSessionLog.logNpcCapture}.
 *
 * @remarks
 * Captures the minimal fields needed to stand up a new `CreatureTemplate`
 * bestiary row + a note that references it. Description is stored both on
 * the template and the note's `typeData` for later editing convenience.
 */
export interface LogNpcCaptureInput {
  /** Display name for the NPC / creature. */
  name: string;
  /** Bestiary category discriminator. */
  category: 'monster' | 'npc' | 'animal';
  /** Optional HP; defaults to 0 when omitted. */
  hp?: number;
  /** Optional description (plain string stored on the template + note). */
  description?: string;
  /** Optional tag strings applied to the creature template. */
  tags?: string[];
}

/**
 * Internal debounce buffer for batching coin change events into a single log entry.
 * Accumulates per-denomination deltas and flushes after a short idle period.
 */
interface CoinBuffer {
  /** Name of the character whose coins are being tracked in this buffer. */
  character: string;
  /** Accumulated delta values keyed by coin denomination (gold, silver, copper). */
  changes: Record<string, number>;
  /** Handle for the active debounce timer, or null when idle. */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Internal debounce buffer for batching HP/resource change events into a single log entry.
 * Tracks the starting value so the net change can be expressed as damage or healing.
 */
interface ResourceBuffer {
  /** Name of the character whose resource is being tracked. */
  character: string;
  /** Identifier of the resource being tracked (e.g. `"hp"`). */
  resource: string;
  /** Resource value at the start of the current batch. */
  startValue: number;
  /** Most recently observed resource value. */
  currentValue: number;
  /** Maximum capacity of the resource (used in log label). */
  maxValue: number;
  /** Handle for the active debounce timer, or null when idle. */
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * Hook for logging events to the active session from anywhere in the app.
 *
 * @remarks
 * All returned functions are null-safe — calling them when no session is active
 * is a no-op and will not throw. Coin and HP/resource changes are debounced
 * (3-second idle window) so rapid sequential updates produce a single log entry
 * rather than one entry per tick. Accumulated buffers are flushed automatically
 * when the active session ends or when the consuming component unmounts.
 *
 * Notes created via these helpers auto-attach to the currently-active encounter
 * via a `contains` entity-link edge (encounter → note). Callers can override
 * that behavior by passing `{ targetEncounterId }` in the options object: `null`
 * keeps the note session-level, a string id attaches to that specific encounter.
 *
 * @returns An object containing a `hasActiveSession` flag and a collection of
 * logging helpers scoped to the current session.
 *
 * @example
 * ```tsx
 * const { logSkillCheck, hasActiveSession } = useSessionLog();
 *
 * // Log a successful Sneaking roll with a Boon modifier
 * await logSkillCheck('Eira', 'SNEAKING', 'success', { boon: true });
 * ```
 */
export function useSessionLog() {
  const { activeSession } = useCampaignContext();
  const coinBuffer = useRef<CoinBuffer>({ character: '', changes: {}, timer: null });
  const resourceBuffer = useRef<ResourceBuffer>({ character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null });

  /**
   * Core primitive — creates a note attached to the active session.
   *
   * @remarks
   * Re-queries the active encounter at write time inside the same Dexie
   * transaction that writes the note, so cross-tab changes to the active
   * encounter are observed correctly. When an encounter target resolves,
   * an `encounter → note` edge of type `contains` is created in the same
   * transaction.
   *
   * @param title - Human-readable title for the log entry.
   * @param type - Note type tag; defaults to `'generic'`.
   * @param typeData - Arbitrary structured data stored on the note's `typeData` field.
   * @param options - Optional override for encounter auto-attach behavior.
   * @returns A promise that resolves with the new note's id, or `undefined` if
   * no session is active.
   */
  const logToSession = useCallback(async (
    title: string,
    type: string = 'generic',
    typeData: unknown = {},
    options?: LogToSessionOptions,
  ): Promise<string | undefined> => {
    if (!activeSession) {
      console.warn('useSessionLog.logToSession: no active session');
      return undefined;
    }

    const now = nowISO();
    const noteId = generateId();

    await db.transaction('rw', [db.notes, db.entityLinks], async () => {
      // Resolve the encounter target inside the transaction.
      let attachTo: string | null;
      if (options && options.targetEncounterId === null) {
        attachTo = null;
      } else if (options && typeof options.targetEncounterId === 'string') {
        attachTo = options.targetEncounterId;
      } else {
        const active = await encounterRepository.getActiveEncounterForSession(activeSession.id);
        attachTo = active ? active.id : null;
      }

      // Pull the body out of typeData so generic notes can carry a
      // ProseMirror body without changing the signature for every caller.
      let body: unknown = null;
      let storedTypeData: unknown = typeData;
      if (typeData && typeof typeData === 'object' && 'body' in (typeData as Record<string, unknown>)) {
        const td = typeData as Record<string, unknown>;
        body = td.body ?? null;
        const { body: _omit, ...rest } = td;
        void _omit;
        storedTypeData = rest;
      }

      const note: Note = {
        id: noteId,
        campaignId: activeSession.campaignId,
        sessionId: activeSession.id,
        title,
        body,
        type,
        typeData: storedTypeData,
        status: 'active',
        pinned: false,
        visibility: 'public',
        scope: 'campaign',
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.notes.add(note);

      // Always link the note to the session itself so session exports still
      // see it (parity with useNoteActions.createNote).
      await entityLinkRepository.createLink({
        fromEntityId: activeSession.id,
        fromEntityType: 'session',
        toEntityId: noteId,
        toEntityType: 'note',
        relationshipType: 'contains',
      });

      if (attachTo) {
        await entityLinkRepository.createLink({
          fromEntityId: attachTo,
          fromEntityType: 'encounter',
          toEntityId: noteId,
          toEntityType: 'note',
          relationshipType: 'contains',
        });
      }
    });

    return noteId;
  }, [activeSession]);

  /**
   * Logs a Dragonbane skill-check result for a character.
   *
   * @param characterName - Display name of the character who made the roll.
   * @param skillName - Name of the skill that was checked.
   * @param result - Outcome of the roll: `'success'`, `'failure'`, `'dragon'` (critical success), or `'demon'` (critical failure).
   * @param modifiers - Optional roll modifiers applied to the check.
   * @param modifiers.boon - Whether a Boon (advantage) was in effect.
   * @param modifiers.bane - Whether a Bane (disadvantage) was in effect.
   * @param modifiers.pushed - Whether the roll was a pushed re-roll.
   * @param options - Optional encounter-attach override.
   *
   * @example
   * ```ts
   * await logSkillCheck('Aldric', 'Axes', 'dragon');
   * await logSkillCheck('Siv', 'SNEAKING', 'failure', { bane: true });
   * ```
   */
  const logSkillCheck = useCallback(async (
    characterName: string,
    skillName: string,
    result: 'success' | 'failure' | 'dragon' | 'demon',
    modifiers?: { boon?: boolean; bane?: boolean; pushed?: boolean },
    options?: LogToSessionOptions,
  ) => {
    const tags: string[] = [];
    if (modifiers?.boon) tags.push('Boon');
    if (modifiers?.bane) tags.push('Bane');
    if (modifiers?.pushed) tags.push('Pushed');
    const modStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';
    await logToSession(
      `${characterName}: ${skillName}${modStr} — ${result}`,
      'skill-check',
      { skill: skillName, result, character: characterName },
      options,
    );
  }, [logToSession]);

  /**
   * Logs a spell cast and its result.
   *
   * @param characterName - Display name of the character who cast the spell.
   * @param spellName - Name of the spell that was cast.
   * @param result - Outcome of the casting roll.
   * @param options - Optional encounter-attach override.
   */
  const logSpellCast = useCallback(async (
    characterName: string,
    spellName: string,
    result: 'success' | 'failure' | 'dragon' | 'demon',
    options?: LogToSessionOptions,
  ) => {
    await logToSession(
      `${characterName}: Cast ${spellName} — ${result}`,
      'generic',
      {},
      options,
    );
  }, [logToSession]);

  /**
   * Logs the use of a character ability or special talent.
   *
   * @param characterName - Display name of the character who used the ability.
   * @param abilityName - Name of the ability or talent that was used.
   * @param options - Optional encounter-attach override.
   */
  const logAbilityUse = useCallback(async (
    characterName: string,
    abilityName: string,
    options?: LogToSessionOptions,
  ) => {
    await logToSession(
      `${characterName}: Used ${abilityName}`,
      'generic',
      {},
      options,
    );
  }, [logToSession]);

  /**
   * Flushes the accumulated resource buffer to a single log entry and resets it.
   *
   * @remarks
   * Called automatically by the debounce timer and on session end / unmount.
   * A no-op when the buffer is empty or the current value equals the start value.
   */
  const flushResourceBuffer = useCallback(async () => {
    const buf = resourceBuffer.current;
    if (!buf.character || buf.startValue === buf.currentValue) {
      resourceBuffer.current = { character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null };
      return;
    }
    const diff = buf.currentValue - buf.startValue;
    const resLabel = buf.resource.toUpperCase();
    const label = diff > 0
      ? `${buf.character}: Healed ${diff} ${resLabel} (${buf.currentValue}/${buf.maxValue})`
      : `${buf.character}: Took ${Math.abs(diff)} damage (${buf.currentValue}/${buf.maxValue})`;
    await logToSession(label);
    resourceBuffer.current = { character: '', resource: '', startValue: 0, currentValue: 0, maxValue: 0, timer: null };
  }, [logToSession]);

  /**
   * Records a change to a character's HP (or any named resource), debouncing
   * rapid successive changes into one log entry.
   *
   * @remarks
   * Multiple calls within a 3-second window for the same character and resource
   * are coalesced into a single entry that reflects the total delta. Switching
   * to a different character or resource flushes the previous buffer first.
   *
   * @param characterName - Display name of the character whose HP changed.
   * @param oldHP - Value before the change.
   * @param newHP - Value after the change.
   * @param maxHP - Maximum capacity of the resource (used in the log label).
   * @param resourceId - Identifier for the resource being tracked; defaults to `'hp'`.
   */
  const logHPChange = useCallback(async (
    characterName: string,
    oldHP: number,
    newHP: number,
    maxHP: number,
    resourceId: string = 'hp',
  ) => {
    if (!activeSession) return;
    const diff = newHP - oldHP;
    if (diff === 0) return;
    const buf = resourceBuffer.current;
    // If switching character or resource, flush previous
    if ((buf.character && buf.character !== characterName) || (buf.resource && buf.resource !== resourceId)) {
      await flushResourceBuffer();
    }
    // Initialize start value on first change in this batch
    if (!buf.character || buf.character !== characterName || buf.resource !== resourceId) {
      resourceBuffer.current = { character: characterName, resource: resourceId, startValue: oldHP, currentValue: newHP, maxValue: maxHP, timer: null };
    } else {
      resourceBuffer.current.currentValue = newHP;
      resourceBuffer.current.maxValue = maxHP;
    }
    // Reset debounce timer (3 seconds)
    if (resourceBuffer.current.timer !== null) clearTimeout(resourceBuffer.current.timer);
    resourceBuffer.current.timer = setTimeout(() => {
      flushResourceBuffer();
    }, 3000);
  }, [activeSession, flushResourceBuffer]);

  /**
   * Logs a Dragonbane death roll attempt and its outcome.
   *
   * @param characterName - Display name of the character making the death roll.
   * @param rollNumber - Sequential number of this death roll (1–3).
   * @param survived - `true` if the character survived this roll, `false` if they failed.
   * @param options - Optional encounter-attach override.
   */
  const logDeathRoll = useCallback(async (
    characterName: string,
    rollNumber: number,
    survived: boolean,
    options?: LogToSessionOptions,
  ) => {
    const result = survived ? 'Survived' : 'Failed';
    await logToSession(
      `${characterName}: Death Roll #${rollNumber} — ${result}`,
      'generic',
      {},
      options,
    );
  }, [logToSession]);

  /**
   * Logs the outcome of a rest activity (e.g. a stretch break or night's sleep).
   *
   * @param characterName - Display name of the character who rested.
   * @param restType - Label describing the type of rest (e.g. `"Stretch Break"`, `"Night's Rest"`).
   * @param outcome - Description of what was gained or recovered.
   * @param options - Optional encounter-attach override.
   */
  const logRest = useCallback(async (
    characterName: string,
    restType: string,
    outcome: string,
    options?: LogToSessionOptions,
  ) => {
    await logToSession(
      `${characterName}: ${restType} — ${outcome}`,
      'generic',
      {},
      options,
    );
  }, [logToSession]);

  /**
   * Flushes the accumulated coin-change buffer to a single log entry and resets it.
   *
   * @remarks
   * Called automatically by the debounce timer and on session end / unmount.
   * A no-op when the buffer is empty.
   */
  const flushCoinBuffer = useCallback(async () => {
    const buf = coinBuffer.current;
    if (!buf.character || Object.keys(buf.changes).length === 0) return;
    const parts: string[] = [];
    if (buf.changes.gold) parts.push(`${buf.changes.gold > 0 ? '+' : ''}${buf.changes.gold}g`);
    if (buf.changes.silver) parts.push(`${buf.changes.silver > 0 ? '+' : ''}${buf.changes.silver}s`);
    if (buf.changes.copper) parts.push(`${buf.changes.copper > 0 ? '+' : ''}${buf.changes.copper}c`);
    if (parts.length > 0) {
      await logToSession(`${buf.character}: Coins ${parts.join(' ')}`);
    }
    coinBuffer.current = { character: '', changes: {}, timer: null };
  }, [logToSession]);

  /**
   * Records a coin gain or loss for a character, debouncing rapid changes into
   * a single log entry per denomination.
   *
   * @remarks
   * Multiple calls within a 3-second window for the same character are coalesced
   * into one entry. Switching characters flushes the previous buffer first. This
   * function is synchronous (fire-and-forget) — the actual write happens on flush.
   *
   * @param characterName - Display name of the character whose coins changed.
   * @param coinType - Denomination that changed: `'gold'`, `'silver'`, or `'copper'`.
   * @param delta - Signed amount: positive for gains, negative for losses.
   *
   * @example
   * ```ts
   * logCoinChange('Eira', 'gold', -5);   // spent 5 gold
   * logCoinChange('Eira', 'silver', 20); // gained 20 silver
   * ```
   */
  const logCoinChange = useCallback((characterName: string, coinType: 'gold' | 'silver' | 'copper', delta: number) => {
    const buf = coinBuffer.current;
    // If the character changes, flush previous buffer first
    if (buf.character && buf.character !== characterName) {
      flushCoinBuffer();
    }
    // Accumulate
    buf.character = characterName;
    buf.changes[coinType] = (buf.changes[coinType] ?? 0) + delta;
    // Reset debounce timer (3 seconds)
    if (buf.timer !== null) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => {
      flushCoinBuffer();
    }, 3000);
  }, [flushCoinBuffer]);

  /**
   * Creates a free-form generic note attached to the active session and
   * (optionally) the active encounter.
   *
   * @param title - Display title for the note.
   * @param body - ProseMirror / Tiptap JSON body (or any serializable doc).
   * @param options - Optional encounter-attach override.
   * @returns The new note's id, or `undefined` if no session is active.
   */
  const logGenericNote = useCallback(async (
    title: string,
    body: unknown,
    options?: LogToSessionOptions,
  ): Promise<string | undefined> => {
    return await logToSession(title, 'generic', { body }, options);
  }, [logToSession]);

  /**
   * Captures an NPC encountered mid-session as a bestiary creature template
   * + a note referencing it, wired up with the standard session / encounter
   * entity links.
   *
   * @remarks
   * Runs in a single Dexie transaction across `creatureTemplates`, `notes`,
   * and `entityLinks`. Creates four rows (template + note + introduced_in
   * edge + optional contains edge) or aborts cleanly on any failure.
   *
   * @param input - The NPC's name, category, and optional stats/description.
   * @param options - Optional encounter-attach override.
   * @returns The new note and creature-template ids.
   */
  const logNpcCapture = useCallback(async (
    input: LogNpcCaptureInput,
    options?: LogToSessionOptions,
  ): Promise<{ noteId: string; creatureId: string }> => {
    if (!activeSession) {
      throw new Error('useSessionLog.logNpcCapture: no active session');
    }

    const now = nowISO();
    const creatureId = generateId();
    const noteId = generateId();

    await db.transaction(
      'rw',
      [db.creatureTemplates, db.notes, db.entityLinks],
      async () => {
        // 1. Create the bestiary entry
        await db.creatureTemplates.add({
          id: creatureId,
          campaignId: activeSession.campaignId,
          name: input.name,
          description: input.description ?? '',
          category: input.category,
          stats: {
            hp: input.hp ?? 0,
            armor: 0,
            movement: 0,
          },
          attacks: [],
          abilities: [],
          skills: [],
          tags: input.tags ?? [],
          status: 'active',
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        });

        // 2. Create the note
        const npcNote: Note = {
          id: noteId,
          campaignId: activeSession.campaignId,
          sessionId: activeSession.id,
          title: input.name,
          body: null,
          type: 'npc',
          typeData: { creatureTemplateId: creatureId, description: input.description },
          status: 'active',
          pinned: false,
          visibility: 'public',
          scope: 'campaign',
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.notes.add(npcNote);

        // 3. session → note ("contains") for baseline session export parity
        await entityLinkRepository.createLink({
          fromEntityId: activeSession.id,
          fromEntityType: 'session',
          toEntityId: noteId,
          toEntityType: 'note',
          relationshipType: 'contains',
        });

        // 4. note → session ("introduced_in")
        await entityLinkRepository.createLink({
          fromEntityId: noteId,
          fromEntityType: 'note',
          toEntityId: activeSession.id,
          toEntityType: 'session',
          relationshipType: 'introduced_in',
        });

        // 5. contains edge to active encounter if applicable
        let attachTo: string | null;
        if (options && options.targetEncounterId === null) {
          attachTo = null;
        } else if (options && typeof options.targetEncounterId === 'string') {
          attachTo = options.targetEncounterId;
        } else {
          const active = await encounterRepository.getActiveEncounterForSession(activeSession.id);
          attachTo = active ? active.id : null;
        }
        if (attachTo) {
          await entityLinkRepository.createLink({
            fromEntityId: attachTo,
            fromEntityType: 'encounter',
            toEntityId: noteId,
            toEntityType: 'note',
            relationshipType: 'contains',
          });
        }
      },
    );

    return { noteId, creatureId };
  }, [activeSession]);

  /**
   * Reassigns an existing note to a different encounter (or detaches it from
   * any encounter).
   *
   * @remarks
   * Soft-deletes every existing `encounter → note` `contains` edge pointing
   * at this note, then creates a fresh edge to the new target if one is
   * supplied. All edges are marked with a shared `softDeletedBy` UUID so the
   * cascade can be restored atomically. Same-session invariant is enforced:
   * a note cannot be reassigned to an encounter in a different session.
   *
   * @param noteId - ID of the note to move.
   * @param newEncounterId - Target encounter id, or `null` to detach.
   */
  const reassignNote = useCallback(async (
    noteId: string,
    newEncounterId: string | null,
  ): Promise<void> => {
    if (!activeSession) {
      throw new Error('useSessionLog.reassignNote: no active session');
    }

    const note = await db.notes.get(noteId);
    if (!note) {
      throw new Error(`useSessionLog.reassignNote: note ${noteId} not found`);
    }

    if (newEncounterId) {
      const target = await db.encounters.get(newEncounterId);
      if (!target) {
        throw new Error(`useSessionLog.reassignNote: encounter ${newEncounterId} not found`);
      }
      if (target.sessionId !== note.sessionId) {
        throw new Error(
          `useSessionLog.reassignNote: session mismatch (note.sessionId=${note.sessionId}, encounter.sessionId=${target.sessionId})`,
        );
      }
    }

    await db.transaction('rw', [db.entityLinks], async () => {
      // Find existing encounter→note contains edges
      const existing = await entityLinkRepository.getLinksTo(noteId, 'contains');
      const encounterEdges = existing.filter((l) => l.fromEntityType === 'encounter');

      // Silent no-op if already pointing at the requested target
      if (
        newEncounterId &&
        encounterEdges.length === 1 &&
        encounterEdges[0].fromEntityId === newEncounterId
      ) {
        return;
      }

      // Soft-delete existing edges under a shared cascade id
      const txId = generateSoftDeleteTxId();
      const now = nowISO();
      for (const edge of encounterEdges) {
        await db.entityLinks.update(edge.id, {
          deletedAt: now,
          softDeletedBy: txId,
          updatedAt: now,
        });
      }

      // Create new edge if target is non-null
      if (newEncounterId) {
        await entityLinkRepository.createLink({
          fromEntityId: newEncounterId,
          fromEntityType: 'encounter',
          toEntityId: noteId,
          toEntityType: 'note',
          relationshipType: 'contains',
        });
      }
    });
  }, [activeSession]);

  // Flush buffers when session ends
  useEffect(() => {
    if (!activeSession) {
      flushCoinBuffer();
      flushResourceBuffer();
    }
  }, [activeSession, flushCoinBuffer, flushResourceBuffer]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      const coinBuf = coinBuffer.current;
      if (coinBuf.timer !== null) clearTimeout(coinBuf.timer);
      flushCoinBuffer();
      const resBuf = resourceBuffer.current;
      if (resBuf.timer !== null) clearTimeout(resBuf.timer);
      flushResourceBuffer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    /** Whether a session is currently active. When `false`, all log functions are no-ops. */
    hasActiveSession: !!activeSession,
    logToSession,
    logSkillCheck,
    logSpellCast,
    logAbilityUse,
    logHPChange,
    logDeathRoll,
    logRest,
    logCoinChange,
    logGenericNote,
    logNpcCapture,
    reassignNote,
  };
}
