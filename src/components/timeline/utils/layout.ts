import type { TimelineRange, TimelineScaleUnit, TimelineTick } from '../types';
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  WEEK_MS,
  formatTimelineDate,
} from './date';

/** The major/minor gridline spacing (in ms) chosen for a given scale unit. */
interface TickPlan {
  majorStepMs: number;
  minorStepMs: number;
}

/** Picks sensible major/minor tick spacing for a scale unit (e.g. hours → major every 2h, minor every 30m). */
function getTickPlan(unit: TimelineScaleUnit): TickPlan {
  switch (unit) {
    case 'minute':
      return { majorStepMs: 15 * MINUTE_MS, minorStepMs: 5 * MINUTE_MS };
    case 'hour':
      return { majorStepMs: 2 * HOUR_MS, minorStepMs: 30 * MINUTE_MS };
    case 'day':
      return { majorStepMs: DAY_MS, minorStepMs: 6 * HOUR_MS };
    case 'week':
      return { majorStepMs: WEEK_MS, minorStepMs: DAY_MS };
    case 'month':
      return { majorStepMs: 30 * DAY_MS, minorStepMs: 7 * DAY_MS };
    case 'custom':
    default:
      return { majorStepMs: DAY_MS, minorStepMs: 6 * HOUR_MS };
  }
}

/** Rounds a timestamp down to the nearest multiple of `stepMs`, so ticks land on tidy boundaries. */
function alignTimestamp(valueMs: number, stepMs: number): number {
  return Math.floor(valueMs / stepMs) * stepMs;
}

/** Generates ticks at a fixed step across the visible range, positioned as percentages. */
function buildTicksForStep(
  visibleRange: TimelineRange,
  stepMs: number,
  unit: TimelineScaleUnit,
  isMajor: boolean,
): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const start = alignTimestamp(visibleRange.startMs, stepMs);

  for (let cursor = start; cursor <= visibleRange.endMs + stepMs; cursor += stepMs) {
    if (cursor < visibleRange.startMs || cursor > visibleRange.endMs) {
      continue;
    }

    ticks.push({
      valueMs: cursor,
      label: formatTimelineDate(cursor, unit),
      isMajor,
      leftPercent: ((cursor - visibleRange.startMs) / visibleRange.durationMs) * 100,
    });
  }

  return ticks;
}

/**
 * Builds the full set of axis ticks (major and minor) for the visible range.
 *
 * @remarks
 * Minor and major ticks are merged by timestamp with major winning, so a line that is
 * both never renders twice and always takes its major styling.
 */
export function getAxisTicks(
  visibleRange: TimelineRange,
  scaleUnit: TimelineScaleUnit,
): TimelineTick[] {
  const { majorStepMs, minorStepMs } = getTickPlan(scaleUnit);
  const majorTicks = buildTicksForStep(visibleRange, majorStepMs, scaleUnit, true);
  const minorTicks = buildTicksForStep(visibleRange, minorStepMs, scaleUnit, false);
  const tickMap = new Map<number, TimelineTick>();

  minorTicks.forEach((tick) => {
    tickMap.set(tick.valueMs, tick);
  });

  majorTicks.forEach((tick) => {
    tickMap.set(tick.valueMs, tick);
  });

  return [...tickMap.values()].sort((left, right) => left.valueMs - right.valueMs);
}

/** Computes an item's left/width in both pixels and percent of the timeline, enforcing a minimum width so zero-duration points stay visible. */
export function getItemPixelPosition(
  range: TimelineRange,
  visibleRange: TimelineRange,
  timelineWidth: number,
  minimumWidthPx = 12,
): { leftPx: number; widthPx: number; leftPercent: number; widthPercent: number } {
  const startOffset = Math.max(range.startMs - visibleRange.startMs, 0);
  const rawWidth = range.durationMs === 0
    ? minimumWidthPx
    : (range.durationMs / visibleRange.durationMs) * timelineWidth;

  const leftPx = (startOffset / visibleRange.durationMs) * timelineWidth;
  const widthPx = Math.max(rawWidth, minimumWidthPx);

  return {
    leftPx,
    widthPx,
    leftPercent: (leftPx / timelineWidth) * 100,
    widthPercent: (widthPx / timelineWidth) * 100,
  };
}

/** Ellipsizes a label to roughly fit `widthPx`, estimating ~7px per character with a small floor. */
export function truncateVisibleLabel(label: string, widthPx: number): string {
  const approximateCharacters = Math.max(Math.floor(widthPx / 7), 4);
  if (label.length <= approximateCharacters) {
    return label;
  }

  return `${label.slice(0, Math.max(approximateCharacters - 1, 3)).trimEnd()}...`;
}
