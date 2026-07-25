import { SectionPanel } from '../../../../components/primitives/SectionPanel';
import { resolveDataPath } from './TileCard';
import type { PlayModuleProps } from '../../../playDashboard/types';

/** Visual weight of an active {@link ToggleGridCard} item; purely presentational. */
export type ToggleItemIntent = 'default' | 'accent' | 'warning' | 'danger' | 'success';

/** One item of a {@link ToggleGridCard}: a label paired with a resolved or literal on/off state. */
export interface ToggleGridItem {
  label: string;
  active?: boolean;
  source?: string;
  intent?: ToggleItemIntent;
}

/**
 * Declarative props for a grid of read-only toggle indicators.
 *
 * @remarks
 * Each item's `active` is a literal boolean; `source` is a whitelisted data
 * path resolved via {@link resolveDataPath} and coerced to a boolean. When
 * both are given `active` wins. No function props — templates are JSON, so
 * nothing here can be a callback.
 */
export interface ToggleGridCardProps extends PlayModuleProps {
  title: string;
  items: ToggleGridItem[];
}

const INTENT_ACTIVE_CLASS: Record<ToggleItemIntent, string> = {
  default: 'border-[var(--color-text)] bg-[var(--color-text)]/10 text-[var(--color-text)]',
  accent: 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  danger: 'border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  success: 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]',
};

/** Generic read-only toggle grid: a title and a list of resolved or literal on/off indicators. */
export function ToggleGridCard({ title, items, character, system }: ToggleGridCardProps) {
  // `items` is untrusted JSON typed as `unknown` — coerce to a safe array so a
  // template that omits it (or supplies a non-array) renders empty, not a throw.
  const safeItems = Array.isArray(items) ? items : [];
  return (
    <SectionPanel title={title}>
      <div className="grid grid-cols-2 gap-[var(--space-xs)] sm:grid-cols-3">
        {safeItems.map((item, index) => {
          const resolved = item.active !== undefined
            ? item.active
            : item.source
              ? Boolean(resolveDataPath(item.source, character, system))
              : false;
          // Fall back to the neutral intent for an unrecognized value so an
          // authoring typo can't emit a literal `undefined` className fragment.
          const intent = (item.intent && INTENT_ACTIVE_CLASS[item.intent]) ? item.intent : 'default';

          return (
            <div
              key={index}
              // State is otherwise conveyed by color only; expose on/off to
              // assistive tech since the label text is identical in both states.
              role="img"
              aria-label={`${item.label}: ${resolved ? 'on' : 'off'}`}
              className={`rounded-[var(--radius-sm)] border px-[var(--space-xs)] py-[var(--space-2xs)] text-center text-[length:var(--font-size-sm)] ${
                resolved ? INTENT_ACTIVE_CLASS[intent] : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
              }`}
            >
              {item.label}
            </div>
          );
        })}
      </div>
    </SectionPanel>
  );
}
