import { useState, useEffect } from 'react';
import type { EncounterParticipant } from '../../types/encounter';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { getById } from '../../storage/repositories/creatureTemplateRepository';
import { getLinksFrom } from '../../storage/repositories/entityLinkRepository';
import { useSystemEngineFor } from '../systems/engine';
import { useCampaignContext } from '../campaign/CampaignContext';
import { useSystemDefinition } from '../systems/useSystemDefinition';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import * as characterRepository from '../../storage/repositories/characterRepository';
import type { CharacterRecord } from '../../types/character';
import { nowISO } from '../../utils/dates';

interface ParticipantDrawerProps {
  participant: EncounterParticipant;
  onUpdateState: (patch: Partial<EncounterParticipant['instanceState']>) => Promise<void>;
  onClose: () => void;
}

const inputClass = 'w-full px-3 py-2 min-h-11 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-sm box-border';

/**
 * Bottom sheet drawer for viewing/editing a participant's stats.
 * Shows linked creature template stats (read-only) and editable instance state.
 * Tap-to-record flow: tap participant (1) -> tap field (2) -> type value + auto-save (3).
 */
export function ParticipantDrawer({ participant, onUpdateState, onClose }: ParticipantDrawerProps) {
  const { activeCampaign } = useCampaignContext();
  const engine = useSystemEngineFor(activeCampaign?.system);
  const { system } = useSystemDefinition(activeCampaign?.system ?? 'classic-fantasy');
  const { character: activeCharacter, updateCharacter } = useActiveCharacter();
  const [template, setTemplate] = useState<CreatureTemplate | null>(null);
  const [linkedCharacter, setLinkedCharacter] = useState<CharacterRecord | null>(null);
  const [currentHp, setCurrentHp] = useState<string>(String(participant.instanceState.currentHp ?? ''));
  const [notes, setNotes] = useState(participant.instanceState.notes ?? '');
  const [conditionsText, setConditionsText] = useState(
    (participant.instanceState.conditions ?? []).join(', ')
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const links = await getLinksFrom(participant.id, 'represents');

      const creatureEdge = links.find((l) => l.toEntityType === 'creature');
      if (creatureEdge) {
        const t = await getById(creatureEdge.toEntityId);
        if (!cancelled) setTemplate(t ?? null);
      } else if (!cancelled) {
        setTemplate(null);
      }

      // A participant that represents a PC must edit that character's own
      // health, not a second number that silently disagrees with their sheet.
      const characterEdge = links.find((l) => l.toEntityType === 'character');
      if (!characterEdge) {
        if (!cancelled) setLinkedCharacter(null);
        return;
      }
      const c = await characterRepository.getById(characterEdge.toEntityId);
      if (!cancelled) setLinkedCharacter(c ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [participant]);

  /** The PC's health resource, when this participant represents a character. */
  const healthResourceId = engine.primaryHealthResourceId;
  const linkedResource =
    linkedCharacter && healthResourceId ? linkedCharacter.resources?.[healthResourceId] : undefined;
  const linkedHealthLabel =
    (healthResourceId && system?.resources?.find(r => r.id === healthResourceId)?.name) ??
    engine.labels.participantHealth;

  // Show the character's own value once the link resolves, so the GM is never
  // editing a stale copy of a number the player has already changed.
  useEffect(() => {
    if (linkedResource) setCurrentHp(String(linkedResource.current));
  }, [linkedResource?.current, linkedResource]);

  const handleHpBlur = () => {
    const hp = currentHp === '' ? undefined : Number(currentHp);
    onUpdateState({ currentHp: hp });
  };

  /**
   * Writes a linked PC's health back to the character record.
   *
   * @remarks
   * Always persists through the repository. Routing this through the
   * active-character context alone is not enough: that context only holds state
   * in memory and is persisted by the `useAutosave` hook on the character
   * screens, which is not mounted while the GM is on the session screen — the
   * edit would be silently lost on reload. The context is *also* updated when
   * this is the active character, so an open sheet re-renders rather than
   * showing a stale number.
   */
  const handleLinkedHealthBlur = async () => {
    if (!linkedCharacter || !healthResourceId) return;
    // Bail if the character has no such resource: writing here would fabricate a
    // maxless `{ current }` entry that normalisation then pins to max 0.
    if (!linkedResource) return;
    const parsed = Number(currentHp);
    if (currentHp === '' || !Number.isFinite(parsed)) return;
    const next = Math.max(0, Math.min(parsed, linkedResource.max));

    const updated: CharacterRecord = {
      ...linkedCharacter,
      resources: {
        ...linkedCharacter.resources,
        [healthResourceId]: { ...linkedCharacter.resources[healthResourceId], current: next },
      },
      updatedAt: nowISO(),
    };
    await characterRepository.save(updated);
    setLinkedCharacter(updated);

    if (activeCharacter?.id === linkedCharacter.id) {
      updateCharacter(() => ({ resources: updated.resources, updatedAt: updated.updatedAt }));
    }
  };

  const handleNotesBlur = () => {
    onUpdateState({ notes: notes || undefined });
  };

  const handleConditionsBlur = () => {
    const conditions = conditionsText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    onUpdateState({ conditions: conditions.length > 0 ? conditions : undefined });
  };

  return (
    <div
      role="dialog"
      aria-label={`${participant.name} stats`}
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-[300] flex items-end justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-[480px] max-h-[70vh] overflow-y-auto px-4 pt-5 pb-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[var(--color-text)] m-0">{participant.name}</h3>
            <span className="text-xs text-[var(--color-text-muted)] capitalize">{participant.type}</span>
          </div>
          <button
            onClick={onClose}
            className="min-h-11 min-w-11 px-3 py-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-xs cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Template stats (read-only) */}
        {template && (
          <div className="mb-4">
            <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
              Base Stats
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="bg-[var(--color-surface-raised)] rounded p-2 text-center">
                <div className="text-[var(--color-text)] text-sm font-bold">{template.stats.hp}</div>
                <div className="text-[var(--color-text-muted)] text-[10px]">HP</div>
              </div>
              <div className="bg-[var(--color-surface-raised)] rounded p-2 text-center">
                <div className="text-[var(--color-text)] text-sm font-bold">{template.stats.armor}</div>
                <div className="text-[var(--color-text-muted)] text-[10px]">Armor</div>
              </div>
              <div className="bg-[var(--color-surface-raised)] rounded p-2 text-center">
                <div className="text-[var(--color-text)] text-sm font-bold">{template.stats.movement}</div>
                <div className="text-[var(--color-text-muted)] text-[10px]">Mv</div>
              </div>
            </div>
            {template.attacks.length > 0 && (
              <div className="text-xs text-[var(--color-text-muted)]">
                {template.attacks.map((a) => a.name).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Instance state (editable) */}
        <h4 className="text-[var(--color-text)] text-xs font-semibold uppercase tracking-wide mb-2">
          Current State
        </h4>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[var(--color-text-muted)] text-xs font-semibold mb-1">
              {linkedCharacter ? linkedHealthLabel : engine.labels.participantHealth}
              {linkedResource && (
                <span className="ml-1 font-normal text-[var(--color-text-muted)]">
                  / {linkedResource.max} · syncs with sheet
                </span>
              )}
            </label>
            <input
              type="number"
              value={currentHp}
              onChange={(e) => setCurrentHp(e.target.value)}
              onBlur={linkedCharacter ? handleLinkedHealthBlur : handleHpBlur}
              className={inputClass}
              placeholder="HP"
            />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-xs font-semibold mb-1">
              Conditions (comma separated)
            </label>
            <input
              type="text"
              value={conditionsText}
              onChange={(e) => setConditionsText(e.target.value)}
              onBlur={handleConditionsBlur}
              className={inputClass}
              placeholder={engine.labels.conditionExamples}
            />
          </div>
          <div>
            <label className="block text-[var(--color-text-muted)] text-xs font-semibold mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Participant notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
