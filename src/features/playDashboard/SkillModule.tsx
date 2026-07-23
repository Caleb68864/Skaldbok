import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { computeSkillValue } from '../../utils/derivedValues';
import { calcBaneProb, calcBoonProb, calcNormalProb, formatProb } from '../../utils/boonBane';
import { cn } from '../../lib/utils';
import type { CharacterSkill } from '../../types/character';
import { clamp, type PlayModuleProps } from './types';
import { getEngine } from '../systems/engine';

function probability(value: number): string {
  return `${formatProb(calcNormalProb(value))} / boon ${formatProb(calcBoonProb(value))} / bane ${formatProb(calcBaneProb(value))}`;
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
  const isTraveller = system.id === 'traveller';

  const skillDefs: SkillRow[] = system.skillCategories.flatMap(category =>
    category.skills.map(skill => ({ ...skill, category: category.name })),
  );
  const pinned = character.uiState.pinnedSkills ?? [];
  const isPrimary = (id: string) =>
    pinned.includes(id) ||
    character.skills[id]?.trained ||
    character.skills[id]?.dragonMarked ||
    character.skills[id]?.demonMarked;

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
    const attrValue = skill.linkedAttributeId ? (character.attributes[skill.linkedAttributeId] ?? 10) : 0;
    const rawValue =
      stored?.value ??
      (isTraveller || !skill.linkedAttributeId ? skill.baseChance : computeSkillValue(attrValue, stored?.trained ?? false));
    const value = clamp(rawValue, engine.skill.range.min, engine.skill.range.max);
    const fallback = { value, trained: stored?.trained ?? false };
    const mark = stored?.dragonMarked ? 'Dragon' : stored?.demonMarked ? 'Demon' : 'Mark';
    const displayValue = engine.skill.display(value, {
      character,
      linkedAttributeId: skill.linkedAttributeId,
    });
    return (
      <div key={skill.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)] min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="m-0 font-semibold text-[var(--color-text)]">{skill.name}</p>
            {!isTraveller && (
              <span className="text-[length:var(--font-size-lg)] font-bold text-[var(--color-accent)] leading-none">{displayValue}</span>
            )}
          </div>
          <p className="m-0 text-xs text-[var(--color-text-muted)]">{isTraveller ? displayValue : probability(value)}</p>
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
