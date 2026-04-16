import { useDeferredValue, useMemo } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TimelineDetailsPanel } from './TimelineDetailsPanel';
import { TimelineEmptyState } from './TimelineEmptyState';
import { TimelineLegend } from './TimelineLegend';
import { TimelineToolbar } from './TimelineToolbar';
import { TimelineViewport } from './TimelineViewport';
import { useTimelineLayout } from './hooks/useTimelineLayout';
import { useTimelineState } from './hooks/useTimelineState';
import type { TimelineLegendItem, TimelineRootProps } from './types';

function buildDefaultLegend(items: TimelineRootProps['items'], tracks: TimelineRootProps['tracks']): TimelineLegendItem[] {
  const trackMap = new Map(tracks.map((track) => [track.id, track]));
  const usedTrackIds = new Set(items.map((item) => item.trackId));

  return [...usedTrackIds]
    .map((trackId) => trackMap.get(trackId))
    .filter((track): track is NonNullable<typeof track> => track != null)
    .map((track) => ({
      id: track.id,
      label: track.label,
      colorToken: track.colorToken,
      tone: 'default',
    }));
}

export function TimelineRoot({
  tracks,
  items,
  markers = [],
  visibleRange,
  defaultVisibleRange,
  onItemSelect,
  onTrackSelect,
  onNavigateToSource,
  renderItemContent,
  renderTrackLabel,
  renderItemDetails,
  className,
  themeVariant,
  legendItems,
  toolbarTitle,
  emptyStateTitle,
  emptyStateDescription,
  initialFilterState,
  filterState,
  onFilterStateChange,
  selectionState,
  onSelectionStateChange,
  initialScaleUnit = 'custom',
  labelColumnWidth = 240,
  minTimelineWidth = 960,
  laneHeight = 40,
  laneGap = 12,
  showToolbar = true,
  showLegend = true,
  showDetailsPanel = true,
  showNowMarker = true,
  now,
  onAddItem,
  addItemLabel,
}: TimelineRootProps) {
  const state = useTimelineState({
    tracks,
    items,
    markers,
    visibleRange,
    defaultVisibleRange,
    initialFilterState,
    filterState,
    onFilterStateChange,
    selectionState,
    onSelectionStateChange,
    initialScaleUnit,
  });

  const deferredSearchText = useDeferredValue(state.filterState.searchText);
  const deferredFilterState = useMemo(
    () => ({ ...state.filterState, searchText: deferredSearchText }),
    [deferredSearchText, state.filterState],
  );

  const layout = useTimelineLayout({
    tracks,
    items,
    markers,
    filterState: deferredFilterState,
    viewState: state.viewState,
    now,
    minTimelineWidth,
    laneHeight,
    laneGap,
  });

  const selectedItem = useMemo(
    () => items.find((item) => item.id === state.selectionState.selectedItemId) ?? null,
    [items, state.selectionState.selectedItemId],
  );
  const selectedTrack = useMemo(
    () => tracks.find((track) => track.id === state.selectionState.selectedTrackId)
      ?? (selectedItem ? tracks.find((track) => track.id === selectedItem.trackId) : undefined),
    [selectedItem, state.selectionState.selectedTrackId, tracks],
  );

  const effectiveLegend = legendItems ?? buildDefaultLegend(items, tracks);
  const hasTracks = layout.trackLayouts.length > 0;

  return (
    <TooltipProvider delayDuration={150}>
      <section
        data-timeline-theme={themeVariant}
        className={cn('flex flex-col gap-4 text-text', className)}
      >
        {showToolbar ? (
          <TimelineToolbar
            title={toolbarTitle}
            tracks={tracks}
            availableFilters={layout.availableFilters}
            visibleTrackCount={layout.visibleTrackCount}
            visibleItemCount={layout.visibleItemCount}
            searchText={state.filterState.searchText}
            hiddenTrackIds={state.filterState.hiddenTrackIds}
            includedKinds={state.filterState.includedKinds}
            tagFilters={state.filterState.tagFilters}
            statusFilters={state.filterState.statusFilters ?? []}
            scaleUnit={state.viewState.scaleUnit}
            onSearchChange={state.setSearchText}
            onToggleTrack={state.toggleTrack}
            onToggleKind={state.toggleKind}
            onToggleTag={state.toggleTag}
            onToggleStatus={state.toggleStatus}
            onScaleUnitChange={state.setScaleUnit}
            onZoomIn={state.zoomIn}
            onZoomOut={state.zoomOut}
            onReset={state.resetView}
            onAddItem={onAddItem}
            addItemLabel={addItemLabel}
          />
        ) : null}

        {hasTracks ? (
          <TimelineViewport
            labelColumnWidth={labelColumnWidth}
            timelineWidth={layout.timelineWidth}
            ticks={layout.ticks}
            markers={layout.markerLayouts}
            scaleUnit={layout.activeScaleUnit}
            trackLayouts={layout.trackLayouts}
            nowMarkerLeftPercent={showNowMarker ? layout.nowMarker?.leftPercent : undefined}
            selectedItemId={state.selectionState.selectedItemId}
            hoveredItemId={state.selectionState.hoveredItemId}
            selectedTrackId={state.selectionState.selectedTrackId}
            renderTrackLabel={renderTrackLabel}
            renderItemContent={renderItemContent}
            onItemSelect={(itemId) => {
              state.selectItem(itemId);
              const item = items.find((entry) => entry.id === itemId);
              if (item) {
                onItemSelect?.(item);
              }
            }}
            onItemHoverChange={state.hoverItem}
            onTrackSelect={(trackId) => {
              state.selectTrack(trackId);
              const track = tracks.find((entry) => entry.id === trackId);
              if (track) {
                onTrackSelect?.(track);
              }
            }}
            onTrackToggleCollapsed={state.toggleTrackCollapsed}
            collapsedTrackIds={state.filterState.collapsedTrackIds ?? []}
          />
        ) : (
          <TimelineEmptyState title={emptyStateTitle} description={emptyStateDescription} />
        )}

        {showLegend ? <TimelineLegend items={effectiveLegend} /> : null}

        {showDetailsPanel ? (
          <TimelineDetailsPanel
            item={selectedItem}
            track={selectedTrack}
            open={Boolean(selectedItem)}
            onOpenChange={(open) => {
              if (!open) {
                state.selectItem(null);
              }
            }}
            onNavigateToSource={onNavigateToSource}
            renderItemDetails={renderItemDetails}
          />
        ) : null}
      </section>
    </TooltipProvider>
  );
}
