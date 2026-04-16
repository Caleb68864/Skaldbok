import type { ReactNode } from 'react';
import type { TimelineMarkerLayout, TimelineTick, TimelineTrackLayout } from './types';
import { TimelineTrackRow } from './TimelineTrackRow';

interface TimelineTrackListProps {
  trackLayouts: TimelineTrackLayout[];
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
  onTrackToggleCollapsed: (trackId: string) => void;
  collapsedTrackIds: string[];
}

export function TimelineTrackList({
  trackLayouts,
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
  onTrackToggleCollapsed,
  collapsedTrackIds,
}: TimelineTrackListProps) {
  // Detect which tracks have child tracks so parent rows can render an
  // expand/collapse chevron in the gutter.
  const parentIdsWithChildren = new Set(
    trackLayouts
      .map((layout) => layout.track.parentTrackId)
      .filter((id): id is string => !!id),
  );
  // Any parentTrackId referenced anywhere in the dataset counts as a parent,
  // even if its children are currently collapsed (and therefore absent from
  // trackLayouts). Walk through everything — the hasChildren lookup needs
  // to survive collapse/expand cycles.
  // Additionally include parent ids that are currently collapsed: their
  // children aren't in trackLayouts right now, but the parent row is still
  // a parent and should show the expand affordance.
  const collapsedSet = new Set(collapsedTrackIds);
  return (
    <div>
      {trackLayouts.map((layout) => {
        const trackId = layout.track.id;
        const isChild = !!layout.track.parentTrackId;
        const hasChildren = parentIdsWithChildren.has(trackId) || collapsedSet.has(trackId);
        return (
          <TimelineTrackRow
            key={trackId}
            layout={layout}
            labelColumnWidth={labelColumnWidth}
            timelineWidth={timelineWidth}
            ticks={ticks}
            markers={markers}
            nowMarkerLeftPercent={nowMarkerLeftPercent}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            selectedTrackId={selectedTrackId}
            renderTrackLabel={renderTrackLabel}
            renderItemContent={renderItemContent}
            onItemSelect={onItemSelect}
            onItemHoverChange={onItemHoverChange}
            onTrackSelect={onTrackSelect}
            indentLevel={isChild ? 1 : 0}
            hasChildren={hasChildren}
            isCollapsed={collapsedSet.has(trackId)}
            onToggleCollapsed={hasChildren ? () => onTrackToggleCollapsed(trackId) : undefined}
          />
        );
      })}
    </div>
  );
}
