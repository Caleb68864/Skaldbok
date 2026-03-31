import React, { useState, useEffect, useCallback } from 'react';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { getNoteById } from '../../storage/repositories/noteRepository';
import * as noteRepository from '../../storage/repositories/noteRepository';
import { useActiveCharacter } from '../../context/ActiveCharacterContext';
import { Drawer } from '../../components/primitives/Drawer';
import { AbilityPicker } from './AbilityPicker';
import { SpellPicker } from './SpellPicker';
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

  const chipStyle = (_type: EventType): React.CSSProperties => ({
    minHeight: '44px',
    padding: '0 12px',
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border)',
    borderRadius: '22px',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    flexShrink: 0,
  });

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ color: 'var(--color-text)' }}>
          Combat — Round {currentRound}
          {saving && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>saving...</span>}
        </h3>
        <button
          onClick={handleEndCombat}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            padding: '0 12px',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          End Combat
        </button>
      </div>

      {/* Next Round */}
      <button
        onClick={handleNextRound}
        style={{
          minHeight: '44px',
          minWidth: '44px',
          padding: '0 16px',
          background: 'var(--color-accent)',
          color: 'var(--color-on-accent, #fff)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '12px',
        }}
      >
        Next Round
      </button>

      {/* Event type chips */}
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '6px' }}>Quick Event:</p>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {EVENT_TYPES.map(type => (
          <button
            key={type}
            onClick={() => handleEventTypeClick(type)}
            style={chipStyle(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Event form */}
      {eventForm.type && eventForm.type !== 'ability' && eventForm.type !== 'spell' && (
        <div
          style={{
            background: 'var(--color-surface-raised)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
          }}
        >
          <p style={{ color: 'var(--color-text)', fontWeight: 600, marginBottom: '8px' }}>
            {eventForm.type.charAt(0).toUpperCase() + eventForm.type.slice(1)}
          </p>
          <input
            type="text"
            placeholder="Actor (optional)"
            value={eventForm.actorName}
            onChange={e => setEventForm(f => ({ ...f, actorName: e.target.value }))}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              minHeight: '44px',
              marginBottom: '6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="Target (optional)"
            value={eventForm.targetName}
            onChange={e => setEventForm(f => ({ ...f, targetName: e.target.value }))}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              minHeight: '44px',
              marginBottom: '6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="Label"
            value={eventForm.label}
            onChange={e => setEventForm(f => ({ ...f, label: e.target.value }))}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              minHeight: '44px',
              marginBottom: '6px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="Value (optional, e.g. damage amount)"
            value={eventForm.value}
            onChange={e => setEventForm(f => ({ ...f, value: e.target.value }))}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              minHeight: '44px',
              marginBottom: '8px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSubmitEvent}
              style={{
                flex: 1,
                minHeight: '44px',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent, #fff)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Log Event
            </button>
            <button
              onClick={() => setEventForm({ ...EMPTY_FORM, actorName: activeCharacter?.name ?? '' })}
              style={{
                minHeight: '44px',
                padding: '0 12px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
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
      <p style={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '6px' }}>Event Log:</p>
      <div
        style={{
          background: 'var(--color-surface-raised)',
          borderRadius: '8px',
          padding: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
        }}
      >
        {allEvents.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', padding: '4px' }}>
            No events yet.
          </p>
        ) : (
          allEvents.map(event => (
            <div
              key={event.id}
              style={{
                padding: '4px 0',
                borderBottom: '1px solid var(--color-border)',
                color: event.type === 'round-separator'
                  ? 'var(--color-text-muted)'
                  : 'var(--color-text)',
                fontSize: '13px',
                fontStyle: event.type === 'round-separator' ? 'italic' : 'normal',
              }}
            >
              {event.type !== 'round-separator' && event.actorName && (
                <span style={{ fontWeight: 600 }}>{event.actorName}: </span>
              )}
              {event.label}
              {event.targetName && (
                <span style={{ color: 'var(--color-text-muted)' }}> → {event.targetName}</span>
              )}
              {event.value && (
                <span style={{ color: 'var(--color-accent)', marginLeft: '6px' }}>[{event.value}]</span>
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
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 12px',
          minHeight: '44px',
          marginBottom: '12px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          color: 'var(--color-text)',
          fontSize: '16px',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {DRAGONBANE_CONDITIONS.map(c => (
          <button
            key={c.name}
            onClick={() => { onSelect(c.name, c.attribute, target.trim()); onClose(); }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              textAlign: 'left',
              padding: '12px',
              minHeight: '44px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{c.attribute}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
