import type { TimelineRange, TimelineScaleUnit, TimelineTick } from '../types';
import {
  DAY_MS,
  HOUR_MS,
  MINUTE_MS,
  WEEK_MS,
  formatTimelineDate,
} from './date';

interface TickPlan {
  majorStepMs: number;
  minorStepMs: number;
}

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

function alignTimestamp(valueMs: number, stepMs: number): number {
  return Math.floor(valueMs / stepMs) * stepMs;
}

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

export function truncateVisibleLabel(label: string, widthPx: number): string {
  const approximateCharacters = Math.max(Math.floor(widthPx / 7), 4);
  if (label.length <= approximateCharacters) {
    return label;
  }

  return `${label.slice(0, Math.max(approximateCharacters - 1, 3)).trimEnd()}...`;
}
