import { cn } from '@/lib/utils';
import type { TimelineLegendItem } from './types';

function resolveToneClass(tone: TimelineLegendItem['tone']) {
  switch (tone) {
    case 'accent':
      return 'border-accent text-text';
    case 'warning':
      return 'border-warning text-text';
    case 'success':
      return 'border-success text-text';
    case 'danger':
      return 'border-danger text-text';
    case 'muted':
      return 'border-border text-text-muted';
    case 'default':
    default:
      return 'border-border text-text';
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

interface TimelineLegendProps {
  items: TimelineLegendItem[];
}

export function TimelineLegend({ items }: TimelineLegendProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border bg-surface px-3 py-1 text-xs font-medium',
            resolveToneClass(item.tone),
          )}
        >
          <span
            className="h-2.5 w-2.5 rounded-full border border-current"
            style={item.colorToken ? { backgroundColor: resolveTokenColor(item.colorToken) } : undefined}
          />
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
