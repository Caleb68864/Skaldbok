import { SectionPanel } from '../../components/primitives/SectionPanel';
import { Button } from '../../components/primitives/Button';
import { nowISO } from '../../utils/dates';
import { computeSkillValue } from '../../utils/derivedValues';
import { calcBaneProb, calcBoonProb, calcNormalProb, formatProb } from '../../utils/boonBane';
import type { CharacterSkill } from '../../types/character';
import type { PlayModuleProps } from './types';

function probability(value: number): string {
  return `${formatProb(calcNormalProb(value))} / boon ${formatProb(calcBoonProb(value))} / bane ${formatProb(calcBaneProb(value))}`;
}

export function SkillModule({ character, system, updateCharacter }: PlayModuleProps) {
  if (!system) return null;

  const skillDefs = system.skillCategories.flatMap(category => category.skills.map(skill => ({ ...skill, category: category.name })));
  const pinned = character.uiState.pinnedSkills ?? [];
  const visible = skillDefs
    .filter(skill => pinned.includes(skill.id) || character.skills[skill.id]?.trained || character.skills[skill.id]?.dragonMarked || character.skills[skill.id]?.demonMarked)
    .slice(0, 10);

  if (visible.length === 0) return null;

  function cycleMark(skillId: string, fallback: CharacterSkill) {
    const current = character.skills[skillId] ?? fallback;
    const next: CharacterSkill = !current.dragonMarked && !current.demonMarked
      ? { ...current, dragonMarked: true, demonMarked: false }
      : current.dragonMarked
        ? { ...current, dragonMarked: false, demonMarked: true }
        : { ...current, dragonMarked: false, demonMarked: false };
    updateCharacter(prev => ({ skills: { ...prev.skills, [skillId]: next }, updatedAt: nowISO() }));
  }

  return (
    <SectionPanel title="Skills" collapsible defaultOpen>
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map(skill => {
          const stored = character.skills[skill.id];
          const attrValue = skill.linkedAttributeId ? (character.attributes[skill.linkedAttributeId] ?? 10) : 0;
          const value = stored?.value ?? (skill.linkedAttributeId ? computeSkillValue(attrValue, stored?.trained ?? false) : skill.baseChance);
          const fallback = { value, trained: stored?.trained ?? false };
          const mark = stored?.dragonMarked ? 'Dragon' : stored?.demonMarked ? 'Demon' : 'Mark';
          return (
            <div key={skill.id} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="m-0 font-semibold text-[var(--color-text)]">{skill.name}</p>
                  <span className="text-[length:var(--font-size-lg)] font-bold text-[var(--color-accent)] leading-none">{value}</span>
                </div>
                <p className="m-0 text-xs text-[var(--color-text-muted)]">{probability(value)}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="secondary" onClick={() => cycleMark(skill.id, fallback)}>{mark}</Button>
              </div>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
