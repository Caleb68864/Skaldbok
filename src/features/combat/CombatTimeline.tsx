import { useState, useEffect, useCallback } from 'react';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { getNoteById } from '../../storage/repositories/noteRepository';
import * as noteRepository from '../../storage/repositories/noteRepository';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { Drawer } from '../../components/primitives/Drawer';
import { AbilityPicker } from './AbilityPicker';
import { SpellPicker } from './SpellPicker';
import { cn } from '../../lib/utils';
import type { CombatEvent, CombatTypeData } from '../../types/noteValidators';

const DRAGONBANE_CONDITIONS = [
  { name: 'Exhausted', attribute: 'STR' },
  { name: 'Sickly', attribute: 'CON' },
  { name: 'Dazed', attribute: 'AGL' },
  { name: 'Angry', attribute: 'INT' },
  { name: 'Scared', attribute: 'WIL' },
  { name: 'Disheartened', attribute: 'CHA' },
] as const;

export interface CombatTimelineProps {
  combatNoteId: string;
  onClose: () => void;
}

type EventType = 'attack' | 'spell' | 'ability' | 'damage' | 'heal' | 'condition' | 'note';

const EVENT_TYPES: EventType[] = ['attack', 'spell', 'ability', 'damage', 'heal', 'condition', 'note'];

interface EventFormState {
  type: EventType | null;
  actorName: string;
  targetName: string;
  label: string;
  value: string;
}

const EMPTY_FORM: EventFormState = {
  type: null,
  actorName: '',
  targetName: '',
  label: '',
  value: '',
};

const DEFAULT_LABELS: Record<EventType, string> = {
  attack: 'Attack',
  spell: 'Spell',
  ability: 'Ability',
  damage: 'Damage',
  heal: 'Heal',
  condition: 'Condition',
  note: 'Note',
};

export function CombatTimeline({ combatNoteId, onClose }: CombatTimelineProps) {
  const { character: activeCharacter } = useActiveCharacter();
  const [typeData, setTypeData] = useState<CombatTypeData>({
    rounds: [{ roundNumber: 1, events: [] }],
    participants: [],
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [eventForm, setEventForm] = useState<EventFormState>(() => ({
    ...EMPTY_FORM,
    actorName: activeCharacter?.name ?? '',
  }));
  const [showAbilityPicker, setShowAbilityPicker] = useState(false);
  const [showSpellPicker, setShowSpellPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync actorName pre-fill when active character resolves (form in untyped state only)
  useEffect(() => {
    if (activeCharacter?.name) {
      setEventForm(prev => prev.type === null ? { ...prev, actorName: activeCharacter.name } : prev);
    }
  }, [activeCharacter?.name]);

  // Update label when event type changes
  useEffect(() => {
    if (eventForm.type) {
      setEventForm(prev => ({ ...prev, label: DEFAULT_LABELS[prev.type!] }));
    }
  // Only run when type changes, not on every eventForm change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventForm.type]);

  // Load combat note on mount
  useEffect(() => {
    let mounted = true;
    getNoteById(combatNoteId).then(note => {
      if (!mounted || !note || note.type !== 'combat') return;
      const td = note.typeData as CombatTypeData;
      setTypeData(td);
      const lastRound = td.rounds[td.rounds.length - 1];
      if (lastRound) setCurrentRound(lastRound.roundNumber);
    });
    return () => { mounted = false; };
  }, [combatNoteId]);

  const persistTypeData = useCallback(async (updatedTypeData: CombatTypeData) => {
    setSaving(true);
    try {
      const lastRound = updatedTypeData.rounds[updatedTypeData.rounds.length - 1];
      await noteRepository.updateNote(combatNoteId, {
        typeData: updatedTypeData,
        title: `Combat — Round ${lastRound?.roundNumber ?? 1}`,
      });
    } catch (e) {
      console.error('CombatTimeline.persistTypeData failed:', e);
    } finally {
      setSaving(false);
    }
  }, [combatNoteId]);

  const addEvent = useCallback(async (event: CombatEvent) => {
    const updatedRounds = typeData.rounds.map(r =>
      r.roundNumber === currentRound
        ? { ...r, events: [...r.events, event] }
        : r
    );
    const updated: CombatTypeData = { ...typeData, rounds: updatedRounds };
    setTypeData(updated);
    await persistTypeData(updated);
    setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' });
  }, [typeData, currentRound, persistTypeData, activeCharacter?.name]);

  const handleEventTypeClick = (type: EventType) => {
    if (type === 'ability') {
      setEventForm(prev => ({ ...prev, type }));
      setShowAbilityPicker(true);
      return;
    }
    if (type === 'spell') {
      setEventForm(prev => ({ ...prev, type }));
      setShowSpellPicker(true);
      return;
    }
    if (type === 'condition') {
      setShowConditionPicker(true);
      return;
    }
    setEventForm({
      type,
      actorName: activeCharacter?.name ?? '',
      targetName: '',
      label: type.charAt(0).toUpperCase() + type.slice(1),
      value: '',
    });
  };

  const handleConditionSelect = async (conditionName: string, attribute: string, targetName: string) => {
    const event: CombatEvent = {
      id: generateId(),
      type: 'condition',
      actorName: targetName || undefined,
      label: conditionName,
      value: attribute,
      description: `${conditionName} (${attribute})`,
      timestamp: nowISO(),
    };
    await addEvent(event);
    setShowConditionPicker(false);
  };

  const handleSubmitEvent = async () => {
    if (!eventForm.type) return;
    const event: CombatEvent = {
      id: generateId(),
      type: eventForm.type,
      actorName: eventForm.actorName || undefined,
      targetName: eventForm.targetName || undefined,
      label: eventForm.label || eventForm.type,
      value: eventForm.value || undefined,
      timestamp: nowISO(),
    };
    await addEvent(event);
  };

  const handleAbilitySelect = async (abilityName: string) => {
    const event: CombatEvent = {
      id: generateId(),
      type: 'ability',
      actorName: activeCharacter?.name ?? undefined,
      label: abilityName,
      timestamp: nowISO(),
    };
    await addEvent(event);
    setShowAbilityPicker(false);
  };

  const handleSpellSelect = async (spellName: string, characterName: string) => {
    const event: CombatEvent = {
      id: generateId(),
      type: 'spell',
      actorName: characterName,
      label: spellName,
      timestamp: nowISO(),
    };
    await addEvent(event);
    setShowSpellPicker(false);
  };

  const handleNextRound = async () => {
    const newRoundNumber = currentRound + 1;
    const separator: CombatEvent = {
      id: generateId(),
      type: 'round-separator',
      label: `--- Round ${newRoundNumber} begins ---`,
      timestamp: nowISO(),
    };
    // Add separator to current round
    const roundsWithSep = typeData.rounds.map(r =>
      r.roundNumber === currentRound
        ? { ...r, events: [...r.events, separator] }
        : r
    );
    const newRound = { roundNumber: newRoundNumber, events: [] };
    const updatedRounds = [...roundsWithSep, newRound];
    const updated: CombatTypeData = { ...typeData, rounds: updatedRounds };
    setTypeData(updated);
    setCurrentRound(newRoundNumber);
    await persistTypeData(updated);
  };

  const handleEndCombat = async () => {
    const endEvent: CombatEvent = {
      id: generateId(),
      type: 'note',
      label: 'Combat ended',
      timestamp: nowISO(),
    };
    await addEvent(endEvent);
    // Mark note as archived
    await noteRepository.updateNote(combatNoteId, { status: 'archived' });
    onClose();
  };

  // All events in reverse chronological order for display
  const allEvents: Array<CombatEvent & { roundNumber: number }> = [];
  for (const round of [...typeData.rounds].reverse()) {
    for (const event of [...round.events].reverse()) {
      allEvents.push({ ...event, roundNumber: round.roundNumber });
    }
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[var(--color-text)]">
          Combat — Round {currentRound}
          {saving && <span className="text-xs text-[var(--color-text-muted)] ml-2">saving...</span>}
        </h3>
        <button
          onClick={handleEndCombat}
          className="min-h-11 min-w-11 px-3 bg-transparent border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] cursor-pointer text-[13px]"
        >
          End Combat
        </button>
      </div>

      {/* Next Round */}
      <button
        onClick={handleNextRound}
        className="min-h-11 min-w-11 px-4 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg text-[15px] font-semibold cursor-pointer mb-3"
      >
        Next Round
      </button>

      {/* Event type chips */}
      <p className="text-[var(--color-text-muted)] text-xs mb-2">Quick Event:</p>
      <div className="flex gap-2 flex-wrap mb-3">
        {EVENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => handleEventTypeClick(type)}
            className="min-h-11 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-full text-[var(--color-text)] cursor-pointer text-[13px] font-semibold shrink-0"
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Event form */}
      {eventForm.type && eventForm.type !== 'ability' && eventForm.type !== 'spell' && (
        <div
          className="bg-[var(--color-surface-raised)] rounded-lg p-3 mb-3"
        >
          <p className="text-[var(--color-text)] font-semibold mb-2">
            {eventForm.type.charAt(0).toUpperCase() + eventForm.type.slice(1)}
          </p>
          <input
            type="text"
            placeholder="Actor (optional)"
            value={eventForm.actorName}
            onChange={e => setEventForm(f => ({ ...f, actorName: e.target.value }))}
            className="block w-full p-2 min-h-11 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-sm box-border"
          />
          <input
            type="text"
            placeholder="Target (optional)"
            value={eventForm.targetName}
            onChange={e => setEventForm(f => ({ ...f, targetName: e.target.value }))}
            className="block w-full p-2 min-h-11 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-sm box-border"
          />
          <input
            type="text"
            placeholder="Label"
            value={eventForm.label}
            onChange={e => setEventForm(f => ({ ...f, label: e.target.value }))}
            className="block w-full p-2 min-h-11 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-sm box-border"
          />
          <input
            type="text"
            placeholder="Value (optional, e.g. damage amount)"
            value={eventForm.value}
            onChange={e => setEventForm(f => ({ ...f, value: e.target.value }))}
            className="block w-full p-2 min-h-11 mb-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[var(--color-text)] text-sm box-border"
          />
          <div className="flex gap-3">
            <button
              onClick={handleSubmitEvent}
              className="flex-1 min-h-11 bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)] border-none rounded-lg cursor-pointer font-semibold"
            >
              Log Event
            </button>
            <button
              onClick={() => setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' })}
              className="min-h-11 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Ability picker drawer */}
      <Drawer
        open={showAbilityPicker}
        onClose={() => { setShowAbilityPicker(false); setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' }); }}
        title="Heroic Abilities"
      >
        <AbilityPicker
          onSelect={handleAbilitySelect}
          onClose={() => { setShowAbilityPicker(false); setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' }); }}
        />
      </Drawer>

      {/* Spell picker drawer */}
      <Drawer
        open={showSpellPicker}
        onClose={() => { setShowSpellPicker(false); setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' }); }}
        title="Spells"
      >
        <SpellPicker
          onSelect={handleSpellSelect}
          onClose={() => { setShowSpellPicker(false); setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' }); }}
        />
      </Drawer>

      {/* Condition picker drawer */}
      <Drawer
        open={showConditionPicker}
        onClose={() => setShowConditionPicker(false)}
        title="Apply Condition"
      >
        <ConditionPicker
          onSelect={handleConditionSelect}
          onClose={() => setShowConditionPicker(false)}
        />
      </Drawer>

      {/* Event log */}
      <p className="text-[var(--color-text-muted)] text-xs mb-2">Event Log:</p>
      <div
        className="bg-[var(--color-surface-raised)] rounded-lg p-2 max-h-[300px] overflow-y-auto"
      >
        {allEvents.length === 0 ? (
          <p className="text-[var(--color-text-muted)] text-[13px] p-1">
            No events yet.
          </p>
        ) : (
          allEvents.map(event => (
            <div
              key={event.id}
              className={cn(
                'py-1 border-b border-[var(--color-border)] text-[13px]',
                event.type === 'round-separator'
                  ? 'text-[var(--color-text-muted)] italic'
                  : 'text-[var(--color-text)]'
              )}
            >
              {event.type !== 'round-separator' && event.actorName && (
                <span className="font-semibold">{event.actorName}: </span>
              )}
              {event.label}
              {event.targetName && (
                <span className="text-[var(--color-text-muted)]"> → {event.targetName}</span>
              )}
              {event.value && (
                <span className="text-[var(--color-accent)] ml-1.5">[{event.value}]</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Condition Picker ────────────────────────────────────────────

interface ConditionPickerProps {
  onSelect: (conditionName: string, attribute: string, targetName: string) => void;
  onClose: () => void;
}

function ConditionPicker({ onSelect, onClose }: ConditionPickerProps) {
  const [target, setTarget] = useState('');

  return (
    <div>
      <input
        type="text"
        placeholder="Who is affected? (optional)"
        value={target}
        onChange={e => setTarget(e.target.value)}
        className="block w-full px-3 py-2.5 min-h-11 mb-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] text-base box-border"
      />
      <div className="flex flex-col gap-0.5">
        {DRAGONBANE_CONDITIONS.map(c => (
          <button
            key={c.name}
            onClick={() => { onSelect(c.name, c.attribute, target.trim()); onClose(); }}
            className="flex justify-between items-center w-full text-left p-3 min-h-11 bg-transparent border-0 border-b border-b-[var(--color-border)] text-[var(--color-text)] cursor-pointer text-base"
          >
            <span className="font-semibold">{c.name}</span>
            <span className="text-[var(--color-text-muted)] text-sm">{c.attribute}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
