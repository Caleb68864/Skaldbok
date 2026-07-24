import { SectionPanel } from '../../components/primitives/SectionPanel';
import { ResourceTracker } from '../../components/fields/ResourceTracker';
import { nowISO } from '../../utils/dates';
import { clamp, type PlayModuleProps } from './types';
import { useSessionLog } from '../session/useSessionLog';
import { getEngine } from '../systems/engine';

/**
 * The Vitals panel.
 *
 * @remarks
 * For a pool-based system (Dragonbane HP/WP) the resources are directly editable
 * with +/− steppers. For a system with a cascading damage track (Traveller) the
 * tracks are shown read-only here — all damage and healing goes through the
 * dedicated Take Damage & Heal panel, which keeps Vitals compact and avoids two
 * competing ways to change the same number.
 */
export function ResourceModule({ character, system, updateCharacter }: PlayModuleProps) {
  const { logHPChange } = useSessionLog();
  const engine = getEngine(system);

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

  // Damage-track systems: read-only readout; the Take Damage & Heal panel owns edits.
  if (engine.damageTrack) {
    return (
      <SectionPanel title="Vitals" collapsible defaultOpen>
        <div className="flex flex-col gap-[var(--space-xs)]">
          {engine.resourceIds.map(id => {
            const resource = character.resources[id];
            if (!resource) return null;
            const def = system?.resources.find(r => r.id === id);
            const wounded = resource.current > 0;
            return (
              <div
                key={id}
                className="flex items-center justify-between border-b border-[var(--color-border)] pb-[var(--space-xs)] last:border-b-0 last:pb-0"
              >
                <span className="text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                  {def?.name ?? id.toUpperCase()}
                </span>
                <span className={wounded ? 'font-bold text-[var(--color-danger)]' : 'font-bold text-[var(--color-text)]'}>
                  {resource.current}
                  <span className="text-[var(--color-text-muted)]"> / {resource.max}</span>
                </span>
              </div>
            );
          })}
        </div>
      </SectionPanel>
    );
  }

  // Pool-based systems: directly editable steppers.
  return (
    <SectionPanel title="Vitals" collapsible defaultOpen>
      <div className="flex flex-col gap-[var(--space-sm)] 2xl:grid 2xl:grid-cols-2">
        {engine.resourceIds.map(id => {
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
