/**
 * Public entry point for the reusable timeline module.
 *
 * @remarks
 * Re-exports the types, the {@link TimelineRoot} widget and its sub-components, and
 * the layout/state hooks. Consumers should import from here rather than reaching into
 * individual files. Adapters/config/utils are intentionally not re-exported — they
 * are internal wiring.
 */
export * from './types';
export * from './TimelineRoot';
export * from './TimelineToolbar';
export * from './TimelineViewport';
export * from './TimelineHeaderAxis';
export * from './TimelineTrackList';
export * from './TimelineTrackRow';
export * from './TimelineGrid';
export * from './TimelineItemBar';
export * from './TimelineItemMarker';
export * from './TimelineNowMarker';
export * from './TimelineLegend';
export * from './TimelineDetailsPanel';
export * from './TimelineEmptyState';
export * from './hooks/useTimelineLayout';
export * from './hooks/useTimelineState';
