import { SectionPanel } from '../../components/primitives/SectionPanel';
import type { QuickRefCard } from '../../types/system';
import type { PlayModuleProps } from './types';

/**
 * Collapsible at-the-table cheat sheet, driven entirely by the active system's
 * `quickReference` cards.
 *
 * @remarks
 * Renders read-only so a player never edits rules mid-combat, and returns
 * nothing when the system ships no cards — the panel simply does not exist for
 * a ruleset that has not authored one. Collapsed by default so it stays out of
 * the way until wanted.
 */
export function QuickReferenceModule({ system }: PlayModuleProps) {
  const cards = system?.quickReference ?? [];
  if (cards.length === 0) return null;

  return (
    <SectionPanel title="Quick Reference" collapsible defaultOpen={false}>
      <div className="grid gap-[var(--space-sm)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
        {cards.map((card, i) => (
          <QuickRefCardView key={`${card.title}-${i}`} card={card} />
        ))}
      </div>
    </SectionPanel>
  );
}

function QuickRefCardView({ card }: { card: QuickRefCard }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-sm)]">
      <p className="m-0 mb-[var(--space-xs)] text-[length:var(--font-size-sm)] font-semibold text-[var(--color-accent)]">
        {card.title}
      </p>
      <table className="w-full border-collapse text-[length:var(--font-size-sm)]">
        {card.columns && (
          <thead>
            <tr>
              {card.columns.map(col => (
                <th
                  key={col}
                  className="border-b border-[var(--color-border)] px-1 py-0.5 text-left font-semibold text-[var(--color-text-muted)]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {card.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td
                  key={c}
                  className={
                    'px-1 py-0.5 align-top text-[var(--color-text)] ' +
                    // First column of a multi-column row is the "key"; mute it slightly.
                    (card.columns && card.columns.length > 1 && c === 0
                      ? 'text-[var(--color-text-muted)] whitespace-nowrap pr-3'
                      : '')
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {card.note && (
        <p className="m-0 mt-[var(--space-xs)] text-[length:var(--font-size-sm)] leading-snug text-[var(--color-text-muted)]">
          {card.note}
        </p>
      )}
    </div>
  );
}
