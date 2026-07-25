import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { formatProb } from '../../utils/boonBane';
import { conditionImposesBane } from '../../utils/conditionEffects';
import { cn } from '../../lib/utils';
import type { CharacterSkill } from '../../types/character';
import { clamp, type PlayModuleProps } from './types';
import { getEngine, type SystemEngine, type SkillDisplayContext } from '../systems/engine';

/** Normal / boon / bane odds line, with the maths owned by the active engine. */
function probability(engine: SystemEngine, value: number, context?: SkillDisplayContext): string {
  const chance = (state: 'boon' | 'none' | 'bane') => formatProb(engine.probability.chance(value, state, context));
  return `${chance('none')} / boon ${chance('boon')} / bane ${chance('bane')}`;
}

type SkillRow = {
  id: string;
  name: string;
  category: string;
  linkedAttributeId?: string;
  baseChance: number;
};

export function SkillModule({ character, system, updateCharacter }: PlayModuleProps) {
  const [showUntrained, setShowUntrained] = useState(false);
  if (!system) return null;

  const engine = getEngine(system);
  // Roll-under systems render a bare target number plus a boon/bane odds line;
  // other resolutions let the engine format the whole thing into one string.
  const rollsUnder = engine.resolution === 'd20-roll-under';

  const skillDefs: SkillRow[] = system.skillCategories.flatMap(category =>
    category.skills.map(skill => ({ ...skill, category: category.name })),
  );
  const pinned = character.uiState.pinnedSkills ?? [];
  // Relevance is the engine's call (trained/marked/etc.); the dashboard just adds
  // the user's pinned skills. Was a reimplementation of the trained/dragon/demon
  // check that SkillsScreen already delegates to the engine. E6.
  const isPrimary = (id: string) =>
    pinned.includes(id) || engine.skill.isRelevant(character.skills[id]);

  const primary = skillDefs.filter(skill => isPrimary(skill.id));
  const untrained = skillDefs.filter(skill => !isPrimary(skill.id));

  function cycleMark(skillId: string, fallback: CharacterSkill) {
    const current = character.skills[skillId] ?? fallback;
    const next: CharacterSkill = !current.dragonMarked && !current.demonMarked
      ? { ...current, dragonMarked: true, demonMarked: false }
      : current.dragonMarked
        ? { ...current, dragonMarked: false, demonMarked: true }
        : { ...current, dragonMarked: false, demonMarked: false };
    updateCharacter(prev => ({ skills: { ...prev.skills, [skillId]: next }, updatedAt: nowISO() }));
  }

  function renderSkillRow(skill: SkillRow) {
    const stored = character.skills[skill.id];
    const trained = stored?.trained ?? false;
    // The engine owns the value a skill takes when the character has no stored entry.
    const computedValue = engine.skill.computeValue(skill, character, trained);
    const rawValue = stored?.value ?? computedValue;
    const value = clamp(rawValue, engine.skill.range.min, engine.skill.range.max);
    const fallback = { value, trained };
    const mark = stored?.dragonMarked ? 'Dragon' : stored?.demonMarked ? 'Demon' : 'Mark';
    // Fold in condition-imposed bane so the dashboard's odds match the Sheet's
    // (previously the Play line ignored an active condition's bane). E6.
    const autoBane = conditionImposesBane(system, character, skill.linkedAttributeId);
    const displayContext = {
      character,
      linkedAttributeId: skill.linkedAttributeId,
      boonBane: (autoBane ? 'bane' : 'none') as 'boon' | 'none' | 'bane',
    };
    const displayValue = engine.skill.display(value, displayContext);
    return (
      <div key={skill.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)] min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="m-0 font-semibold text-[var(--color-text)]">{skill.name}</p>
            {rollsUnder && (
              <span className="text-[length:var(--font-size-lg)] font-bold text-[var(--color-accent)] leading-none">{displayValue}</span>
            )}
          </div>
          <p className="m-0 text-xs text-[var(--color-text-muted)]">{rollsUnder ? probability(engine, value, displayContext) : displayValue}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap min-[520px]:shrink-0">
          {engine.skill.supportsMarks && (
            <Button size="sm" variant="secondary" onClick={() => cycleMark(skill.id, fallback)}>{mark}</Button>
          )}
        </div>
      </div>
    );
  }

  if (primary.length === 0 && untrained.length === 0) return null;

  return (
    <SectionPanel title="Skills" collapsible defaultOpen>
      {primary.length > 0 && (
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
          {primary.map(renderSkillRow)}
        </div>
      )}
      {untrained.length > 0 && (
        <div className={cn('mt-[var(--space-sm)]', primary.length === 0 && 'mt-0')}>
          <button
            type="button"
            onClick={() => setShowUntrained(o => !o)}
            aria-expanded={showUntrained}
            className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-[var(--space-sm)] py-[var(--space-xs)] text-[length:var(--font-size-sm)] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text)] min-h-[var(--touch-target-min)]"
          >
            <span>Other skills ({untrained.length})</span>
            {showUntrained ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showUntrained && (
            <div className="mt-[var(--space-sm)] grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,15rem),1fr))]">
              {untrained.map(renderSkillRow)}
            </div>
          )}
        </div>
      )}
    </SectionPanel>
  );
}
