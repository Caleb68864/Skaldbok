import type { ConditionDefinition } from '../../types/system';
import { Chip } from '../primitives/Chip';

interface ConditionToggleGroupProps {
  conditions: Record<string, boolean>;
  definitions: ConditionDefinition[];
  onChange: (id: string, value: boolean) => void;
  disabled?: boolean;
}

export function ConditionToggleGroup({ conditions, definitions, onChange, disabled = false }: ConditionToggleGroupProps) {
  return (
    <div className="flex flex-wrap gap-[var(--space-sm)]">
      {definitions.map(def => (
        <Chip
          key={def.id}
          label={def.name}
          active={!!conditions[def.id]}
          onClick={() => onChange(def.id, !conditions[def.id])}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
