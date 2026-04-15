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
}: TimelineTrackListProps) {
  return (
    <div>
      {trackLayouts.map((layout) => (
        <TimelineTrackRow
          key={layout.track.id}
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
        />
      ))}
    </div>
  );
}
