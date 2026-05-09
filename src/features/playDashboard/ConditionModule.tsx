import { SectionPanel } from '../../components/primitives/SectionPanel';
import { nowISO } from '../../utils/dates';
import { cn } from '../../lib/utils';
import type { PlayModuleProps } from './types';

export function ConditionModule({ character, system, updateCharacter }: PlayModuleProps) {
  if (!system) return null;

  return (
    <SectionPanel title="Conditions" collapsible defaultOpen>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(6rem,1fr))]">
        {system.conditions.map(condition => {
          const active = !!character.conditions[condition.id];
          return (
            <button
              key={condition.id}
              type="button"
              className={cn(
                'min-h-[44px] w-full rounded-[var(--radius-lg)] border border-border px-1 py-1 text-sm transition-colors whitespace-nowrap',
                active
                  ? 'bg-accent text-bg font-bold'
                  : 'bg-surface-alt text-text font-normal'
              )}
              onClick={() => {
                updateCharacter(prev => ({
                  conditions: { ...prev.conditions, [condition.id]: !active },
                  updatedAt: nowISO(),
                }));
              }}
            >
              {condition.name}
            </button>
          );
        })}
      </div>
    </SectionPanel>
  );
}
