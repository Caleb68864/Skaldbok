import { CalendarRange } from 'lucide-react';

interface TimelineEmptyStateProps {
  title?: string;
  description?: string;
}

export function TimelineEmptyState({
  title = 'No timeline data yet',
  description = 'Add tracks or events to populate this timeline view.',
}: TimelineEmptyStateProps) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-alt/60 px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface">
        <CalendarRange className="h-6 w-6 text-text-muted" />
      </div>
      <h3 className="text-lg font-[family-name:var(--font-display)] text-text">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-text-muted">{description}</p>
    </div>
  );
}
