import type { SkillDefinition } from '../../types/system';
import type { CharacterSkill } from '../../types/character';

interface SkillRowProps {
  skillDef: SkillDefinition;
  characterSkill: CharacterSkill | undefined;
  onChange: (value: CharacterSkill) => void;
  disabled: boolean;
}

export function SkillRow({ skillDef, characterSkill, onChange, disabled }: SkillRowProps) {
  const value = characterSkill?.value ?? skillDef.baseChance;
  const trained = characterSkill?.trained ?? false;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-sm)',
      padding: 'var(--space-xs) 0',
      borderBottom: '1px solid var(--color-divider)',
      minHeight: 'var(--touch-target-min)',
    }}>
      <input
        type="checkbox"
        checked={trained}
        disabled={disabled}
        onChange={e => onChange({ value, trained: e.target.checked })}
        aria-label={`${skillDef.name} trained`}
        style={{ width: '20px', height: '20px', cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}
      />
      <span style={{ flex: 1, color: 'var(--color-text)', fontSize: 'var(--font-size-md)' }}>
        {skillDef.name}
        {skillDef.baseChance > 0 && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginLeft: 'var(--space-xs)' }}>
            ({skillDef.baseChance}%)
          </span>
        )}
      </span>
      <input
        type="number"
        value={value}
        min={0}
        max={100}
        disabled={disabled}
        onChange={e => onChange({ value: Number(e.target.value), trained })}
        style={{
          width: '64px',
          height: '40px',
          textAlign: 'center',
          fontSize: 'var(--font-size-md)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          background: disabled ? 'var(--color-surface)' : 'var(--color-surface-alt)',
          color: 'var(--color-text)',
          cursor: disabled ? 'default' : 'text',
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  );
}
