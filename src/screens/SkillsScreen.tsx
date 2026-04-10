import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
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

/**
 * The Skills screen — lists all skills for the active character with roll-under
 * probability display and boon/bane modifiers.
 *
 * @remarks
 * Skills are grouped by category as defined by the active game-system definition.
 * The screen provides the following interactive controls:
 *
 * - **Filter chips** — toggle between "Relevant" (trained / non-zero) and "All" skills.
 * - **Global Boon/Bane selector** — sets a campaign-wide modifier applied to
 *   every skill's probability calculation.
 * - **Per-skill boon/bane override** — cycles through inherit → boon → bane → inherit
 *   for individual skills, taking precedence over the global setting.
 * - **Trained checkbox / trained indicator** — editable in Edit Mode; shows a
 *   shield icon in Play Mode.
 * - **Skill value input** — numeric roll-under target, editable in Edit Mode.
 * - **Dragon / Demon mark toggle** — cycles unmarked → dragon-marked → demon-marked →
 *   unmarked in Play Mode to track session advancement (Dragonbane rules).
 *
 * Probability strings are computed from {@link calcNormalProb}, {@link calcBoonProb},
 * and {@link calcBaneProb}, resolved through {@link resolveEffectiveBoonBane}.
 *
 * Conditions with a `linkedAttributeId` automatically impose a bane on skills
 * that share that attribute (reflected in the probability display).
 *
 * Navigates to `/library` if no character is loaded.
 *
 * @returns The skills list UI, or a loading indicator, or `null` while redirecting.
 */
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

  if (isLoading) return <div className="p-[var(--space-md)] text-[var(--color-text)]">Loading...</div>;
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
    <div className="p-[var(--space-md)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-[var(--space-md)] flex-wrap gap-[var(--space-sm)]">
        <h1 className="text-[length:var(--font-size-xl)] text-[var(--color-text)]">Skills</h1>
        <div className="flex gap-2">
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
      <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]" aria-label="Global boon/bane selector" role="group">
        {(['boon', 'none', 'bane'] as BoonBaneState[]).map(seg => (
          <button
            key={seg}
            className={`flex-1 px-4 py-2 min-h-[44px] text-sm font-semibold border-none cursor-pointer transition-colors ${
              sessionState.globalBoonBane === seg
                ? seg === 'boon'
                  ? 'bg-emerald-600 text-white'
                  : seg === 'bane'
                    ? 'bg-red-600 text-white'
                    : 'bg-[var(--color-accent)] text-[var(--color-on-accent,#fff)]'
                : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
            }`}
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
              <div key={category.id} className="mb-[var(--space-md)]">
                <h2 className="text-[length:var(--font-size-md)] text-[var(--color-text-muted)] mb-[var(--space-sm)] font-semibold">
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
                    <div key={skill.id} className={cn(
                      "flex items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-border)] min-h-[var(--touch-target-min)]",
                      isDragonMarked && 'bg-amber-900/20 border-l-2 !border-l-amber-500',
                      isDemonMarked && 'bg-purple-900/20 border-l-2 !border-l-purple-500',
                      isTrained && !skillsEditable && 'bg-[var(--color-surface-raised)]/30',
                    )}>
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
                          className="w-5 h-5 cursor-pointer shrink-0"
                        />
                      ) : (
                        <span className="w-5 h-5 shrink-0 flex items-center justify-center">
                          {isTrained && <GameIcon name="checked-shield" size={18} color="var(--color-accent)" />}
                        </span>
                      )}

                      {/* Name + attribute tag */}
                      <span className={cn(
                        "flex-1 text-[var(--color-text)] text-[length:var(--font-size-md)]",
                        isTrained ? "font-semibold" : "font-normal"
                      )}>
                        {skill.name}
                        {attrAbbr && (
                          <span className="ml-1.5 text-xs font-normal text-[var(--color-text-muted)] opacity-70" aria-label={`Linked attribute: ${attrAbbr}`}>
                            {attrAbbr}
                          </span>
                        )}
                      </span>

                      {/* Probability display */}
                      <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
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
                        className={cn(
                          "w-[52px] h-10 text-center text-[length:var(--font-size-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)]",
                          skillsEditable
                            ? "bg-[var(--color-surface-alt)] cursor-text opacity-100"
                            : "bg-[var(--color-surface)] cursor-default opacity-70"
                        )}
                      />

                      {/* Per-skill boon/bane override */}
                      <button
                        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded border-none cursor-pointer text-sm font-bold ${
                          (sessionState.skillOverrides[skill.id] ?? 'inherit') === 'boon'
                            ? 'bg-emerald-600/20 text-emerald-400'
                            : (sessionState.skillOverrides[skill.id] ?? 'inherit') === 'bane'
                              ? 'bg-red-600/20 text-red-400'
                              : 'bg-transparent text-[var(--color-text-muted)] opacity-40'
                        }`}
                        onClick={() => cycleSkillOverride(skill.id)}
                        title={overrideTitle}
                        aria-label={overrideTitle}
                      >
                        {overrideLabel}
                      </button>

                      {/* Skill mark cycle: unmarked -> dragon -> demon -> clear (play mode only) */}
                      {!skillsEditable && (
                        <button
                          className={cn(
                            'dragon-mark-toggle',
                            isDragonMarked && 'dragon-mark-toggle--active',
                            isDemonMarked && 'dragon-mark-toggle--demon',
                            isDragonMarked ? 'bg-[var(--color-accent)] text-white' : isDemonMarked ? 'bg-[#c0392b] text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]',
                          )}
                          onClick={() => cycleSkillMark(skill.id)}
                          title={isDragonMarked ? 'Dragon marked — tap for demon mark' : isDemonMarked ? 'Demon marked — tap to clear' : 'Tap to dragon mark'}
                          aria-label={isDragonMarked ? `Dragon mark on ${skill.name}` : isDemonMarked ? `Demon mark on ${skill.name}` : `Mark ${skill.name}`}
                        >
                          {isDragonMarked ? '🐉' : isDemonMarked ? '😈' : '○'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {visibleSkills.length === 0 && (
                  <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] italic">
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
