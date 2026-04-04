import { cn } from '../../lib/utils';
import type { ConditionDefinition } from '../../types/system';

interface QuickConditionPanelProps {
  conditions: Record<string, boolean>;
  definitions: ConditionDefinition[];
  attributes: { id: string; abbreviation: string }[];
  onChange: (id: string, value: boolean) => void;
}

export function QuickConditionPanel({ conditions, definitions, attributes, onChange }: QuickConditionPanelProps) {
  function getAbbreviation(linkedAttributeId: string): string {
    const attr = attributes.find(a => a.id === linkedAttributeId);
    return attr ? attr.abbreviation : '';
  }

  return (
    <div className="grid grid-cols-3 gap-[var(--space-sm)]">
      {definitions.map(def => {
        const active = !!conditions[def.id];
        const abbr = getAbbreviation(def.linkedAttributeId);

        return (
          <button
            key={def.id}
            type="button"
            onClick={() => onChange(def.id, !active)}
            className={cn(
              "min-h-16 min-w-16 flex flex-col items-center justify-center gap-0.5 rounded-[var(--radius-md)] cursor-pointer font-[family-name:inherit] p-[var(--space-xs)]",
              active
                ? "border-2 border-[var(--color-danger)] bg-[var(--color-danger)] text-[var(--color-text-inverse)]"
                : "border-2 border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]"
            )}
          >
            <span className={cn(
              "text-[length:var(--font-size-md)] leading-[1.2]",
              active ? "font-bold" : "font-normal"
            )}>
              {def.name}
            </span>
            {abbr && (
              <span className="text-[length:var(--font-size-sm)] opacity-70">
                {abbr}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
