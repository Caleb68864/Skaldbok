import type { ReferenceSection } from '../../data/dragonbaneReference';

interface ReferenceSectionRendererProps {
  section: ReferenceSection;
}

export function ReferenceSectionRenderer({ section }: ReferenceSectionRendererProps) {
  if (section.type === 'table') {
    return <ReferenceTable section={section} />;
  }
  if (section.type === 'key_value_list') {
    return <ReferenceKeyValueList section={section} />;
  }
  if (section.type === 'rules_text') {
    return <ReferenceRulesText section={section} />;
  }
  return null;
}

function ReferenceTable({ section }: ReferenceSectionRendererProps) {
  const columns = section.columns ?? [];
  const rows = section.rows ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[length:var(--font-size-sm)]">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                className="bg-[var(--color-surface-alt)] text-[var(--color-text)] font-bold px-2 py-1.5 text-left border-b border-[var(--color-border)] whitespace-nowrap"
              >
                {formatColumnHeader(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={rowIndex % 2 === 0 ? 'bg-[var(--color-surface)]' : 'bg-[var(--color-surface-alt)]'}
            >
              {columns.map(col => (
                <td
                  key={col}
                  className="px-2 py-[5px] text-[var(--color-text)] align-top border-b border-[var(--color-border)]"
                >
                  {row[col] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {section.footnote && (
        <p className="mt-2 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)] italic">
          * {section.footnote}
        </p>
      )}
    </div>
  );
}

function ReferenceKeyValueList({ section }: ReferenceSectionRendererProps) {
  const items = section.items ?? [];

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex py-[5px] text-[length:var(--font-size-sm)] ${index < items.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
        >
          <div className="w-1/5 min-w-[120px] font-bold text-[var(--color-text)] pr-2 shrink-0">
            {item.label}
          </div>
          <div className="flex-1 text-[var(--color-text)]">{item.description}</div>
        </div>
      ))}
    </div>
  );
}

function ReferenceRulesText({ section }: ReferenceSectionRendererProps) {
  const paragraphs = section.paragraphs ?? [];

  return (
    <div className="flex flex-col gap-[var(--space-sm)]">
      {paragraphs.map((para, index) => (
        <p
          key={index}
          className="text-[var(--color-text)] text-[length:var(--font-size-sm)] leading-[1.5]"
        >
          {para}
        </p>
      ))}
    </div>
  );
}

function formatColumnHeader(col: string): string {
  return col
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
