import type { SkillCategory } from '../../types/system';
import type { CharacterSkill } from '../../types/character';
import { SectionPanel } from '../primitives/SectionPanel';
import { SkillRow } from './SkillRow';

interface SkillListProps {
  categories: SkillCategory[];
  characterSkills: Record<string, CharacterSkill>;
  onSkillChange: (skillId: string, value: CharacterSkill) => void;
  disabled: boolean;
  filter: 'all' | 'relevant';
}

export function SkillList({ categories, characterSkills, onSkillChange, disabled, filter }: SkillListProps) {
  return (
    <div>
      {categories.map(category => {
        const visibleSkills = filter === 'relevant'
          ? category.skills.filter(skill => {
              const cs = characterSkills[skill.id];
              return cs ? (cs.value > 0 || cs.trained) : false;
            })
          : category.skills;

        if (visibleSkills.length === 0 && filter === 'relevant') {
          return null;
        }

        return (
          <SectionPanel key={category.id} title={category.name} collapsible defaultOpen>
            {visibleSkills.map(skill => (
              <SkillRow
                key={skill.id}
                skillDef={skill}
                characterSkill={characterSkills[skill.id]}
                onChange={value => onSkillChange(skill.id, value)}
                disabled={disabled}
              />
            ))}
            {visibleSkills.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', fontStyle: 'italic' }}>
                No trained skills in this category.
              </p>
            )}
          </SectionPanel>
        );
      })}
    </div>
  );
}
