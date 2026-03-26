import { useState } from 'react';
import type { ReactNode } from 'react';

interface SectionPanelProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function SectionPanel({ title, subtitle, icon, children, collapsible = false, defaultOpen = true }: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="section-panel" style={{
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 0,
      overflow: 'hidden',
    }}>
      <div
        className="section-panel__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-xs) var(--space-sm)',
          backgroundColor: 'var(--color-surface-alt)',
          cursor: collapsible ? 'pointer' : 'default',
          minHeight: collapsible ? 'var(--touch-target-min)' : 'auto',
          borderBottom: open ? '1px solid var(--color-border)' : 'none',
        }}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <h3 style={{ fontSize: 'var(--size-md)', fontFamily: 'var(--font-display)', color: 'var(--color-text)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          {icon}
          {title}
          {subtitle && (
            <span style={{ fontSize: 'var(--font-size-xs, 0.7rem)', fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: 'var(--space-xs)', whiteSpace: 'nowrap' }}>
              {subtitle}
            </span>
          )}
        </h3>
        {collapsible && (
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-lg)' }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>
      {open && (
        <div className="section-panel__body" style={{ padding: 'var(--space-sm)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
