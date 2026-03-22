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
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                style={{
                  backgroundColor: '#9bc07b',
                  color: '#1b1b1b',
                  fontWeight: 'bold',
                  padding: '6px 8px',
                  textAlign: 'left',
                  borderBottom: '1px solid #7aaa5a',
                  whiteSpace: 'nowrap',
                }}
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
              style={{ backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#e4eddc' }}
            >
              {columns.map(col => (
                <td
                  key={col}
                  style={{
                    padding: '5px 8px',
                    color: '#1b1b1b',
                    verticalAlign: 'top',
                    borderBottom: '1px solid #d0d8c8',
                  }}
                >
                  {row[col] ?? '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {section.footnote && (
        <p
          style={{
            marginTop: '8px',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
            fontStyle: 'italic',
          }}
        >
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
          style={{
            display: 'flex',
            padding: '5px 0',
            borderBottom: index < items.length - 1 ? '1px solid var(--color-divider)' : 'none',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <div
            style={{
              width: '20%',
              minWidth: '120px',
              fontWeight: 'bold',
              color: 'var(--color-text)',
              paddingRight: '8px',
              flexShrink: 0,
            }}
          >
            {item.label}
          </div>
          <div style={{ flex: 1, color: 'var(--color-text)' }}>{item.description}</div>
        </div>
      ))}
    </div>
  );
}

function ReferenceRulesText({ section }: ReferenceSectionRendererProps) {
  const paragraphs = section.paragraphs ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      {paragraphs.map((para, index) => (
        <p
          key={index}
          style={{
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-sm)',
            lineHeight: '1.5',
          }}
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
