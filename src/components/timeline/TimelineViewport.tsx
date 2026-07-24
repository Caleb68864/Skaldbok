import type { ReactNode } from 'react';
import type { TimelineMarkerLayout, TimelineScaleUnit, TimelineTick, TimelineTrackLayout } from './types';
import { TimelineHeaderAxis } from './TimelineHeaderAxis';
import { TimelineTrackList } from './TimelineTrackList';

/** Props for {@link TimelineViewport}: the fully-computed layout plus selection state and the item/track interaction callbacks, threaded down to the header and rows. */
interface TimelineViewportProps {
  labelColumnWidth: number;
  timelineWidth: number;
  ticks: TimelineTick[];
  markers: TimelineMarkerLayout[];
  scaleUnit: TimelineScaleUnit;
  trackLayouts: TimelineTrackLayout[];
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

/** Scrollable frame that pairs the sticky {@link TimelineHeaderAxis} with the {@link TimelineTrackList}, sized to the computed timeline width. */
export function TimelineViewport({
  labelColumnWidth,
  timelineWidth,
  ticks,
  markers,
  scaleUnit,
  trackLayouts,
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
}: TimelineViewportProps) {
  return (
    <div className="overflow-auto rounded-[var(--radius-lg)] border border-border bg-surface texture-card-bevel [touch-action:pan-x_pinch-zoom] overscroll-x-contain">
      <div className="min-w-max">
        <TimelineHeaderAxis
          labelColumnWidth={labelColumnWidth}
          timelineWidth={timelineWidth}
          ticks={ticks}
          markers={markers}
          scaleUnit={scaleUnit}
        />
        <TimelineTrackList
          trackLayouts={trackLayouts}
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
          onTrackToggleCollapsed={onTrackToggleCollapsed}
          collapsedTrackIds={collapsedTrackIds}
        />
      </div>
    </div>
  );
}
