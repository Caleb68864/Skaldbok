import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function IconButton({ icon, label, style, disabled, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 'var(--touch-target-min)',
        minHeight: 'var(--touch-target-min)',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        color: 'var(--color-text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        padding: 'var(--space-xs)',
        ...style,
      }}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
