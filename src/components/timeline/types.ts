/**
 * Shared type vocabulary for the reusable timeline widget.
 *
 * @remarks
 * Two layers live here: the *input* model a caller supplies ({@link TimelineTrack},
 * {@link TimelineItem}, {@link TimelineMarker}) and the *computed* layout model the
 * rendering components consume ({@link TimelineItemLayout}, {@link TimelineTrackLayout},
 * {@link TimelineTick}). The state interfaces ({@link TimelineFilterState},
 * {@link TimelineSelectionState}, {@link TimelineViewState}) can each be controlled or
 * uncontrolled at {@link TimelineRootProps}.
 */
import type { ReactNode } from 'react';

/** A date accepted anywhere in the timeline API — ISO string, epoch ms, or `Date`. */
export type TimelineDateInput = string | number | Date;
/** Whether an item is instantaneous (`point`/`milestone`) or spans a range. */
export type TimelineItemType = 'point' | 'range' | 'milestone';
/** Granularity of the time axis; `custom` lets the layout pick a fitting unit automatically. */
export type TimelineScaleUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'custom';
/** Semantic color/emphasis of an item, mapped to theme tokens by the render components. */
export type TimelineItemVariant = 'default' | 'accent' | 'warning' | 'muted' | 'success' | 'danger';

/** A resolved millisecond span (start/end/duration) after date inputs are normalized. */
export interface TimelineRange {
  startMs: number;
  endMs: number;
  durationMs: number;
}

/** The window of time currently shown, in raw (un-normalized) date inputs. */
export interface TimelineVisibleRange {
  start: TimelineDateInput;
  end: TimelineDateInput;
}

/** The active axis scale: its unit, that unit's length in ms, and its pixel width. */
export interface TimelineScale {
  unit: TimelineScaleUnit;
  unitMs: number;
  pixelsPerUnit: number;
}

/** Pan/zoom state of the viewport: the visible ms window, zoom level, and scale unit. */
export interface TimelineViewState {
  visibleStartMs: number;
  visibleEndMs: number;
  zoomLevel: number;
  minZoomMs?: number;
  maxZoomMs?: number;
  scaleUnit: TimelineScaleUnit;
}

/** Which item/track is selected or hovered — the transient interaction state. */
export interface TimelineSelectionState {
  selectedItemId: string | null;
  hoveredItemId: string | null;
  selectedTrackId: string | null;
}

/** The active filtering: visible/hidden/collapsed tracks, included/excluded kinds, search text, and tag/status filters. */
export interface TimelineFilterState {
  visibleTrackIds: string[];
  hiddenTrackIds: string[];
  /**
   * Parent track ids that are currently collapsed. A parent in this list
   * hides its children's rows; their items aggregate onto the parent row.
   */
  collapsedTrackIds: string[];
  includedKinds: string[];
  excludedKinds: string[];
  searchText: string;
  tagFilters: string[];
  statusFilters?: string[];
}

/** An input track (a horizontal lane) that items are grouped into; may nest under a parent. */
export interface TimelineTrack {
  id: string;
  key?: string;
  label: string;
  description?: string;
  kind: string;
  order: number;
  visible: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  height?: number;
  colorToken?: string;
  icon?: ReactNode | string;
  /**
   * Optional parent track id. When set, this track renders as an indented
   * child under the named parent. When the parent is collapsed (via
   * {@link TimelineFilterState.collapsedTrackIds}), child rows hide and their
   * items aggregate onto the parent row for a compact summary view.
   */
  parentTrackId?: string;
  metadata?: Record<string, unknown>;
}

/** An input event placed on a track. `sourceId`/`sourceType`/`noteId` link it back to the domain entity it was derived from. */
export interface TimelineItem {
  id: string;
  trackId: string;
  title: string;
  subtitle?: string;
  start: TimelineDateInput;
  end?: TimelineDateInput;
  type: TimelineItemType;
  kind?: string;
  status?: string;
  colorToken?: string;
  variant?: TimelineItemVariant;
  icon?: ReactNode | string;
  sourceId?: string;
  sourceType?: string;
  noteId?: string;
  tags?: string[];
  tooltip?: string;
  interactive?: boolean;
  metadata?: Record<string, unknown>;
}

/** A labeled vertical reference line at a single instant (e.g. a session boundary), spanning all tracks. */
export interface TimelineMarker {
  id: string;
  label: string;
  at: TimelineDateInput;
  kind: string;
  colorToken?: string;
  metadata?: Record<string, unknown>;
}

/** A computed axis gridline: its time, label, major/minor weight, and horizontal position. */
export interface TimelineTick {
  valueMs: number;
  label: string;
  isMajor: boolean;
  leftPercent: number;
}

/** A marker with its computed horizontal position. */
export interface TimelineMarkerLayout {
  marker: TimelineMarker;
  leftPercent: number;
}

/** An item with its fully-computed geometry: resolved range, assigned lane, and pixel/percentage box, including clip flags when it overflows the visible range. */
export interface TimelineItemLayout {
  item: TimelineItem;
  range: TimelineRange;
  lane: number;
  laneCount: number;
  leftPx: number;
  widthPx: number;
  leftPercent: number;
  widthPercent: number;
  topPx: number;
  isClippedStart: boolean;
  isClippedEnd: boolean;
}

/** A track with its laid-out items and the resulting row height (driven by its lane count). */
export interface TimelineTrackLayout {
  track: TimelineTrack;
  items: TimelineItemLayout[];
  laneCount: number;
  rowHeight: number;
}

/** One legend entry describing a category by label, tone, and color token. */
export interface TimelineLegendItem {
  id: string;
  label: string;
  tone?: TimelineItemVariant;
  colorToken?: string;
}

/** The complete input the timeline renders: tracks, items, and optional markers. */
export interface TimelineDataset {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  markers?: TimelineMarker[];
}

/** Contract for turning some domain input into a {@link TimelineDataset} (see {@link notesToTimeline}). */
export interface TimelineAdapter<TInput> {
  buildTimeline: (input: TInput) => TimelineDataset;
}

/** The distinct kind/status/tag values present in the data, used to populate the toolbar filter menus. */
export interface TimelineAvailableFilters {
  kinds: string[];
  statuses: string[];
  tags: string[];
}

/** Full prop surface of {@link TimelineRoot}: data, controlled/uncontrolled state hooks, render overrides, layout dimensions, and feature toggles. */
export interface TimelineRootProps {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  markers?: TimelineMarker[];
  visibleRange?: TimelineVisibleRange;
  defaultVisibleRange?: TimelineVisibleRange;
  onItemSelect?: (item: TimelineItem) => void;
  onTrackSelect?: (track: TimelineTrack) => void;
  onNavigateToSource?: (item: TimelineItem) => void;
  renderItemContent?: (item: TimelineItem, layout: TimelineItemLayout) => ReactNode;
  renderTrackLabel?: (track: TimelineTrack) => ReactNode;
  renderItemDetails?: (item: TimelineItem, track?: TimelineTrack) => ReactNode;
  className?: string;
  themeVariant?: string;
  legendItems?: TimelineLegendItem[];
  toolbarTitle?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  initialFilterState?: Partial<TimelineFilterState>;
  filterState?: TimelineFilterState;
  onFilterStateChange?: (state: TimelineFilterState) => void;
  selectionState?: TimelineSelectionState;
  onSelectionStateChange?: (state: TimelineSelectionState) => void;
  initialScaleUnit?: TimelineScaleUnit;
  labelColumnWidth?: number;
  minTimelineWidth?: number;
  laneHeight?: number;
  laneGap?: number;
  showToolbar?: boolean;
  showLegend?: boolean;
  showDetailsPanel?: boolean;
  showNowMarker?: boolean;
  now?: TimelineDateInput;
  onAddItem?: () => void;
  addItemLabel?: string;
}
