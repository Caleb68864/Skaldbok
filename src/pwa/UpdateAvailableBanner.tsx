import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface UpdateAvailableBannerProps {
  open: boolean;
  title?: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onApply: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Pure presentation. Knows nothing about service workers — it just renders
 * the notice and calls the handlers.
 *
 * Non-modal: uses `role="status"` + `aria-live="polite"` so screen readers
 * announce it without stealing focus. Primary action is focused on appear
 * for keyboard users.
 *
 * Positioned above the bottom nav shell (same stack as Toaster).
 */
export function UpdateAvailableBanner({
  open,
  title = 'Update Available',
  description = 'A newer version of Skaldbok is ready to install.',
  primaryLabel = 'Update Now',
  secondaryLabel = 'Later',
  onApply,
  onDismiss,
  className,
}: UpdateAvailableBannerProps) {
  const applyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) applyRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-[320] print:hidden',
        'bottom-[calc(var(--touch-target-min)+var(--space-md)+56px)]',
        'w-[min(28rem,calc(100%-2rem))]',
        'flex flex-col gap-[var(--space-sm)] sm:flex-row sm:items-center sm:justify-between',
        'rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3',
        'shadow-[var(--shadow-medium)] texture-card-bevel',
        className,
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[length:var(--size-md)] font-semibold text-text font-[family-name:var(--font-ui)]">
          {title}
        </p>
        <p className="mt-0.5 text-[length:var(--size-sm)] text-text-muted">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:ml-3 sm:shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[length:var(--size-sm)] font-medium text-text-muted hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {secondaryLabel}
        </button>
        <button
          ref={applyRef}
          type="button"
          onClick={onApply}
          className="rounded-[var(--radius-sm)] bg-accent px-3 py-1.5 text-[length:var(--size-sm)] font-semibold text-bg shadow-sm hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
