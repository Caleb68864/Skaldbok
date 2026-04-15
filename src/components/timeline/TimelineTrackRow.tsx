import type { ReactNode } from 'react';
import { ChevronRight, Layers3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimelineGrid } from './TimelineGrid';
import { TimelineItemBar } from './TimelineItemBar';
import { TimelineItemMarker } from './TimelineItemMarker';
import { TimelineNowMarker } from './TimelineNowMarker';
import type { TimelineMarkerLayout, TimelineTick, TimelineTrackLayout } from './types';

function resolveTrackColor(colorToken?: string): string | undefined {
  if (!colorToken) {
    return undefined;
  }

  if (colorToken.startsWith('var(')) {
    return colorToken;
  }

  return colorToken.startsWith('--') ? `var(${colorToken})` : colorToken;
}

interface TimelineTrackRowProps {
  layout: TimelineTrackLayout;
  labelColumnWidth: number;
  timelineWidth: number;
  ticks: TimelineTick[];
  markers: TimelineMarkerLayout[];
  nowMarkerLeftPercent?: number;
  selectedItemId: string | null;
  hoveredItemId: string | null;
  selectedTrackId: string | null;
  renderTrackLabel?: (track: TimelineTrackLayout['track']) => ReactNode;
  renderItemContent?: (
    item: TimelineTrackLayout['items'][number]['item'],
    layout: TimelineTrackLayout['items'][number],
  ) => ReactNode;
  onItemSelect: (itemId: string) => void;
  onItemHoverChange: (itemId: string | null) => void;
  onTrackSelect: (trackId: string) => void;
}

export function TimelineTrackRow({
  layout,
  labelColumnWidth,
  timelineWidth,
  ticks,
  markers,
  nowMarkerLeftPercent,
  selectedItemId,
  hoveredItemId,
  selectedTrackId,
  renderTrackLabel,
  renderItemContent,
  onItemSelect,
  onItemHoverChange,
  onTrackSelect,
}: TimelineTrackRowProps) {
  return (
    <div
      className="grid border-b border-border/70 last:border-b-0"
      style={{ gridTemplateColumns: `${labelColumnWidth}px ${timelineWidth}px` }}
    >
      <button
        type="button"
        className={cn(
          'sticky left-0 z-20 flex min-h-full touch-manipulation items-start gap-3 border-r border-border bg-surface px-4 py-4 text-left',
          selectedTrackId === layout.track.id && 'bg-surface-alt',
        )}
        onClick={() => onTrackSelect(layout.track.id)}
      >
        <span
          className="mt-1 h-3 w-3 rounded-full border border-border"
          style={layout.track.colorToken ? { backgroundColor: resolveTrackColor(layout.track.colorToken) } : undefined}
        />
        <span className="min-w-0 flex-1">
          {renderTrackLabel ? (
            renderTrackLabel(layout.track)
          ) : (
            <>
              <span className="block truncate font-medium text-text">{layout.track.label}</span>
              <span className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                <Layers3 className="h-3.5 w-3.5" />
                {layout.items.length} event{layout.items.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted" />
      </button>
      <div className="relative bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_42%,rgba(0,0,0,0.06))]" style={{ height: layout.rowHeight }}>
        <TimelineGrid ticks={ticks} markers={markers} />
        {nowMarkerLeftPercent != null ? <TimelineNowMarker leftPercent={nowMarkerLeftPercent} /> : null}
        {layout.items.length === 0 ? (
          <div className="absolute inset-y-0 left-4 flex items-center text-xs text-text-muted">
            No events on this track in the current view.
          </div>
        ) : null}
        {layout.items.map((itemLayout) =>
          itemLayout.item.type === 'range' ? (
            <TimelineItemBar
              key={itemLayout.item.id}
              layout={itemLayout}
              trackLabel={layout.track.label}
              selected={selectedItemId === itemLayout.item.id}
              hovered={hoveredItemId === itemLayout.item.id}
              onSelect={() => onItemSelect(itemLayout.item.id)}
              onHoverChange={(hovered) => onItemHoverChange(hovered ? itemLayout.item.id : null)}
              renderContent={renderItemContent}
            />
          ) : (
            <TimelineItemMarker
              key={itemLayout.item.id}
              layout={itemLayout}
              trackLabel={layout.track.label}
              selected={selectedItemId === itemLayout.item.id}
              hovered={hoveredItemId === itemLayout.item.id}
              onSelect={() => onItemSelect(itemLayout.item.id)}
              onHoverChange={(hovered) => onItemHoverChange(hovered ? itemLayout.item.id : null)}
            />
          ),
        )}
      </div>
    </div>
  );
}
