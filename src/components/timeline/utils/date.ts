import type {
  TimelineDateInput,
  TimelineItem,
  TimelineRange,
  TimelineScale,
  TimelineScaleUnit,
  TimelineVisibleRange,
} from '../types';

/**
 * Date/time math for the timeline: normalizing inputs, coercing items to ms ranges,
 * clamping to the viewport, and choosing a scale.
 */
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;
export const MONTH_APPROX_MS = 30 * DAY_MS;
export const DEFAULT_MIN_ITEM_DURATION_MS = 5 * MINUTE_MS;

/** Converts any {@link TimelineDateInput} to epoch ms, or `null` if it is missing or unparseable. */
export function normalizeDateInput(value: TimelineDateInput | null | undefined): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Resolves a visible range to ms, ordering start/end and giving a zero-width range a minimum duration so it never collapses. */
export function normalizeVisibleRange(range: TimelineVisibleRange): TimelineRange | null {
  const startMs = normalizeDateInput(range.start);
  const endMs = normalizeDateInput(range.end);

  if (startMs == null || endMs == null) {
    return null;
  }

  const safeStart = Math.min(startMs, endMs);
  const safeEnd = Math.max(startMs, endMs);

  return {
    startMs: safeStart,
    endMs: safeStart === safeEnd ? safeEnd + DEFAULT_MIN_ITEM_DURATION_MS : safeEnd,
    durationMs:
      safeStart === safeEnd
        ? DEFAULT_MIN_ITEM_DURATION_MS
        : safeEnd - safeStart,
  };
}

/** Decides whether an item is a point or a range: explicit `type` wins, otherwise a later `end` than `start` implies a range. */
export function inferPointVsRange(item: Pick<TimelineItem, 'start' | 'end' | 'type'>): 'point' | 'range' {
  if (item.type === 'range') {
    return 'range';
  }

  const startMs = normalizeDateInput(item.start);
  const endMs = normalizeDateInput(item.end);
  if (startMs == null || endMs == null) {
    return 'point';
  }

  return endMs > startMs ? 'range' : 'point';
}

/**
 * Resolves an item to a concrete ms range, or `null` if it has no valid start.
 *
 * @remarks
 * A range-typed item with no usable `end` is given `minimumDurationMs` so it stays
 * clickable; a point keeps zero duration (its `endMs` equals `startMs`).
 */
export function coerceItemToRange(
  item: Pick<TimelineItem, 'start' | 'end' | 'type'>,
  minimumDurationMs = DEFAULT_MIN_ITEM_DURATION_MS,
): TimelineRange | null {
  const startMs = normalizeDateInput(item.start);
  if (startMs == null) {
    return null;
  }

  const rawEnd = normalizeDateInput(item.end);
  const isRange = inferPointVsRange(item) === 'range';
  const endMs = rawEnd != null && rawEnd > startMs
    ? rawEnd
    : isRange
      ? startMs + minimumDurationMs
      : startMs;

  const safeEnd = Math.max(endMs, startMs);
  const durationMs = Math.max(safeEnd - startMs, 0);

  return {
    startMs,
    endMs: durationMs === 0 ? startMs : safeEnd,
    durationMs,
  };
}

/** Clips a range to the visible window, reporting whether either edge was cut off so the bar can show a clipped affordance. */
export function clampToVisibleRange(
  range: TimelineRange,
  visibleRange: TimelineRange,
): { range: TimelineRange; isClippedStart: boolean; isClippedEnd: boolean } {
  const startMs = Math.max(range.startMs, visibleRange.startMs);
  const endMs = Math.min(
    range.durationMs === 0 ? range.startMs : range.endMs,
    visibleRange.endMs,
  );

  return {
    range: {
      startMs,
      endMs,
      durationMs: Math.max(endMs - startMs, 0),
    },
    isClippedStart: range.startMs < visibleRange.startMs,
    isClippedEnd: range.endMs > visibleRange.endMs,
  };
}

/**
 * Computes a default visible range that fits all items and markers, with padding.
 *
 * @remarks
 * Falls back to a `fallbackDurationMs` window centered on now when there is no dated
 * content, so an empty timeline still renders a sensible axis.
 */
export function resolveTimelineBounds(
  items: ReadonlyArray<Pick<TimelineItem, 'start' | 'end' | 'type'>>,
  markerDates: ReadonlyArray<TimelineDateInput> = [],
  fallbackDurationMs = 6 * HOUR_MS,
): TimelineRange {
  const collected: number[] = [];

  items.forEach((item) => {
    const range = coerceItemToRange(item);
    if (!range) {
      return;
    }

    collected.push(range.startMs, range.durationMs === 0 ? range.startMs : range.endMs);
  });

  markerDates.forEach((markerDate) => {
    const markerMs = normalizeDateInput(markerDate);
    if (markerMs != null) {
      collected.push(markerMs);
    }
  });

  if (collected.length === 0) {
    const now = Date.now();
    return {
      startMs: now - fallbackDurationMs / 2,
      endMs: now + fallbackDurationMs / 2,
      durationMs: fallbackDurationMs,
    };
  }

  const min = Math.min(...collected);
  const max = Math.max(...collected);
  const span = Math.max(max - min, fallbackDurationMs / 4);
  const padding = Math.max(Math.round(span * 0.08), MINUTE_MS * 30);

  return {
    startMs: min - padding,
    endMs: max + padding,
    durationMs: max - min + padding * 2,
  };
}

/** Picks an axis scale unit to match a duration (minutes for hours-long spans up to months for very long ones), unless a non-`custom` unit is forced. */
export function resolveScaleUnit(
  durationMs: number,
  preferredScaleUnit: TimelineScaleUnit = 'custom',
): TimelineScaleUnit {
  if (preferredScaleUnit !== 'custom') {
    return preferredScaleUnit;
  }

  if (durationMs <= 3 * HOUR_MS) {
    return 'minute';
  }

  if (durationMs <= 3 * DAY_MS) {
    return 'hour';
  }

  if (durationMs <= 21 * DAY_MS) {
    return 'day';
  }

  if (durationMs <= 120 * DAY_MS) {
    return 'week';
  }

  return 'month';
}

/** Returns the pixels-per-unit config for a scale unit at a given zoom, clamping zoom to a safe 0.5–4× range. */
export function getScaleConfig(unit: TimelineScaleUnit, zoomLevel = 1): TimelineScale {
  const safeZoom = Math.max(0.5, Math.min(zoomLevel, 4));

  switch (unit) {
    case 'minute':
      return { unit, unitMs: MINUTE_MS, pixelsPerUnit: 18 * safeZoom };
    case 'hour':
      return { unit, unitMs: HOUR_MS, pixelsPerUnit: 120 * safeZoom };
    case 'day':
      return { unit, unitMs: DAY_MS, pixelsPerUnit: 180 * safeZoom };
    case 'week':
      return { unit, unitMs: WEEK_MS, pixelsPerUnit: 220 * safeZoom };
    case 'month':
      return { unit, unitMs: MONTH_APPROX_MS, pixelsPerUnit: 260 * safeZoom };
    case 'custom':
    default:
      return { unit: 'custom', unitMs: DAY_MS, pixelsPerUnit: 180 * safeZoom };
  }
}

/** Formats a tick timestamp with locale-aware detail appropriate to the scale (time of day for fine units, month/year for coarse ones). */
export function formatTimelineDate(valueMs: number, unit: TimelineScaleUnit): string {
  const date = new Date(valueMs);

  if (unit === 'minute' || unit === 'hour') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  if (unit === 'day' || unit === 'week') {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric',
  }).format(date);
}
