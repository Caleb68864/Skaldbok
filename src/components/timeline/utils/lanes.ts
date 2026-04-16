import type { TimelineItem } from '../types';
import { coerceItemToRange, DEFAULT_MIN_ITEM_DURATION_MS } from './date';

export interface TimelineLaneAssignment {
  item: TimelineItem;
  lane: number;
  laneCount: number;
}

export function computeTrackLanesForOverlap(
  items: ReadonlyArray<TimelineItem>,
  minimumDurationMs = DEFAULT_MIN_ITEM_DURATION_MS,
): TimelineLaneAssignment[] {
  const sorted = [...items]
    .map((item) => ({
      item,
      range: coerceItemToRange(item, minimumDurationMs),
    }))
    .filter((entry): entry is { item: TimelineItem; range: NonNullable<typeof entry.range> } => entry.range != null)
    .sort((left, right) => {
      if (left.range.startMs !== right.range.startMs) {
        return left.range.startMs - right.range.startMs;
      }

      const leftEnd = left.range.durationMs === 0 ? left.range.startMs : left.range.endMs;
      const rightEnd = right.range.durationMs === 0 ? right.range.startMs : right.range.endMs;
      if (leftEnd !== rightEnd) {
        return rightEnd - leftEnd;
      }

      return left.item.id.localeCompare(right.item.id);
    });

  const laneEndTimes: number[] = [];
  const assignments: Array<{ item: TimelineItem; lane: number }> = [];

  sorted.forEach(({ item, range }) => {
    const itemEnd = range.durationMs === 0 ? range.startMs : range.endMs;
    let laneIndex = laneEndTimes.findIndex((laneEndTime) => range.startMs >= laneEndTime);

    if (laneIndex === -1) {
      laneIndex = laneEndTimes.length;
      laneEndTimes.push(itemEnd);
    } else {
      laneEndTimes[laneIndex] = itemEnd;
    }

    assignments.push({ item, lane: laneIndex });
  });

  const laneCount = Math.max(laneEndTimes.length, 1);
  return assignments.map((assignment) => ({ ...assignment, laneCount }));
}
