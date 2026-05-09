import { SectionPanel } from '../../components/primitives/SectionPanel';
import { computeDerivedValues } from '../../utils/derivedValues';
import type { PlayModuleProps } from './types';

export function DerivedStatsModule({ character }: PlayModuleProps) {
  const derived = computeDerivedValues(character);
  const stats = [
    { label: 'Move', value: derived.movement },
    { label: 'STR Dmg', value: derived.damageBonus },
    { label: 'AGL Dmg', value: derived.aglDamageBonus },
    { label: 'Carry', value: derived.encumbranceLimit },
  ];

  return (
    <SectionPanel title="Derived Stats" collapsible defaultOpen>
      <div className="grid gap-1.5">
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
