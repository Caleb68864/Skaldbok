import type { ConditionDefinition } from '../../types/system';
import { Chip } from '../primitives/Chip';

/** Props for {@link ConditionToggleGroup}: the on/off map plus the system's condition definitions to render. */
export interface ConditionToggleGroupProps {
  conditions: Record<string, boolean>;
  definitions: ConditionDefinition[];
  onChange: (id: string, value: boolean) => void;
  disabled?: boolean;
}

/** Wrapping row of {@link Chip} toggles, one per system-defined condition. */
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
