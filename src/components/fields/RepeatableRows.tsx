/** One editable column in a {@link RepeatableRows} row. */
export interface RepeatableColumn {
  /** Key under which this field's value is stored in the row record. */
  key: string;
  /** Column header / field label. */
  label: string;
  /** CSS `flex` shorthand controlling the field's width (default `1 1 120px`). */
  flex?: string;
  /** Input type (default `text`). */
  type?: 'text' | 'number';
}

interface RepeatableRowsProps {
  columns: RepeatableColumn[];
  /** Rows of string values, keyed by column key. */
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
  /** When false, fields are read-only and the add/remove controls are hidden. */
  editable: boolean;
  /** Noun for the add button ("Term" → "+ Term"). */
  addLabel: string;
  /** Read-only message shown when there are no rows. */
  emptyLabel?: string;
}

/**
 * A generic add/remove list of labelled fields — one flex-wrapping row per record,
 * values as plain strings (data-entry, no rolling). Used for the Traveller career
 * history, training, and connection tables. Rows wrap on narrow screens, so it
 * stays usable on a phone without horizontal overflow.
 */
export function RepeatableRows({ columns, rows, onChange, editable, addLabel, emptyLabel }: RepeatableRowsProps) {
  const update = (index: number, key: string, value: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, {}]);

  const inputCls =
    'w-full min-h-[40px] px-2 border border-[var(--color-border)] rounded-[var(--radius-sm)] bg-[var(--color-surface-alt)] text-[var(--color-text)] text-[length:var(--font-size-sm)] disabled:opacity-70';

  if (!editable && rows.length === 0) {
    return (
      <p className="m-0 text-[var(--color-text-muted)] text-[length:var(--font-size-sm)]">
        {emptyLabel ?? 'None recorded.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex flex-wrap items-end gap-2 border-b border-[var(--color-border)] pb-[var(--space-sm)] last:border-b-0"
        >
          {columns.map(col => (
            <label
              key={col.key}
              className="flex min-w-0 flex-col gap-1 text-[length:0.7rem] uppercase tracking-wide text-[var(--color-text-muted)]"
              style={{ flex: col.flex ?? '1 1 120px' }}
            >
              {col.label}
              <input
                type={col.type ?? 'text'}
                value={row[col.key] ?? ''}
                disabled={!editable}
                aria-label={col.label}
                onChange={e => update(index, col.key, e.target.value)}
                className={inputCls}
              />
            </label>
          ))}
          {editable && (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove row"
              className="min-h-[40px] shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] cursor-pointer hover:bg-[var(--color-surface)]"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {editable && (
        <button
          type="button"
          onClick={add}
          className="self-start min-h-[44px] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 text-[length:var(--font-size-sm)] text-[var(--color-text)] cursor-pointer hover:bg-[var(--color-surface)]"
        >
          + {addLabel}
        </button>
      )}
    </div>
  );
}
