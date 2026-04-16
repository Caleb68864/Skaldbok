import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  TimelineFilterState,
  TimelineItem,
  TimelineMarker,
  TimelineScaleUnit,
  TimelineSelectionState,
  TimelineTrack,
  TimelineViewState,
  TimelineVisibleRange,
} from '../types';
import { normalizeVisibleRange, resolveTimelineBounds } from '../utils/date';

interface UseTimelineStateArgs {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  markers: TimelineMarker[];
  visibleRange?: TimelineVisibleRange;
  defaultVisibleRange?: TimelineVisibleRange;
  initialFilterState?: Partial<TimelineFilterState>;
  filterState?: TimelineFilterState;
  onFilterStateChange?: (state: TimelineFilterState) => void;
  selectionState?: TimelineSelectionState;
  onSelectionStateChange?: (state: TimelineSelectionState) => void;
  initialScaleUnit?: TimelineScaleUnit;
}

function useControllableState<T>(
  controlledValue: T | undefined,
  initialValue: T,
  onChange?: (value: T) => void,
) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const setValue = useCallback(
    (nextValue: T | ((previousValue: T) => T)) => {
      const previousValue = valueRef.current;
      const resolvedValue = typeof nextValue === 'function'
        ? (nextValue as (previousValue: T) => T)(previousValue)
        : nextValue;

      valueRef.current = resolvedValue;

      if (!isControlled) {
        setInternalValue(resolvedValue);
      }

      onChange?.(resolvedValue);
    },
    [isControlled, onChange],
  );

  return [value, setValue] as const;
}

function buildInitialFilterState(
  tracks: TimelineTrack[],
  initialFilterState?: Partial<TimelineFilterState>,
): TimelineFilterState {
  const trackIds = tracks.filter((track) => track.visible).map((track) => track.id);
  const hiddenTrackIds = initialFilterState?.hiddenTrackIds ?? tracks
    .filter((track) => !track.visible)
    .map((track) => track.id);

  // Default-collapse any track whose catalog entry marked it `collapsed`.
  const defaultCollapsed = tracks
    .filter((track) => track.collapsed === true)
    .map((track) => track.id);

  return {
    visibleTrackIds: trackIds.filter((trackId) => !hiddenTrackIds.includes(trackId)),
    hiddenTrackIds,
    collapsedTrackIds: initialFilterState?.collapsedTrackIds ?? defaultCollapsed,
    includedKinds: initialFilterState?.includedKinds ?? [],
    excludedKinds: initialFilterState?.excludedKinds ?? [],
    searchText: initialFilterState?.searchText ?? '',
    tagFilters: initialFilterState?.tagFilters ?? [],
    statusFilters: initialFilterState?.statusFilters ?? [],
  };
}

function buildInitialSelectionState(
  initialSelectionState?: TimelineSelectionState,
): TimelineSelectionState {
  return initialSelectionState ?? {
    selectedItemId: null,
    hoveredItemId: null,
    selectedTrackId: null,
  };
}

function buildInitialViewState(
  items: TimelineItem[],
  markers: TimelineMarker[],
  visibleRange?: TimelineVisibleRange,
  defaultVisibleRange?: TimelineVisibleRange,
  initialScaleUnit: TimelineScaleUnit = 'custom',
): TimelineViewState {
  const fallbackBounds = resolveTimelineBounds(items, markers.map((marker) => marker.at));
  const explicitRange = visibleRange ?? defaultVisibleRange;
  const resolvedRange = explicitRange ? normalizeVisibleRange(explicitRange) ?? fallbackBounds : fallbackBounds;

  return {
    visibleStartMs: resolvedRange.startMs,
    visibleEndMs: resolvedRange.endMs,
    zoomLevel: 1,
    scaleUnit: initialScaleUnit,
  };
}

export function useTimelineState({
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
  initialScaleUnit = 'custom',
}: UseTimelineStateArgs) {
  const previousDataCountRef = useRef(items.length + markers.length);
  const initialViewState = useMemo(
    () => buildInitialViewState(items, markers, visibleRange, defaultVisibleRange, initialScaleUnit),
    [defaultVisibleRange, initialScaleUnit, items, markers, visibleRange],
  );
  const [viewState, setViewState] = useState<TimelineViewState>(initialViewState);

  const [resolvedFilterState, setFilterState] = useControllableState(
    filterState,
    buildInitialFilterState(tracks, initialFilterState),
    onFilterStateChange,
  );

  const [resolvedSelectionState, setSelectionState] = useControllableState(
    selectionState,
    buildInitialSelectionState(selectionState),
    onSelectionStateChange,
  );

  useEffect(() => {
    if (!visibleRange) {
      return;
    }

    const normalizedRange = normalizeVisibleRange(visibleRange);
    if (!normalizedRange) {
      return;
    }

    setViewState((currentState) => ({
      ...currentState,
      visibleStartMs: normalizedRange.startMs,
      visibleEndMs: normalizedRange.endMs,
    }));
  }, [visibleRange]);

  useEffect(() => {
    if (visibleRange) {
      previousDataCountRef.current = items.length + markers.length;
      return;
    }

    const previousDataCount = previousDataCountRef.current;
    const nextDataCount = items.length + markers.length;
    previousDataCountRef.current = nextDataCount;

    if (previousDataCount > 0 || nextDataCount === 0) {
      return;
    }

    setViewState((currentState) => ({
      ...currentState,
      visibleStartMs: initialViewState.visibleStartMs,
      visibleEndMs: initialViewState.visibleEndMs,
    }));
  }, [initialViewState.visibleEndMs, initialViewState.visibleStartMs, items.length, markers.length, visibleRange]);

  useEffect(() => {
    const visibleTrackIds = tracks
      .filter((track) => track.visible && !resolvedFilterState.hiddenTrackIds.includes(track.id))
      .map((track) => track.id);

    if (
      visibleTrackIds.length === resolvedFilterState.visibleTrackIds.length &&
      visibleTrackIds.every((trackId, index) => trackId === resolvedFilterState.visibleTrackIds[index])
    ) {
      return;
    }

    setFilterState((currentState) => ({
      ...currentState,
      visibleTrackIds,
      hiddenTrackIds: currentState.hiddenTrackIds.filter((trackId) => tracks.some((track) => track.id === trackId)),
    }));
  }, [resolvedFilterState.hiddenTrackIds, resolvedFilterState.visibleTrackIds, setFilterState, tracks]);

  const setSearchText = useCallback(
    (searchText: string) => {
      setFilterState((currentState) => ({ ...currentState, searchText }));
    },
    [setFilterState],
  );

  const toggleTrack = useCallback(
    (trackId: string) => {
      setFilterState((currentState) => {
        const hiddenTrackIds = currentState.hiddenTrackIds.includes(trackId)
          ? currentState.hiddenTrackIds.filter((id) => id !== trackId)
          : [...currentState.hiddenTrackIds, trackId];

        const visibleTrackIds = tracks
          .filter((track) => track.visible && !hiddenTrackIds.includes(track.id))
          .map((track) => track.id);

        return {
          ...currentState,
          hiddenTrackIds,
          visibleTrackIds,
        };
      });
    },
    [setFilterState, tracks],
  );

  /**
   * Toggle a parent track between collapsed and expanded. Collapsed parents
   * hide their children's rows; the children's items aggregate onto the
   * parent row for a compact summary. See {@link TimelineFilterState.collapsedTrackIds}.
   */
  const toggleTrackCollapsed = useCallback(
    (trackId: string) => {
      setFilterState((currentState) => {
        const current = currentState.collapsedTrackIds ?? [];
        const collapsedTrackIds = current.includes(trackId)
          ? current.filter((id) => id !== trackId)
          : [...current, trackId];
        return { ...currentState, collapsedTrackIds };
      });
    },
    [setFilterState],
  );

  const toggleListValue = useCallback(
    (key: 'includedKinds' | 'tagFilters' | 'statusFilters', value: string) => {
      setFilterState((currentState) => {
        const currentValues = currentState[key] ?? [];
        const nextValues = currentValues.includes(value)
          ? currentValues.filter((entry) => entry !== value)
          : [...currentValues, value];

        return {
          ...currentState,
          [key]: nextValues,
        };
      });
    },
    [setFilterState],
  );

  const setScaleUnit = useCallback(
    (scaleUnit: TimelineScaleUnit) => {
      setViewState((currentState) => ({ ...currentState, scaleUnit }));
    },
    [],
  );

  const zoomIn = useCallback(() => {
    setViewState((currentState) => ({
      ...currentState,
      zoomLevel: Math.min(4, Number((currentState.zoomLevel * 1.25).toFixed(2))),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewState((currentState) => ({
      ...currentState,
      zoomLevel: Math.max(0.5, Number((currentState.zoomLevel / 1.25).toFixed(2))),
    }));
  }, []);

  const resetView = useCallback(() => {
    setViewState(initialViewState);
  }, [initialViewState]);

  const selectItem = useCallback(
    (itemId: string | null) => {
      setSelectionState((currentState) => ({
        ...currentState,
        selectedItemId: itemId,
      }));
    },
    [setSelectionState],
  );

  const hoverItem = useCallback(
    (itemId: string | null) => {
      setSelectionState((currentState) => ({
        ...currentState,
        hoveredItemId: itemId,
      }));
    },
    [setSelectionState],
  );

  const selectTrack = useCallback(
    (trackId: string | null) => {
      setSelectionState((currentState) => ({
        ...currentState,
        selectedTrackId: trackId,
      }));
    },
    [setSelectionState],
  );

  return {
    viewState,
    filterState: resolvedFilterState,
    selectionState: resolvedSelectionState,
    setSearchText,
    toggleTrack,
    toggleTrackCollapsed,
    toggleKind: (value: string) => toggleListValue('includedKinds', value),
    toggleTag: (value: string) => toggleListValue('tagFilters', value),
    toggleStatus: (value: string) => toggleListValue('statusFilters', value),
    setScaleUnit,
    zoomIn,
    zoomOut,
    resetView,
    selectItem,
    hoverItem,
    selectTrack,
  };
}
