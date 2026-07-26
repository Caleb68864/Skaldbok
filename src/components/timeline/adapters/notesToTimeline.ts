import type { Encounter } from '@/types/encounter';
import type { Note } from '@/types/note';
import type { Session } from '@/types/session';
import { DEFAULT_TIMELINE_TRACK_CATALOG } from '../config/defaultTimelineTrackCatalog';
import type { TimelineAdapter, TimelineDataset, TimelineItem, TimelineTrack } from '../types';

/** Domain records to plot: sessions, encounters, and notes for the active campaign. */
export interface BuildTimelineFromNotesInput {
  sessions?: Session[];
  encounters?: Encounter[];
  notes?: Note[];
}

/**
 * Overrides for the notes→timeline mapping.
 *
 * @remarks
 * Per the "configuration over hardcoding" rule, which note types cluster into which
 * track comes from a catalog rather than the adapter body — `trackCatalog` swaps it,
 * and the resolvers let a caller override how a note maps to a track or a date range.
 */
export interface BuildTimelineFromNotesOptions {
  trackCatalog?: typeof DEFAULT_TIMELINE_TRACK_CATALOG;
  noteTrackResolver?: (note: Note) => string | null;
  noteDateResolver?: (note: Note) => { start?: string; end?: string; type?: TimelineItem['type'] } | null;
}

/** Builds a track id from a kind (`session` → `track-session`). */
function toTrackId(kind: string): string {
  return `track-${kind}`;
}

/** Turns a kebab/snake kind into a Title-Cased label for tracks the catalog doesn't name. */
function humanizeKind(kind: string): string {
  return kind
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Constructs a {@link TimelineTrack} for a kind from its catalog entry, falling back to the `generic` entry and a humanized label. */
function buildTrack(kind: string, catalog: typeof DEFAULT_TIMELINE_TRACK_CATALOG): TimelineTrack {
  const entry = catalog[kind] ?? catalog.generic;
  return {
    id: toTrackId(kind),
    // Use the catalog label only for a kind that IS in the catalog; an unknown
    // kind falls back to the generic entry for styling but must get a humanized
    // label — otherwise every unknown type renders as a duplicate "Notes" lane
    // (the generic entry's own label), indistinguishable from each other.
    label: catalog[kind]?.label ?? humanizeKind(kind),
    kind,
    order: entry.order ?? 99,
    visible: entry.visible ?? true,
    collapsible: entry.collapsible,
    description: entry.description,
    colorToken: entry.colorToken,
  };
}

/** Soft-delete guard: excludes rows carrying a `deletedAt`, so deleted entities never reach the timeline. */
function isActiveRecord(record: { deletedAt?: string }): boolean {
  return !record.deletedAt;
}

/** Derives an encounter's time span from its segments: earliest start to latest end (a point when the last segment is still open). */
function getEncounterRange(encounter: Encounter): { start: string; end?: string; type: TimelineItem['type'] } | null {
  if (encounter.segments.length === 0) {
    return null;
  }

  const orderedSegments = [...encounter.segments].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const first = orderedSegments[0];
  const last = orderedSegments[orderedSegments.length - 1];

  return {
    start: first.startedAt,
    end: last.endedAt,
    type: last.endedAt ? 'range' : 'point',
  };
}

/**
 * Maps campaign sessions, encounters, and notes into a {@link TimelineDataset}.
 *
 * @remarks
 * The Skaldbok-specific {@link TimelineAdapter} that feeds {@link TimelineRoot}. Tracks
 * are created lazily as kinds are encountered, so only kinds that actually have items
 * produce a lane. Each item keeps `sourceId`/`sourceType` (and `noteId` for notes) so
 * the details panel can navigate back to the underlying record. Soft-deleted rows are
 * filtered out via {@link isActiveRecord}.
 */
export function buildTimelineFromNotesAdapter(
  input: BuildTimelineFromNotesInput,
  options: BuildTimelineFromNotesOptions = {},
): TimelineDataset {
  const catalog = options.trackCatalog ?? DEFAULT_TIMELINE_TRACK_CATALOG;
  const tracksByKind = new Map<string, TimelineTrack>();
  const items: TimelineItem[] = [];

  const ensureTrack = (kind: string) => {
    if (!tracksByKind.has(kind)) {
      tracksByKind.set(kind, buildTrack(kind, catalog));
    }

    return tracksByKind.get(kind)!;
  };

  input.sessions?.filter(isActiveRecord).forEach((session) => {
    const track = ensureTrack('session');
    items.push({
      id: `session-${session.id}`,
      trackId: track.id,
      title: session.title,
      subtitle: session.date,
      start: session.startedAt,
      end: session.endedAt,
      type: session.endedAt ? 'range' : 'point',
      kind: 'session',
      status: session.status,
      sourceId: session.id,
      sourceType: 'session',
      colorToken: track.colorToken,
      variant: 'accent',
    });
  });

  input.encounters?.filter(isActiveRecord).forEach((encounter) => {
    const range = getEncounterRange(encounter);
    if (!range) {
      return;
    }

    const track = ensureTrack('encounter');
    items.push({
      id: `encounter-${encounter.id}`,
      trackId: track.id,
      title: encounter.title,
      subtitle: encounter.location,
      start: range.start,
      end: range.end,
      type: range.type,
      kind: encounter.type,
      status: encounter.status,
      sourceId: encounter.id,
      sourceType: 'encounter',
      colorToken: track.colorToken,
      variant: encounter.type === 'combat' ? 'danger' : 'default',
      tags: encounter.tags,
    });
  });

  input.notes?.filter(isActiveRecord).forEach((note) => {
    const resolvedKind = options.noteTrackResolver?.(note) ?? note.type ?? 'generic';
    if (!resolvedKind) {
      return;
    }

    const track = ensureTrack(resolvedKind);
    const resolvedDate = options.noteDateResolver?.(note) ?? {
      start: note.createdAt,
      end: note.updatedAt !== note.createdAt ? note.updatedAt : undefined,
      type: note.updatedAt !== note.createdAt ? 'range' : 'milestone',
    };

    if (!resolvedDate?.start) {
      return;
    }

    items.push({
      id: `note-${note.id}`,
      trackId: track.id,
      title: note.title,
      subtitle: note.type,
      start: resolvedDate.start,
      end: resolvedDate.end,
      type: resolvedDate.type ?? 'milestone',
      kind: note.type,
      status: note.status,
      sourceId: note.id,
      sourceType: 'note',
      noteId: note.id,
      colorToken: track.colorToken,
      tags: note.tags,
      variant: note.type === 'combat' ? 'danger' : 'default',
    });
  });

  return {
    tracks: [...tracksByKind.values()].sort((left, right) => left.order - right.order),
    items,
    markers: [],
  };
}

/** The {@link TimelineAdapter} wrapper around {@link buildTimelineFromNotesAdapter} for use with the default options. */
export const notesToTimelineAdapter: TimelineAdapter<BuildTimelineFromNotesInput> = {
  buildTimeline: (input) => buildTimelineFromNotesAdapter(input),
};
