import { cn } from '@/lib/utils';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export function Chip({ label, active = false, onClick, disabled = false }: ChipProps) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className={cn(
        "inline-flex items-center justify-center min-h-[44px] min-w-[44px]",
        "px-2.5 py-1 rounded-[var(--radius-lg)] border border-border",
        "font-inherit text-sm cursor-pointer transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        active
          ? "bg-accent text-bg font-bold"
          : "bg-surface-alt text-text font-normal",
        disabled && "pointer-events-none opacity-60",
      )}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
