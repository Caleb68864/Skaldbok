import { SectionPanel } from '../../components/primitives/SectionPanel';
import { ConditionToggleGroup } from '../../components/fields/ConditionToggleGroup';
import { nowISO } from '../../utils/dates';
import type { PlayModuleProps } from './types';

export function ConditionModule({ character, system, updateCharacter }: PlayModuleProps) {
  if (!system) return null;

  return (
    <SectionPanel title="Conditions" collapsible defaultOpen>
      <ConditionToggleGroup
        definitions={system.conditions}
        conditions={character.conditions}
        onChange={(id, value) => {
          updateCharacter(prev => ({
            conditions: { ...prev.conditions, [id]: value },
            updatedAt: nowISO(),
          }));
        }}
      />
    </SectionPanel>
  );
}
