import { SectionPanel } from '../../components/primitives/SectionPanel';
import { getEngine } from '../systems/engine';
import type { PlayModuleProps } from './types';

type StatEntry = { label: string; value: string | number };

/**
 * Formats a dice modifier as a signed string, e.g. 2 -> '+2', -1 -> '-1'.
 */
function formatModifier(dm: number): string {
  return dm >= 0 ? `+${dm}` : `${dm}`;
}

export function DerivedStatsModule({ character, system }: PlayModuleProps) {
  const engine = getEngine(system);
  const derived = engine.derivedStats(character, system ?? undefined);

  // Structural check rather than a system-id branch: engines whose resolution
  // is modifier-based return a per-attribute modifier map alongside the shared
  // derived values, and we render that grid instead of the flat stat list.
  const attributeModifiers =
    'characteristicDMs' in derived
      ? (derived as { characteristicDMs?: Record<string, number> }).characteristicDMs
      : undefined;

  // The flat list is driven by the engine's declared derived fields; the dense
  // dashboard tile prefers the short label when the engine supplies one.
  const derivedValues = derived as unknown as Record<string, string | number | undefined>;

  // The two lists are additive, not either/or. Rendering only the modifier grid
  // silently dropped every declared field a modifier-based system had —
  // Traveller's Initiative DM and Carry Limit never reached the dashboard.
  const modifierStats: StatEntry[] = attributeModifiers
    ? Object.entries(attributeModifiers).map(([id, dm]) => ({
        label: system?.attributes.find(attr => attr.id === id)?.abbreviation ?? id.toUpperCase(),
        value: formatModifier(dm),
      }))
    : [];

  const fieldStats: StatEntry[] = engine.derivedFields
    .filter(field => !field.surfaces || field.surfaces.includes('dashboard'))
    // A field the engine declares but does not compute would render as a blank
    // tile; skip it rather than show an empty box.
    .filter(field => derivedValues[field.key] !== undefined)
    .map(field => {
      // Honour a manual override (e.g. a hand-tuned Carry limit set on the Gear
      // screen) so the dashboard tile matches the sheet rather than showing the
      // raw computed value. A cleared override is null → falls back to computed.
      const override = field.overridable ? character.derivedOverrides?.[field.key] : undefined;
      return {
        label: field.shortLabel ?? field.label,
        value: override ?? derivedValues[field.key] ?? '—',
      };
    });

  const stats: StatEntry[] = [...modifierStats, ...fieldStats];

  return (
    <SectionPanel title={engine.labels.derivedPanel ?? 'Derived Stats'} collapsible defaultOpen>
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
