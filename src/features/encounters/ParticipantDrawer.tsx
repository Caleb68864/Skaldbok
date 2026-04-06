import { useState, useEffect } from 'react';
import type { EncounterParticipant } from '../../types/encounter';
import type { CreatureTemplate } from '../../types/creatureTemplate';
import { getById } from '../../storage/repositories/creatureTemplateRepository';

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
  const [template, setTemplate] = useState<CreatureTemplate | null>(null);
  const [currentHp, setCurrentHp] = useState<string>(String(participant.instanceState.currentHp ?? ''));
  const [notes, setNotes] = useState(participant.instanceState.notes ?? '');
  const [conditionsText, setConditionsText] = useState(
    (participant.instanceState.conditions ?? []).join(', ')
  );

  useEffect(() => {
    if (participant.linkedCreatureId) {
      getById(participant.linkedCreatureId).then((t) => setTemplate(t ?? null));
    }
  }, [participant.linkedCreatureId]);

  const handleHpBlur = () => {
    const hp = currentHp === '' ? undefined : Number(currentHp);
    onUpdateState({ currentHp: hp });
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
              Current HP
            </label>
            <input
              type="number"
              value={currentHp}
              onChange={(e) => setCurrentHp(e.target.value)}
              onBlur={handleHpBlur}
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
              placeholder="e.g. poisoned, prone"
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
