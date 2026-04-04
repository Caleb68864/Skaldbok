import { cn } from '../../lib/utils';
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
    <div className="flex items-center gap-[var(--space-sm)] py-[var(--space-xs)] border-b border-[var(--color-divider)] min-h-[var(--touch-target-min)]">
      <input
        type="checkbox"
        checked={trained}
        disabled={disabled}
        onChange={e => onChange({ value, trained: e.target.checked })}
        aria-label={`${skillDef.name} trained`}
        className={cn("w-5 h-5 shrink-0", disabled ? "cursor-default" : "cursor-pointer")}
      />
      <span className="flex-1 text-[var(--color-text)] text-[length:var(--font-size-md)]">
        {skillDef.name}
        {skillDef.baseChance > 0 && (
          <span className="text-[var(--color-text-muted)] text-[length:var(--font-size-sm)] ml-[var(--space-xs)]">
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
        className={cn(
          "w-16 h-10 text-center text-[length:var(--font-size-md)] border border-[var(--color-border)] rounded-[var(--radius-sm)] text-[var(--color-text)]",
          disabled
            ? "bg-[var(--color-surface)] cursor-default opacity-70"
            : "bg-[var(--color-surface-alt)] cursor-text opacity-100"
        )}
      />
    </div>
  );
}
