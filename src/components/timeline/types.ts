import type { ReactNode } from 'react';

export type TimelineDateInput = string | number | Date;
export type TimelineItemType = 'point' | 'range' | 'milestone';
export type TimelineScaleUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'custom';
export type TimelineItemVariant = 'default' | 'accent' | 'warning' | 'muted' | 'success' | 'danger';

export interface TimelineRange {
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface TimelineVisibleRange {
  start: TimelineDateInput;
  end: TimelineDateInput;
}

export interface TimelineScale {
  unit: TimelineScaleUnit;
  unitMs: number;
  pixelsPerUnit: number;
}

export interface TimelineViewState {
  visibleStartMs: number;
  visibleEndMs: number;
  zoomLevel: number;
  minZoomMs?: number;
  maxZoomMs?: number;
  scaleUnit: TimelineScaleUnit;
}

export interface TimelineSelectionState {
  selectedItemId: string | null;
  hoveredItemId: string | null;
  selectedTrackId: string | null;
}

export interface TimelineFilterState {
  visibleTrackIds: string[];
  hiddenTrackIds: string[];
  includedKinds: string[];
  excludedKinds: string[];
  searchText: string;
  tagFilters: string[];
  statusFilters?: string[];
}

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
  metadata?: Record<string, unknown>;
}

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

export interface TimelineMarker {
  id: string;
  label: string;
  at: TimelineDateInput;
  kind: string;
  colorToken?: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineTick {
  valueMs: number;
  label: string;
  isMajor: boolean;
  leftPercent: number;
}

export interface TimelineMarkerLayout {
  marker: TimelineMarker;
  leftPercent: number;
}

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

export interface TimelineTrackLayout {
  track: TimelineTrack;
  items: TimelineItemLayout[];
  laneCount: number;
  rowHeight: number;
}

export interface TimelineLegendItem {
  id: string;
  label: string;
  tone?: TimelineItemVariant;
  colorToken?: string;
}

export interface TimelineDataset {
  tracks: TimelineTrack[];
  items: TimelineItem[];
  markers?: TimelineMarker[];
}

export interface TimelineAdapter<TInput> {
  buildTimeline: (input: TInput) => TimelineDataset;
}

export interface TimelineAvailableFilters {
  kinds: string[];
  statuses: string[];
  tags: string[];
}

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
