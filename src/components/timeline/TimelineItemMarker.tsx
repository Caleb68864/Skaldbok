import type { KeyboardEvent } from 'react';
import { Diamond, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimelineItemLayout } from './types';

function resolveTokenColor(colorToken?: string): string | undefined {
  if (!colorToken) {
    return undefined;
  }

  if (colorToken.startsWith('var(')) {
    return colorToken;
  }

  return colorToken.startsWith('--') ? `var(${colorToken})` : colorToken;
}

interface TimelineItemMarkerProps {
  layout: TimelineItemLayout;
  trackLabel: string;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHoverChange: (hovered: boolean) => void;
}

export function TimelineItemMarker({
  layout,
  trackLabel,
  selected,
  hovered,
  onSelect,
  onHoverChange,
}: TimelineItemMarkerProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'absolute flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border bg-surface shadow-[var(--shadow-soft)] transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            selected && 'ring-2 ring-gold',
            hovered && 'scale-105 shadow-[var(--shadow-medium)]',
          )}
          style={{
            left: layout.leftPx - 16,
            top: layout.topPx,
            borderColor: resolveTokenColor(layout.item.colorToken),
          }}
          aria-label={`${layout.item.title} on ${trackLabel}`}
          aria-pressed={selected}
          onClick={onSelect}
          onFocus={() => onHoverChange(true)}
          onBlur={() => onHoverChange(false)}
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
          onKeyDown={handleKeyDown}
        >
          <Diamond className="h-4 w-4 text-accent" />
          {layout.item.sourceId ? <Link2 className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-surface p-0.5 text-text-muted" /> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border border-border bg-surface p-3">
        <div className="space-y-1">
          <p className="font-semibold text-text">{layout.item.title}</p>
          {layout.item.subtitle ? <p className="text-xs text-text-muted">{layout.item.subtitle}</p> : null}
          <p className="text-xs text-text-muted">Track: {trackLabel}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
