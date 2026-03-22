import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveCharacter } from '../context/ActiveCharacterContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { useFieldEditable } from '../utils/modeGuards';
import { SkillList } from '../components/fields/SkillList';
import { Chip } from '../components/primitives/Chip';
import type { CharacterSkill } from '../types/character';
import { nowISO } from '../utils/dates';

export default function SkillsScreen() {
  const navigate = useNavigate();
  const { character, updateCharacter, isLoading } = useActiveCharacter();
  const { system } = useSystemDefinition(character?.systemId ?? 'dragonbane');
  const skillsEditable = useFieldEditable('skills.any');
  const [filter, setFilter] = useState<'all' | 'relevant'>('relevant');

  if (isLoading) return <div style={{ padding: 'var(--space-md)', color: 'var(--color-text)' }}>Loading...</div>;
  if (!character) {
    navigate('/library');
    return null;
  }

  function handleSkillChange(skillId: string, value: CharacterSkill) {
    if (!character) return;
    updateCharacter({ skills: { ...character.skills, [skillId]: value }, updatedAt: nowISO() });
  }

  return (
    <div style={{ padding: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', color: 'var(--color-text)' }}>Skills</h1>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Chip label="Relevant" active={filter === 'relevant'} onClick={() => setFilter('relevant')} />
          <Chip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        </div>
      </div>

      {system && (
        <SkillList
          categories={system.skillCategories}
          characterSkills={character.skills}
          onSkillChange={handleSkillChange}
          disabled={!skillsEditable}
          filter={filter}
        />
      )}
    </div>
  );
}
