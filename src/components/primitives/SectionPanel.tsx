import { useState } from 'react';
import type { ReactNode } from 'react';

interface SectionPanelProps {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function SectionPanel({ title, children, collapsible = false, defaultOpen = true }: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-md)',
      overflow: 'hidden',
    }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-sm) var(--space-md)',
          backgroundColor: 'var(--color-surface-alt)',
          cursor: collapsible ? 'pointer' : 'default',
          minHeight: collapsible ? 'var(--touch-target-min)' : 'auto',
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <h3 style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text)', fontWeight: 'bold' }}>{title}</h3>
        {collapsible && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)' }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>
      {open && (
        <div style={{ padding: 'var(--space-md)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
