import { SectionPanel } from '../../../../components/primitives/SectionPanel';
import { resolveDataPath } from './TileCard';
import type { PlayModuleProps } from '../../../playDashboard/types';

/** One row of a {@link TableCard}: a label paired with a resolved or literal value. */
export interface TableCardRow {
  label: string;
  value?: string | number;
  source?: string;
}

/**
 * Declarative props for a label/value table.
 *
 * @remarks
 * Each row's `value` is a literal to display as-is; `source` is a whitelisted
 * data path resolved via {@link resolveDataPath}. When both are given `value`
 * wins. No function props — templates are JSON, so nothing here can be a callback.
 */
export interface TableCardProps extends PlayModuleProps {
  title: string;
  rows: TableCardRow[];
}

/** Generic read-only label/value table: a title and a list of resolved or literal rows. */
export function TableCard({ title, rows, character, system }: TableCardProps) {
  // `rows` arrives from untrusted JSON typed as `unknown` props — a template that
  // omits it (or supplies a non-array) must render an empty table, never throw.
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <SectionPanel title={title}>
      <table className="w-full text-[length:var(--font-size-sm)]">
        <tbody>
          {safeRows.map((row, index) => {
            const resolved = row.value !== undefined
              ? row.value
              : row.source
                ? resolveDataPath(row.source, character, system)
                : undefined;
            const display = resolved === undefined || resolved === null ? '—' : String(resolved);

            return (
              <tr key={index} className="border-b border-[var(--color-border)] last:border-b-0">
                <td className="py-[var(--space-2xs)] pr-[var(--space-sm)] text-[var(--color-text-muted)]">{row.label}</td>
                <td className="py-[var(--space-2xs)] text-right font-semibold text-[var(--color-text)]">{display}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </SectionPanel>
  );
}
