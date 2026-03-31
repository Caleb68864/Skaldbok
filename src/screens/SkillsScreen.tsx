import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useAppState } from '../context/AppStateContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useFieldEditable } from '../utils/modeGuards';
import { SkillList } from '../components/fields/SkillList';
import { Chip } from '../components/primitives/Chip';
import { GameIcon } from '../components/primitives/GameIcon';
import {
  calcNormalProb,
  calcBoonProb,
  calcBaneProb,
  resolveEffectiveBoonBane,
  formatProb,
} from '../utils/boonBane';
import type { BoonBaneState } from '../types/settings';
import type { CharacterSkill } from '../types/character';
import type { ConditionDefinition, AttributeDefinition } from '../types/system';
import { nowISO } from '../utils/dates';
import { computeSkillValue } from '../utils/derivedValues';

export default function SkillsScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const { sessionState, setGlobalBoonBane, setSkillOverride } = useAppState();
  const skillsEditable = useFieldEditable('skills.any');
  const [filter, setFilter] = useState<'all' | 'relevant'>('relevant');

  useEffect(() => {
    if (!isLoading && !character) {
      navigate('/library');
    }
  }, [isLoading, character, navigate]);

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) return null;

  function handleSkillChange(skillId: string, value: CharacterSkill) {
    if (!character) return;
    updateCharacter({ skills: { ...character.skills, [skillId]: value }, updatedAt: nowISO() });
  }

  function cycleSkillMark(skillId: string) {
    if (!character || skillsEditable) return;
    const cs = character.skills[skillId];
    const def = system?.skillCategories.flatMap(c => c.skills).find(s => s.id === skillId);
    const attrVal = def?.linkedAttributeId ? (character.attributes[def.linkedAttributeId] ?? 10) : 0;
    const trained = cs?.trained ?? false;
    const fallbackValue = def?.linkedAttributeId
      ? computeSkillValue(attrVal, trained)
      : (trained ? Math.max((def?.baseChance ?? 0) * 2, 1) : (def?.baseChance ?? 0));
    const skill = cs ?? { value: fallbackValue, trained: false };

    let updated: CharacterSkill;
    if (!cs?.dragonMarked && !cs?.demonMarked) {
      // Unmarked -> Dragon
      updated = { ...skill, dragonMarked: true, demonMarked: false };
    } else if (cs?.dragonMarked) {
      // Dragon -> Demon
      updated = { ...skill, dragonMarked: false, demonMarked: true };
    } else {
      // Demon -> Clear
      updated = { ...skill, dragonMarked: false, demonMarked: false };
    }
    updateCharacter({ skills: { ...character.skills, [skillId]: updated }, updatedAt: nowISO() });
  }

  const dragonMarkedCount = Object.values(character.skills).filter(s => s?.dragonMarked).length;

  function cycleSkillOverride(skillId: string) {
    const current = sessionState.skillOverrides[skillId];
    if (current === undefined) {
      setSkillOverride(skillId, 'boon');
    } else if (current === 'boon') {
      setSkillOverride(skillId, 'bane');
    } else {
      setSkillOverride(skillId, undefined);
    }
  }

  function buildConditionBaneMap(
    conditions: ConditionDefinition[],
    characterConditions: Record<string, boolean>,
  ): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const cond of conditions) {
      if (characterConditions[cond.id]) {
        map[cond.linkedAttributeId] = true;
      }
    }
    return map;
  }

  function buildAttrAbbrMap(attributes: AttributeDefinition[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (const attr of attributes) {
      map[attr.id] = attr.abbreviation;
    }
    return map;
  }

  const conditionBaneMap = system
    ? buildConditionBaneMap(system.conditions, character.conditions)
    : {};
  const attrAbbrMap = system ? buildAttrAbbrMap(system.attributes) : {};

  function getProbDisplay(skillId: string, value: number, linkedAttributeId?: string): string {
    const hasAutoBane = linkedAttributeId ? (conditionBaneMap[linkedAttributeId] ?? false) : false;
    const override = sessionState.skillOverrides[skillId];
    const effective = resolveEffectiveBoonBane(sessionState.globalBoonBane, override, hasAutoBane);
    const normalPct = formatProb(calcNormalProb(value));
    const isDragon = value === 1;

    if (effective === 'none') {
      return isDragon ? `${normalPct} (auto-success)` : normalPct;
    }
    if (effective === 'boon') {
      const boonPct = formatProb(calcBoonProb(value));
      return isDragon
        ? `${normalPct} (${boonPct} with boon, auto-success)`
        : `${normalPct} (${boonPct} with boon)`;
    }
    const banePct = formatProb(calcBaneProb(value));
    return isDragon
      ? `${normalPct} (${banePct} with bane, auto-success)`
      : `${normalPct} (${banePct} with bane)`;
  }

  function getOverrideLabel(skillId: string): string {
    const override = sessionState.skillOverrides[skillId];
    if (override === 'boon') return '★';
    if (override === 'bane') return '✕';
    return '○';
  }

  function getOverrideTitle(skillId: string): string {
    const override = sessionState.skillOverrides[skillId];
    if (override === 'boon') return 'Override: Boon — tap for Bane';
    if (override === 'bane') return 'Override: Bane — tap to clear';
    return 'No override — tap to set Boon';
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-md)',
        flexWrap: 'wrap',
        gap: 'var(--space-sm)',
      }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>Skills</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Chip label="Relevant" active={filter === 'relevant'} onClick={() => setFilter('relevant')} />
          <Chip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        </div>
      </div>

      {/* Dragon Mark Count Badge */}
      {dragonMarkedCount > 0 && (
        <div className="dragon-count-badge" aria-label={`${dragonMarkedCount} skills dragon marked`}>
          🐉 {dragonMarkedCount} marked
        </div>
      )}

      {/* Global Boon/Bane Selector */}
      <div className="boon-bane-selector" aria-label="Global boon/bane selector" role="group">
        {(['boon', 'none', 'bane'] as BoonBaneState[]).map(seg => (
          <button
            key={seg}
            className={[
              'boon-bane-segment',
              `boon-bane-segment--${seg}`,
              sessionState.globalBoonBane === seg ? 'boon-bane-segment--active' : '',
            ].join(' ').trim()}
            onClick={() => setGlobalBoonBane(seg)}
            aria-pressed={sessionState.globalBoonBane === seg}
          >
            {seg === 'none' ? 'Normal' : seg.charAt(0).toUpperCase() + seg.slice(1)}
          </button>
        ))}
      </div>

      {/* Skill list with boon/bane overlays */}
      {system ? (
        <div>
          {system.skillCategories.map(category => {
            const visibleSkills = filter === 'relevant'
              ? category.skills.filter(skill => {
                  const cs = character.skills[skill.id];
                  return cs ? (cs.value > 0 || cs.trained) : false;
                })
              : category.skills;

            if (visibleSkills.length === 0 && filter === 'relevant') return null;

            return (
              <div key={category.id} style={{ marginBottom: 'var(--space-md)' }}>
                <h2 style={{
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--color-text-muted)',
                  marginBottom: 'var(--space-sm)',
                  fontWeight: 600,
                }}>
                  {category.name}
                </h2>
                {visibleSkills.map(skill => {
                  const cs = character.skills[skill.id];
                  const attrValue = skill.linkedAttributeId ? (character.attributes[skill.linkedAttributeId] ?? 10) : 0;
                  const computedValue = skill.linkedAttributeId
                    ? computeSkillValue(attrValue, cs?.trained ?? false)
                    : (cs?.trained ? skill.baseChance * 2 : skill.baseChance);
                  const skillValue = cs?.value ?? computedValue;
                  const attrAbbr = skill.linkedAttributeId ? (attrAbbrMap[skill.linkedAttributeId] ?? '') : '';
                  const probDisplay = getProbDisplay(skill.id, skillValue, skill.linkedAttributeId);
                  const overrideLabel = getOverrideLabel(skill.id);
                  const overrideTitle = getOverrideTitle(skill.id);

                  const isDragonMarked = cs?.dragonMarked ?? false;
                  const isDemonMarked = cs?.demonMarked ?? false;

                  const isTrained = cs?.trained ?? false;

                  return (
                    <div key={skill.id} className={[isDragonMarked ? 'dragon-marked' : '', isDemonMarked ? 'demon-marked' : '', isTrained && !skillsEditable ? 'skill-trained' : ''].filter(Boolean).join(' ')} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      padding: 'var(--space-xs) 0',
                      borderBottom: '1px solid var(--color-border)',
                      minHeight: 'var(--touch-target-min)',
                    }}>
                      {skillsEditable ? (
                        <input
                          type="checkbox"
                          checked={isTrained}
                          onChange={e => {
                            const newTrained = e.target.checked;
                            const newValue = skill.linkedAttributeId
                              ? computeSkillValue(attrValue, newTrained)
                              : (newTrained ? Math.max(skill.baseChance * 2, 1) : skill.baseChance);
                            handleSkillChange(skill.id, { value: newValue, trained: newTrained });
                          }}
                          aria-label={`${skill.name} trained`}
                          style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0 }}
                        />
                      ) : (
                        <span style={{ width: '20px', height: '20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {isTrained && <GameIcon name="checked-shield" size={18} color="var(--color-accent)" />}
                        </span>
                      )}

                      {/* Name + attribute tag */}
                      <span style={{ flex: 1, color: 'var(--color-text)', fontSize: 'var(--font-size-md)', fontWeight: isTrained ? 600 : 'normal' }}>
                        {skill.name}
                        {attrAbbr && (
                          <span className="attribute-tag" aria-label={`Linked attribute: ${attrAbbr}`}>
                            {attrAbbr}
                          </span>
                        )}
                      </span>

                      {/* Probability display */}
                      <span className="probability-display">
                        {probDisplay}
                      </span>

                      {/* Value input */}
                      <input
                        type="number"
                        value={skillValue}
                        min={0}
                        max={20}
                        disabled={!skillsEditable}
                        onChange={e => handleSkillChange(skill.id, { value: Number(e.target.value), trained: cs?.trained ?? false })}
                        style={{
                          width: '52px',
                          height: '40px',
                          textAlign: 'center',
                          fontSize: 'var(--font-size-md)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          background: skillsEditable ? 'var(--color-surface-alt)' : 'var(--color-surface)',
                          color: 'var(--color-text)',
                          cursor: skillsEditable ? 'text' : 'default',
                          opacity: skillsEditable ? 1 : 0.7,
                        }}
                      />

                      {/* Per-skill boon/bane override */}
                      <button
                        className={`skill-override-btn skill-override-btn--${sessionState.skillOverrides[skill.id] ?? 'inherit'}`}
                        onClick={() => cycleSkillOverride(skill.id)}
                        title={overrideTitle}
                        aria-label={overrideTitle}
                      >
                        {overrideLabel}
                      </button>

                      {/* Skill mark cycle: unmarked -> dragon -> demon -> clear (play mode only) */}
                      {!skillsEditable && (
                        <button
                          className={`dragon-mark-toggle${isDragonMarked ? ' dragon-mark-toggle--active' : ''}${isDemonMarked ? ' dragon-mark-toggle--demon' : ''}`}
                          onClick={() => cycleSkillMark(skill.id)}
                          title={isDragonMarked ? 'Dragon marked — tap for demon mark' : isDemonMarked ? 'Demon marked — tap to clear' : 'Tap to dragon mark'}
                          aria-label={isDragonMarked ? `Dragon mark on ${skill.name}` : isDemonMarked ? `Demon mark on ${skill.name}` : `Mark ${skill.name}`}
                          style={{
                            background: isDragonMarked ? 'var(--color-accent)' : isDemonMarked ? '#c0392b' : 'var(--color-surface-raised)',
                            color: (isDragonMarked || isDemonMarked) ? '#fff' : 'var(--color-text-muted)',
                          }}
                        >
                          {isDragonMarked ? '🐉' : isDemonMarked ? '😈' : '○'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {visibleSkills.length === 0 && (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                    No trained skills in this category.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <SkillList
          categories={[]}
          characterSkills={character.skills}
          onSkillChange={handleSkillChange}
          disabled={!skillsEditable}
          filter={filter}
        />
      )}
    </div>
  );
}
