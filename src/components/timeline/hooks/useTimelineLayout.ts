import { useMemo } from 'react';
import type {
  TimelineDateInput,
  TimelineFilterState,
  TimelineItem,
  TimelineMarker,
  TimelineMarkerLayout,
  TimelineTrack,
  TimelineTrackLayout,
  TimelineViewState,
} from '../types';
import {
  clampToVisibleRange,
  coerceItemToRange,
  getScaleConfig,
  normalizeDateInput,
  resolveScaleUnit,
} from '../utils/date';
import {
  collectAvailableFilters,
  computeVisibleItems,
  filterItems,
  groupItemsByTrack,
  sortTracks,
} from '../utils/filter';
import { computeTrackLanesForOverlap } from '../utils/lanes';
import { getAxisTicks, getItemPixelPosition } from '../utils/layout';

interface UseTimelineLayoutArgs {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  markers: TimelineMarker[];
  filterState: TimelineFilterState;
  viewState: TimelineViewState;
  now?: TimelineDateInput;
  minTimelineWidth: number;
  laneHeight: number;
  laneGap: number;
}

export function useTimelineLayout({
  tracks,
  items,
  markers,
  filterState,
  viewState,
  now,
  minTimelineWidth,
  laneHeight,
  laneGap,
}: UseTimelineLayoutArgs) {
  return useMemo(() => {
    const visibleRange = {
      startMs: viewState.visibleStartMs,
      endMs: viewState.visibleEndMs,
      durationMs: Math.max(viewState.visibleEndMs - viewState.visibleStartMs, 1),
    };

    const activeScaleUnit = resolveScaleUnit(
      Math.round(visibleRange.durationMs / Math.max(viewState.zoomLevel, 0.5)),
      viewState.scaleUnit,
    );
    const scale = getScaleConfig(activeScaleUnit, viewState.zoomLevel);
    const timelineWidth = Math.max(
      minTimelineWidth,
      Math.round((visibleRange.durationMs / scale.unitMs) * scale.pixelsPerUnit),
    );

    const visibleTracks = sortTracks(tracks).filter(
      (track) => track.visible && !filterState.hiddenTrackIds.includes(track.id),
    );
    const activeTrackIds = visibleTracks.map((track) => track.id);
    const filteredItems = filterItems(items, filterState, activeTrackIds);
    const visibleItems = computeVisibleItems(filteredItems, visibleRange);
    const groupedItems = groupItemsByTrack(visibleItems);

    const trackLayouts: TimelineTrackLayout[] = visibleTracks.map((track) => {
      const trackItems = groupedItems[track.id] ?? [];
      const laneAssignments = computeTrackLanesForOverlap(trackItems);

      const itemLayouts = laneAssignments
        .map(({ item, lane, laneCount }) => {
          const range = coerceItemToRange(item);
          if (!range) {
            return null;
          }

          const { range: clampedRange, isClippedStart, isClippedEnd } = clampToVisibleRange(range, visibleRange);
          const position = getItemPixelPosition(clampedRange, visibleRange, timelineWidth);
          const topPx = 12 + lane * (laneHeight + laneGap);

          return {
            item,
            range,
            lane,
            laneCount,
            leftPx: position.leftPx,
            widthPx: position.widthPx,
            leftPercent: position.leftPercent,
            widthPercent: position.widthPercent,
            topPx,
            isClippedStart,
            isClippedEnd,
          };
        })
        .filter((layout): layout is NonNullable<typeof layout> => layout != null);

      const laneCount = Math.max(
        itemLayouts.reduce((maxLane, itemLayout) => Math.max(maxLane, itemLayout.lane + 1), 0),
        1,
      );
      const calculatedHeight = 24 + laneCount * laneHeight + Math.max(laneCount - 1, 0) * laneGap;

      return {
        track,
        items: itemLayouts,
        laneCount,
        rowHeight: Math.max(track.height ?? 0, calculatedHeight, 72),
      };
    });

    const markerLayouts: TimelineMarkerLayout[] = markers
      .map((marker) => {
        const markerMs = normalizeDateInput(marker.at);
        if (markerMs == null || markerMs < visibleRange.startMs || markerMs > visibleRange.endMs) {
          return null;
        }

        return {
          marker,
          leftPercent: ((markerMs - visibleRange.startMs) / visibleRange.durationMs) * 100,
        };
      })
      .filter((layout): layout is TimelineMarkerLayout => layout != null);

    const nowMs = normalizeDateInput(now ?? Date.now());
    const nowMarker = nowMs != null && nowMs >= visibleRange.startMs && nowMs <= visibleRange.endMs
      ? { leftPercent: ((nowMs - visibleRange.startMs) / visibleRange.durationMs) * 100 }
      : null;

    return {
      activeScaleUnit,
      availableFilters: collectAvailableFilters(items),
      markerLayouts,
      nowMarker,
      ticks: getAxisTicks(visibleRange, activeScaleUnit),
      timelineWidth,
      trackLayouts,
      visibleItemCount: visibleItems.length,
      visibleRange,
      visibleTrackCount: visibleTracks.length,
    };
  }, [filterState, items, laneGap, laneHeight, markers, minTimelineWidth, now, tracks, viewState]);
}
