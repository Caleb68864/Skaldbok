import { cn } from '@/lib/utils';

interface CounterControlProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
  disabled?: boolean;
}

export function CounterControl({ value, min, max, onChange, label, disabled = false }: CounterControlProps) {
  function decrement() {
    if (disabled) return;
    const next = value - 1;
    if (min !== undefined && next < min) return;
    onChange(next);
  }

  function increment() {
    if (disabled) return;
    const next = value + 1;
    if (max !== undefined && next > max) return;
    onChange(next);
  }

  return (
    <div className="flex items-center gap-[var(--space-sm)]">
      <span className="text-sm text-text-muted min-w-[60px]">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        onClick={decrement}
        disabled={disabled || (min !== undefined && value <= min)}
        className={cn(
          "min-w-[44px] min-h-[44px] text-xl",
          "bg-surface-alt border border-border rounded-[var(--radius-sm)]",
          "text-text cursor-pointer flex items-center justify-center",
          "hover:brightness-110 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        &minus;
      </button>
      <span className="min-w-[40px] text-center text-lg font-bold text-text">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        onClick={increment}
        disabled={disabled || (max !== undefined && value >= max)}
        className={cn(
          "min-w-[44px] min-h-[44px] text-xl",
          "bg-surface-alt border border-border rounded-[var(--radius-sm)]",
          "text-text cursor-pointer flex items-center justify-center",
          "hover:brightness-110 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        +
      </button>
    </div>
  );
}
