import type { KeyboardEvent, ReactNode } from 'react';
import { Flag, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimelineItemLayout } from './types';
import { truncateVisibleLabel } from './utils/layout';

function resolveToneClass(variant: TimelineItemLayout['item']['variant']) {
  switch (variant) {
    case 'accent':
      return 'border-accent bg-surface text-text';
    case 'warning':
      return 'border-warning bg-surface text-text';
    case 'success':
      return 'border-success bg-surface text-text';
    case 'danger':
      return 'border-danger bg-surface text-text';
    case 'muted':
      return 'border-border bg-bg text-text-muted';
    case 'default':
    default:
      return 'border-border bg-surface-alt text-text';
  }
}

function resolveTokenColor(colorToken?: string): string | undefined {
  if (!colorToken) {
    return undefined;
  }

  if (colorToken.startsWith('var(')) {
    return colorToken;
  }

  return colorToken.startsWith('--') ? `var(${colorToken})` : colorToken;
}

interface TimelineItemBarProps {
  layout: TimelineItemLayout;
  trackLabel: string;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHoverChange: (hovered: boolean) => void;
  renderContent?: (item: TimelineItemLayout['item'], layout: TimelineItemLayout) => ReactNode;
}

export function TimelineItemBar({
  layout,
  trackLabel,
  selected,
  hovered,
  onSelect,
  onHoverChange,
  renderContent,
}: TimelineItemBarProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const accentColor = resolveTokenColor(layout.item.colorToken);
  const label = truncateVisibleLabel(layout.item.title, layout.widthPx - 24);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'absolute flex h-9 items-center gap-2 overflow-hidden rounded-[var(--radius-sm)] border px-3 text-left shadow-[var(--shadow-soft)] transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            resolveToneClass(layout.item.variant),
            selected && 'ring-2 ring-gold',
            hovered && 'translate-y-[-1px] shadow-[var(--shadow-medium)]',
          )}
          style={{
            left: layout.leftPx,
            top: layout.topPx,
            width: layout.widthPx,
            borderColor: accentColor ?? undefined,
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
          {typeof layout.item.icon === 'string' ? (
            <span className="text-xs">{layout.item.icon}</span>
          ) : layout.item.icon ? (
            layout.item.icon
          ) : (
            <Flag className="h-3.5 w-3.5 shrink-0 text-text-muted" />
          )}
          {renderContent ? (
            <div className="min-w-0 flex-1">{renderContent(layout.item, layout)}</div>
          ) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              {layout.item.subtitle ? (
                <span className="block truncate text-[11px] text-text-muted">{layout.item.subtitle}</span>
              ) : null}
            </span>
          )}
          {layout.item.sourceId ? <Link2 className="h-3.5 w-3.5 shrink-0 text-text-muted" /> : null}
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border border-border bg-surface p-3">
        <div className="space-y-1">
          <p className="font-semibold text-text">{layout.item.title}</p>
          {layout.item.subtitle ? <p className="text-xs text-text-muted">{layout.item.subtitle}</p> : null}
          <p className="text-xs text-text-muted">Track: {trackLabel}</p>
          {layout.item.tags?.length ? (
            <p className="text-xs text-text-muted">Tags: {layout.item.tags.join(', ')}</p>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
