import { useState, useEffect, useCallback, useRef } from 'react';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import * as creatureTemplateRepository from '../../storage/repositories/creatureTemplateRepository';
import { getById as getCreatureTemplateById } from '../../storage/repositories/creatureTemplateRepository';
import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import { db } from '../../storage/db/client';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { ParticipantDrawer } from './ParticipantDrawer';
import { QuickCreateParticipantFlow } from './QuickCreateParticipantFlow';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { cn } from '../../lib/utils';
import { registerFlush } from '../persistence/autosaveFlush';
import { useSessionLog } from '../session/useSessionLog';
import { useSessionRefreshSafe } from '../session/SessionRefreshContext';
import { useCampaignContext } from '../campaign/CampaignContext';
import { getById as getCharacterById } from '../../storage/repositories/characterRepository';
import { useToast } from '../../context/ToastContext';
import type { CharacterRecord } from '../../types/character';

interface CombatEncounterViewProps {
  encounter: Encounter;
  onClose: () => void;
}

const actionBtnClass = 'min-h-11 min-w-11 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer text-sm font-medium';

/**
 * Combat encounter view that reads/writes encounter entities directly.
 *
 * @remarks
 * This is a NEW component — it does NOT wrap or modify CombatTimeline.tsx.
 * CombatTimeline remains unchanged and is used for archived combat notes.
 * This view renders participant list with HP/conditions, round counter,
 * event timeline, and stat drawer on participant tap.
 */
export function CombatEncounterView({ encounter: initialEncounter, onClose }: CombatEncounterViewProps) {
  const { activeParty } = useCampaignContext();
  const { showToast } = useToast();
  const [encounter, setEncounter] = useState<Encounter>(initialEncounter);
  const [selectedParticipant, setSelectedParticipant] = useState<EncounterParticipant | null>(null);
  const [templateCache, setTemplateCache] = useState<Record<string, CreatureTemplate>>({});
  // Map of participant.id -> creatureTemplate.id, sourced from `represents` edges.
  const [participantTemplateMap, setParticipantTemplateMap] = useState<Record<string, string>>({});
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const { logToSession } = useSessionLog();
  const sessionRefresh = useSessionRefreshSafe();

  const currentRound = encounter.combatData?.currentRound ?? 1;
  const events = encounter.combatData?.events ?? [];
  const participants = encounter.participants;
  const partyCharacterIds = (activeParty?.members ?? [])
    .map((member) => member.linkedCharacterId)
    .filter((id): id is string => Boolean(id));

  // Keep the local combat state aligned with parent-driven encounter updates,
  // such as participants added from EncounterScreen's picker.
  useEffect(() => {
    setEncounter(initialEncounter);
    setSelectedParticipant((current) => {
      if (!current) return null;
      return initialEncounter.participants.find((p) => p.id === current.id) ?? null;
    });
  }, [initialEncounter]);

  // Walk `represents` edges to map participants -> creature templates, then
  // fetch any templates we haven't loaded yet. Runs whenever the participant
  // list changes (add / remove / refresh).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        participants.map(async (p) => {
          const links = await entityLinkRepository.getLinksFrom(p.id, 'represents');
          const creatureEdge = links.find((l) => l.toEntityType === 'creature');
          return [p.id, creatureEdge?.toEntityId] as const;
        }),
      );
      if (cancelled) return;
      const nextMap: Record<string, string> = {};
      for (const [pid, tid] of entries) {
        if (tid) nextMap[pid] = tid;
      }
      setParticipantTemplateMap(nextMap);

      const needed = [...new Set(Object.values(nextMap))].filter((id) => !templateCache[id]);
      if (needed.length === 0) return;
      const templates = await Promise.all(needed.map((id) => getCreatureTemplateById(id)));
      if (cancelled) return;
      setTemplateCache((prev) => {
        const next = { ...prev };
        for (const t of templates) {
          if (t) next[t.id] = t;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [participants, templateCache]);

  const refresh = useCallback(async () => {
    const updated = await encounterRepository.getById(encounter.id);
    if (updated) setEncounter(updated);
  }, [encounter.id]);

  const handleNextRound = async () => {
    const newRound = currentRound + 1;
    await encounterRepository.update(encounter.id, {
      combatData: { ...encounter.combatData!, currentRound: newRound, events },
    });
    await refresh();
  };

  const handleAddEvent = async (eventData: { type: string; description: string }) => {
    const newEvent = {
      id: generateId(),
      round: currentRound,
      ...eventData,
      timestamp: new Date().toISOString(),
    };
    const updatedEvents = [...events, newEvent];
    await encounterRepository.update(encounter.id, {
      combatData: { currentRound, events: updatedEvents },
    });
    await refresh();
  };

  // Tracks the latest in-flight participant update so flushAll() can wait for
  // it before session-end mutations proceed. Set while the update is pending,
  // cleared on settle.
  const inFlightParticipantUpdateRef = useRef<Promise<void> | null>(null);

  const handleUpdateParticipantState = async (
    participantId: string,
    patch: Partial<EncounterParticipant['instanceState']>
  ) => {
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) return;
    const prevState = participant.instanceState;
    const updatePromise = encounterRepository.updateParticipant(encounter.id, participantId, {
      instanceState: { ...prevState, ...patch },
    });
    inFlightParticipantUpdateRef.current = updatePromise
      .catch(() => undefined)
      .then(() => {
        inFlightParticipantUpdateRef.current = null;
      });
    await updatePromise;
    await refresh();

    // Record HP / condition changes as session notes attached to this
    // encounter so they surface in the timeline and Session Notes panel. HP
    // edits through the drawer are intentional and infrequent, so we log them
    // immediately rather than running them through logHPChange's 3s debounce
    // (which is tuned for character-sheet counter spam, not combat blurs).
    const templateId = participantTemplateMap[participantId];
    const template = templateId ? templateCache[templateId] : undefined;
    const maxHp = template?.stats.hp;

    const notePromises: Promise<unknown>[] = [];

    if (
      Object.prototype.hasOwnProperty.call(patch, 'currentHp') &&
      prevState.currentHp !== patch.currentHp
    ) {
      const oldHp = prevState.currentHp;
      const newHp = patch.currentHp;
      if (typeof oldHp === 'number' && typeof newHp === 'number') {
        const diff = newHp - oldHp;
        const suffix = typeof maxHp === 'number' ? ` (${newHp}/${maxHp})` : ` (${newHp} HP)`;
        const title = diff > 0
          ? `${participant.name}: Healed ${diff} HP${suffix}`
          : `${participant.name}: Took ${Math.abs(diff)} damage${suffix}`;
        notePromises.push(
          logToSession(title, 'generic', { participant: participant.name, oldHp, newHp, maxHp }, { targetEncounterId: encounter.id }),
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'conditions')) {
      const prev = new Set(prevState.conditions ?? []);
      const next = new Set(patch.conditions ?? []);
      const added = [...next].filter((c) => !prev.has(c));
      const removed = [...prev].filter((c) => !next.has(c));
      for (const c of added) {
        notePromises.push(
          logToSession(`${participant.name}: Gained ${c}`, 'generic', { participant: participant.name, condition: c }, { targetEncounterId: encounter.id }),
        );
      }
      for (const c of removed) {
        notePromises.push(
          logToSession(`${participant.name}: Removed ${c}`, 'generic', { participant: participant.name, condition: c }, { targetEncounterId: encounter.id }),
        );
      }
    }

    if (notePromises.length > 0) {
      await Promise.allSettled(notePromises);
      sessionRefresh?.bumpAll();
    }
  };

  // Register with the flush bus so endSession (and other lifecycle operations)
  // wait for any in-flight participant update before proceeding. No-op when
  // nothing is in flight.
  useEffect(() => {
    const { unregister } = registerFlush(async () => {
      const inFlight = inFlightParticipantUpdateRef.current;
      if (inFlight) await inFlight;
    });
    return unregister;
  }, []);

  const handleQuickCreate = async (name: string, stats: { hp?: number; armor?: number; movement?: number }) => {
    // Check if a creature template with this name already exists
    const existing = (await creatureTemplateRepository.listByCampaign(encounter.campaignId)).find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    const template = existing ?? await creatureTemplateRepository.create({
      campaignId: encounter.campaignId,
      name,
      category: 'monster',
      stats: { hp: stats.hp ?? 0, armor: stats.armor ?? 0, movement: stats.movement ?? 0 },
      attacks: [],
      abilities: [],
      skills: [],
      tags: [],
      status: 'active',
    });
    if (!template) return;

    // Create participant + represents edge in one transaction so the
    // relationship is observable by the rest of the app atomically.
    const now = nowISO();
    const participantId = generateId();
    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const enc = await db.encounters.get(encounter.id);
      if (!enc) throw new Error(`encounter ${encounter.id} not found`);
      const newParticipant: EncounterParticipant = {
        id: participantId,
        name: template.name,
        type: 'monster',
        instanceState: { currentHp: template.stats.hp },
        sortOrder: (enc.participants?.length ?? 0) + 1,
      };
      await db.encounters.update(encounter.id, {
        participants: [...(enc.participants ?? []), newParticipant],
        updatedAt: now,
      });
      await entityLinkRepository.createLink({
        fromEntityId: participantId,
        fromEntityType: 'encounterParticipant',
        toEntityId: template.id,
        toEntityType: 'creature',
        relationshipType: 'represents',
      });
    });
    setShowQuickCreate(false);
    await refresh();
  };

  const handleAddWholeParty = async () => {
    if (partyCharacterIds.length === 0) {
      showToast('No linked party characters to add');
      return;
    }

    const now = nowISO();
    let addedCount = 0;
    const characters = (
      await Promise.all(partyCharacterIds.map((id) => getCharacterById(id)))
    ).filter((character): character is CharacterRecord => character !== undefined);

    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const enc = await db.encounters.get(encounter.id);
      if (!enc) throw new Error(`encounter ${encounter.id} not found`);

      const participantIds = new Set((enc.participants ?? []).map((p) => p.id));
      const existingLinks = await db.entityLinks.toArray();

      const existingCharacterIds = new Set(
        existingLinks
          .filter((link) =>
            !link.deletedAt
            && link.toEntityType === 'character'
            && participantIds.has(link.fromEntityId),
          )
          .map((link) => link.toEntityId),
      );

      let updatedParticipants = [...(enc.participants ?? [])];

      for (const character of characters) {
        if (existingCharacterIds.has(character.id)) continue;

        const participantId = generateId();
        updatedParticipants.push({
          id: participantId,
          name: character.name,
          type: 'pc',
          instanceState: {},
          sortOrder: updatedParticipants.length + 1,
        });

        await entityLinkRepository.createLink({
          fromEntityId: participantId,
          fromEntityType: 'encounterParticipant',
          toEntityId: character.id,
          toEntityType: 'character',
          relationshipType: 'represents',
        });

        existingCharacterIds.add(character.id);
        addedCount += 1;
      }

      if (addedCount > 0) {
        await db.encounters.update(encounter.id, {
          participants: updatedParticipants,
          updatedAt: now,
        });
      }
    });

    if (addedCount > 0) {
      await refresh();
      showToast(
        addedCount === 1 ? 'Added 1 party character' : `Added ${addedCount} party characters`,
        'success',
        2000,
      );
      return;
    }

    showToast('Party is already in this encounter', 'info', 2000);
  };

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[var(--color-text)] m-0">{encounter.title}</h3>
          <span className="text-xs text-[var(--color-text-muted)]">
            Combat &middot; Round {currentRound}
          </span>
        </div>
        <button onClick={onClose} className={actionBtnClass}>
          Back
        </button>
      </div>

      {/* Round counter + next round */}
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] rounded-lg px-4 py-2 font-bold text-lg">
          Round {currentRound}
        </div>
        {encounter.status === 'active' && (
          <button
            onClick={handleNextRound}
            className="min-h-11 px-4 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm font-semibold cursor-pointer"
          >
            Next Round
          </button>
        )}
      </div>

      {/* Participants */}
      <div className="mb-4">
        <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
          Participants ({participants.length})
        </h4>
        <div className="flex flex-col gap-1.5">
          {participants
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((p) => {
              const linkedCreatureId = participantTemplateMap[p.id];
              const template = linkedCreatureId ? templateCache[linkedCreatureId] : undefined;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedParticipant(p)}
                  className="w-full text-left bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text)] text-sm font-semibold">
                        {p.name}
                      </span>
                      <span className="text-[var(--color-text-muted)] text-xs capitalize">
                        {p.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {template && (
                        <span className="text-[var(--color-text-muted)] text-[10px]">
                          Armor {template.stats.armor}
                        </span>
                      )}
                      {p.instanceState.currentHp !== undefined && (
                        <span
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            p.instanceState.currentHp <= 0
                              ? 'text-red-500'
                              : 'text-[var(--color-text)]'
                          )}
                        >
                          HP {p.instanceState.currentHp}
                        </span>
                      )}
                    </div>
                  </div>
                  {p.instanceState.conditions && p.instanceState.conditions.length > 0 && (
                    <div className="text-amber-600 dark:text-amber-400 text-[10px] mt-0.5">
                      {p.instanceState.conditions.join(', ')}
                    </div>
                  )}
                </button>
              );
            })}
        </div>
        {encounter.status === 'active' && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            {partyCharacterIds.length > 0 && (
              <button
                onClick={handleAddWholeParty}
                className={cn(actionBtnClass, 'w-full')}
              >
                Add Entire Party
              </button>
            )}
            <button
              onClick={() => setShowQuickCreate(true)}
              className={cn(actionBtnClass, 'w-full')}
            >
              Quick Add Participant
            </button>
          </div>
        )}
      </div>

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="mb-4">
          <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
            Events
          </h4>
          <div className="flex flex-col gap-1">
            {events
              .slice()
              .reverse()
              .slice(0, 20)
              .map((event: Record<string, unknown>, i: number) => (
                <div
                  key={i}
                  className="bg-[var(--color-surface-raised)] rounded px-3 py-1.5 text-xs text-[var(--color-text)]"
                >
                  <span className="text-[var(--color-text-muted)]">R{String(event.round)}</span>{' '}
                  <span className="font-semibold">{String(event.type)}</span>:{' '}
                  {String(event.description ?? '')}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Quick event add (simplified) */}
      {encounter.status === 'active' && (
        <div className="mb-4">
          <QuickEventAdd onAdd={handleAddEvent} />
        </div>
      )}

      {/* Participant drawer */}
      {selectedParticipant && (
        <ParticipantDrawer
          participant={selectedParticipant}
          onUpdateState={(patch) => handleUpdateParticipantState(selectedParticipant.id, patch)}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      {/* Quick create */}
      {showQuickCreate && (
        <QuickCreateParticipantFlow
          onSubmit={handleQuickCreate}
          onCancel={() => setShowQuickCreate(false)}
        />
      )}
    </div>
  );
}

/**
 * Simplified inline event adder for combat encounters.
 */
function QuickEventAdd({ onAdd }: { onAdd: (data: { type: string; description: string }) => Promise<void> }) {
  const [type, setType] = useState('attack');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!description.trim()) return;
    await onAdd({ type, description: description.trim() });
    setDescription('');
  };

  return (
    <div className="flex gap-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="min-h-11 px-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs"
      >
        {['attack', 'spell', 'ability', 'damage', 'heal', 'condition', 'note'].map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Event description..."
        className="flex-1 px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm box-border"
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        disabled={!description.trim()}
        className="min-h-11 px-3 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-xs font-semibold cursor-pointer"
      >
        Add
      </button>
    </div>
  );
}
