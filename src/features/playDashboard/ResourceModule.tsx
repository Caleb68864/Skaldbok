import { SectionPanel } from '../../components/primitives/SectionPanel';
import { ResourceTracker } from '../../components/fields/ResourceTracker';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';

export function ResourceModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { logHPChange } = useSessionLog();

  function updateResourceCurrent(id: string, delta: number) {
    const old = character.resources[id]?.current ?? 0;
    const max = character.resources[id]?.max ?? 0;
    const next = clamp(old + delta, 0, max);
    updateCharacter(prev => ({
      resources: { ...prev.resources, [id]: { ...prev.resources[id], current: next } },
      updatedAt: nowISO(),
    }));
    if ((id === 'hp' || id === 'wp') && old !== next) {
      logHPChange(character.name, old, next, max, id);
    }
  }

  return (
    <SectionPanel title="Vitals" collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-sm)] h-full justify-around 2xl:grid 2xl:grid-cols-2">
        {['hp', 'wp'].map(id => {
          const resource = character.resources[id];
          if (!resource) return null;
          const def = system?.resources.find(r => r.id === id);
          return (
            <ResourceTracker
              key={id}
              resourceId={id}
              label={def?.name ?? id.toUpperCase()}
              current={resource.current}
              max={resource.max}
              onCurrentChange={delta => updateResourceCurrent(id, delta)}
              maxEditable={false}
            />
          );
        })}
      </div>
    </SectionPanel>
  );
}
