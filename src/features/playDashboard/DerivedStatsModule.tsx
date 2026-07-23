import { SectionPanel } from '../../components/primitives/SectionPanel';
import { getEngine } from '../systems/engine';
import { formatDM, type TravellerDerivedValues } from '../systems/engine/travellerEngine';
import type { PlayModuleProps } from './types';

const CHARACTERISTIC_LABELS: Record<string, string> = {
  str: 'STR',
  dex: 'DEX',
  end: 'END',
  int: 'INT',
  edu: 'EDU',
  soc: 'SOC',
};

export function DerivedStatsModule({ character, system }: PlayModuleProps) {
  const engine = getEngine(system);
  const derived = engine.derivedStats(character, system ?? undefined);

  const stats =
    system?.id === 'traveller'
      ? Object.entries((derived as TravellerDerivedValues).characteristicDMs).map(([id, dm]) => ({
          label: CHARACTERISTIC_LABELS[id] ?? id.toUpperCase(),
          value: formatDM(dm),
        }))
      : [
          { label: 'Move', value: derived.movement },
          { label: 'STR Dmg', value: derived.damageBonus },
          { label: 'AGL Dmg', value: derived.aglDamageBonus },
          { label: 'Carry', value: derived.encumbranceLimit },
        ];

  return (
    <SectionPanel title="Derived Stats" collapsible defaultOpen>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,7rem),1fr))]">
        {stats.map(stat => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-xs)] py-1"
          >
            <p className="m-0 text-xs font-semibold text-[var(--color-text-muted)]">{stat.label}</p>
            <p className="m-0 text-[length:var(--font-size-lg)] font-bold leading-tight text-[var(--color-accent)]">{stat.value}</p>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}
