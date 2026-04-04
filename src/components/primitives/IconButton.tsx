import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export function IconButton({ icon, label, className, disabled, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center min-w-[44px] min-h-[44px]",
        "bg-transparent border border-border rounded-[var(--radius-sm)]",
        "text-text cursor-pointer p-[var(--space-xs)]",
        "hover:bg-surface-alt transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
    </button>
  );
}
