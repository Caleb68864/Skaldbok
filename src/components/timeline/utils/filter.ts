import type {
  TimelineAvailableFilters,
  TimelineFilterState,
  TimelineItem,
  TimelineRange,
  TimelineTrack,
} from '../types';
import { coerceItemToRange, DEFAULT_MIN_ITEM_DURATION_MS } from './date';

export function sortTracks(tracks: ReadonlyArray<TimelineTrack>): TimelineTrack[] {
  return [...tracks].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
  });
}

export function groupItemsByTrack(items: ReadonlyArray<TimelineItem>): Record<string, TimelineItem[]> {
  return items.reduce<Record<string, TimelineItem[]>>((accumulator, item) => {
    if (!accumulator[item.trackId]) {
      accumulator[item.trackId] = [];
    }

    accumulator[item.trackId].push(item);
    return accumulator;
  }, {});
}

export function filterItems(
  items: ReadonlyArray<TimelineItem>,
  filterState: TimelineFilterState,
  activeTrackIds?: ReadonlyArray<string>,
): TimelineItem[] {
  const visibleTrackIds = new Set(
    (activeTrackIds?.length ? activeTrackIds : filterState.visibleTrackIds).filter(Boolean),
  );
  const excludedTrackIds = new Set(filterState.hiddenTrackIds);
  const includedKinds = new Set(filterState.includedKinds);
  const excludedKinds = new Set(filterState.excludedKinds);
  const tagFilters = new Set(filterState.tagFilters.map((tag) => tag.toLowerCase()));
  const statusFilters = new Set((filterState.statusFilters ?? []).map((status) => status.toLowerCase()));
  const searchText = filterState.searchText.trim().toLowerCase();

  return items.filter((item) => {
    if (visibleTrackIds.size > 0 && !visibleTrackIds.has(item.trackId)) {
      return false;
    }

    if (excludedTrackIds.has(item.trackId)) {
      return false;
    }

    const semanticKind = item.kind ?? item.sourceType ?? item.type;
    if (includedKinds.size > 0 && !includedKinds.has(semanticKind)) {
      return false;
    }

    if (excludedKinds.has(semanticKind)) {
      return false;
    }

    if (tagFilters.size > 0) {
      const itemTags = new Set((item.tags ?? []).map((tag) => tag.toLowerCase()));
      const matchesTag = [...tagFilters].every((tag) => itemTags.has(tag));
      if (!matchesTag) {
        return false;
      }
    }

    if (statusFilters.size > 0) {
      const status = item.status?.toLowerCase();
      if (!status || !statusFilters.has(status)) {
        return false;
      }
    }

    if (!searchText) {
      return true;
    }

    const haystack = [
      item.title,
      item.subtitle,
      item.tooltip,
      item.kind,
      item.status,
      item.sourceType,
      ...(item.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(searchText);
  });
}

export function computeVisibleItems(
  items: ReadonlyArray<TimelineItem>,
  visibleRange: TimelineRange,
): TimelineItem[] {
  return items.filter((item) => {
    const range = coerceItemToRange(item, DEFAULT_MIN_ITEM_DURATION_MS);
    if (!range) {
      return false;
    }

    const itemEnd = range.durationMs === 0 ? range.startMs : range.endMs;
    return itemEnd >= visibleRange.startMs && range.startMs <= visibleRange.endMs;
  });
}

export function collectAvailableFilters(items: ReadonlyArray<TimelineItem>): TimelineAvailableFilters {
  const kinds = new Set<string>();
  const statuses = new Set<string>();
  const tags = new Set<string>();

  items.forEach((item) => {
    const kind = item.kind ?? item.sourceType;
    if (kind) {
      kinds.add(kind);
    }

    if (item.status) {
      statuses.add(item.status);
    }

    item.tags?.forEach((tag) => tags.add(tag));
  });

  return {
    kinds: [...kinds].sort((left, right) => left.localeCompare(right)),
    statuses: [...statuses].sort((left, right) => left.localeCompare(right)),
    tags: [...tags].sort((left, right) => left.localeCompare(right)),
  };
}
