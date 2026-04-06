import { useState, useEffect, useCallback } from 'react';
import type { Encounter, EncounterParticipant } from '../../types/encounter';
import * as encounterRepository from '../../storage/repositories/encounterRepository';
import { getById as getCreatureTemplateById } from '../../storage/repositories/creatureTemplateRepository';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { ParticipantDrawer } from './ParticipantDrawer';
import { QuickCreateParticipantFlow } from './QuickCreateParticipantFlow';
import { generateId } from '../../utils/ids';
import { cn } from '../../lib/utils';

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
  const [encounter, setEncounter] = useState<Encounter>(initialEncounter);
  const [selectedParticipant, setSelectedParticipant] = useState<EncounterParticipant | null>(null);
  const [templateCache, setTemplateCache] = useState<Record<string, CreatureTemplate>>({});
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const currentRound = encounter.combatData?.currentRound ?? 1;
  const events = encounter.combatData?.events ?? [];
  const participants = encounter.participants;

  // Load creature templates for all participants
  useEffect(() => {
    const creatureIds = participants
      .map((p) => p.linkedCreatureId)
      .filter((id): id is string => id !== undefined);

    const uniqueIds = [...new Set(creatureIds)].filter((id) => !templateCache[id]);
    if (uniqueIds.length === 0) return;

    Promise.all(uniqueIds.map((id) => getCreatureTemplateById(id))).then((templates) => {
      const newCache: Record<string, CreatureTemplate> = { ...templateCache };
      for (const t of templates) {
        if (t) newCache[t.id] = t;
      }
      setTemplateCache(newCache);
    });
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

  const handleUpdateParticipantState = async (
    participantId: string,
    patch: Partial<EncounterParticipant['instanceState']>
  ) => {
    const participant = participants.find((p) => p.id === participantId);
    if (!participant) return;
    await encounterRepository.updateParticipant(encounter.id, participantId, {
      instanceState: { ...participant.instanceState, ...patch },
    });
    await refresh();
  };

  const handleQuickCreate = async (name: string, stats: { hp?: number; armor?: number; movement?: number }) => {
    const { create: createTemplate, listByCampaign } = await import('../../storage/repositories/creatureTemplateRepository');
    // Check if a creature template with this name already exists
    const existing = (await listByCampaign(encounter.campaignId)).find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
    const template = existing ?? await createTemplate({
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
    await encounterRepository.addParticipant(encounter.id, {
      name: template.name,
      type: 'monster',
      linkedCreatureId: template.id,
      instanceState: { currentHp: template.stats.hp },
      sortOrder: participants.length + 1,
    });
    setShowQuickCreate(false);
    await refresh();
  };

  const handleEndEncounter = async () => {
    if (!confirm('End this combat encounter?')) return;
    await encounterRepository.end(encounter.id);
    onClose();
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
              const template = p.linkedCreatureId ? templateCache[p.linkedCreatureId] : undefined;
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
          <button
            onClick={() => setShowQuickCreate(true)}
            className={cn(actionBtnClass, 'w-full mt-2')}
          >
            Quick Add Participant
          </button>
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

      {/* End encounter */}
      {encounter.status === 'active' && (
        <button
          onClick={handleEndEncounter}
          className="w-full min-h-11 px-4 py-2 bg-red-600 text-white border-none rounded-lg text-sm font-semibold cursor-pointer"
        >
          End Combat
        </button>
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
