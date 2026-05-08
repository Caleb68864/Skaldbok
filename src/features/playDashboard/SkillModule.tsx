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
    <SectionPanel title="Fast Skills" collapsible defaultOpen>
      {visible.length === 0 && <p className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">Train or pin skills to show them here.</p>}
      <div className="flex flex-col gap-2">
        {visible.map(skill => {
          const stored = character.skills[skill.id];
          const attrValue = skill.linkedAttributeId ? (character.attributes[skill.linkedAttributeId] ?? 10) : 0;
          const value = stored?.value ?? (skill.linkedAttributeId ? computeSkillValue(attrValue, stored?.trained ?? false) : skill.baseChance);
          const fallback = { value, trained: stored?.trained ?? false };
          const mark = stored?.dragonMarked ? 'Dragon' : stored?.demonMarked ? 'Demon' : 'Mark';
          return (
            <div key={skill.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-[var(--color-border)] py-2">
              <div className="min-w-0">
                <p className="m-0 font-semibold text-[var(--color-text)]">{skill.name} <span className="text-[var(--color-text-muted)] text-xs">{value}</span></p>
                <p className="m-0 text-xs text-[var(--color-text-muted)]">{probability(value)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => cycleMark(skill.id, fallback)}>{mark}</Button>
              <span className="text-sm font-bold text-[var(--color-text)] min-w-8 text-center">d20</span>
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
