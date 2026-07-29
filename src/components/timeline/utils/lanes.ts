import type { TimelineItem } from '../types';
import { coerceItemToRange, DEFAULT_MIN_ITEM_DURATION_MS } from './date';

/** An item's assigned lane within its track, plus the track's total lane count. */
export interface TimelineLaneAssignment {
  item: TimelineItem;
  lane: number;
  laneCount: number;
}

/**
 * Packs a track's items into the fewest non-overlapping horizontal lanes.
 *
 * @remarks
 * A greedy interval-scheduling sweep: items are sorted by start (ties broken by
 * longer-first, then original order for stability) and each is dropped into the first
 * lane whose previous item has already ended, opening a new lane only when none is
 * free. Items with an unparseable date are dropped. Every returned assignment carries
 * the same final `laneCount` so the caller can size the row in one pass.
 *
 * Zero-duration points are given a `minimumDurationMs` **collision footprint** for
 * lane assignment only — their rendered position and width are unaffected. Treating a
 * point as ending exactly at its start made the free-lane test
 * (`startMs >= laneEndTime`) trivially true for any non-decreasing sequence, so every
 * point landed on lane 0 no matter how close together. A session's 60-100 log markers
 * therefore stacked on one row, and since a marker is wider than the gap between
 * adjacent entries, all but the topmost were unhoverable and unclickable.
 */
export function computeTrackLanesForOverlap(
  items: ReadonlyArray<TimelineItem>,
  minimumDurationMs = DEFAULT_MIN_ITEM_DURATION_MS,
): TimelineLaneAssignment[] {
  /** End of an item's collision footprint — points get a minimum width, ranges use their own. */
  const collisionEnd = (range: { startMs: number; endMs: number; durationMs: number }): number =>
    range.durationMs === 0 ? range.startMs + minimumDurationMs : range.endMs;

  const sorted = [...items]
    .map((item, index) => ({
      item,
      index,
      range: coerceItemToRange(item, minimumDurationMs),
    }))
    .filter((entry): entry is { item: TimelineItem; index: number; range: NonNullable<typeof entry.range> } => entry.range != null)
    .sort((left, right) => {
      if (left.range.startMs !== right.range.startMs) {
        return left.range.startMs - right.range.startMs;
      }

      const leftEnd = collisionEnd(left.range);
      const rightEnd = collisionEnd(right.range);
      if (leftEnd !== rightEnd) {
        return rightEnd - leftEnd;
      }

      // Original array order, not `id.localeCompare`. Ids are random uuids, so
      // sorting by them rendered same-millisecond entries — ordinary when
      // committing quickly — in an order that contradicted the log.
      return left.index - right.index;
    });

  const laneEndTimes: number[] = [];
  const assignments: Array<{ item: TimelineItem; lane: number }> = [];

  sorted.forEach(({ item, range }) => {
    const itemEnd = collisionEnd(range);
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
