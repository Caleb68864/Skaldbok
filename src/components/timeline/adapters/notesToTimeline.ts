import type { Encounter } from '@/types/encounter';
import type { Note } from '@/types/note';
import type { Session } from '@/types/session';
import { DEFAULT_TIMELINE_TRACK_CATALOG } from '../config/defaultTimelineTrackCatalog';
import type { TimelineAdapter, TimelineDataset, TimelineItem, TimelineTrack } from '../types';

export interface BuildTimelineFromNotesInput {
  sessions?: Session[];
  encounters?: Encounter[];
  notes?: Note[];
}

export interface BuildTimelineFromNotesOptions {
  trackCatalog?: typeof DEFAULT_TIMELINE_TRACK_CATALOG;
  noteTrackResolver?: (note: Note) => string | null;
  noteDateResolver?: (note: Note) => { start?: string; end?: string; type?: TimelineItem['type'] } | null;
}

function toTrackId(kind: string): string {
  return `track-${kind}`;
}

function humanizeKind(kind: string): string {
  return kind
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildTrack(kind: string, catalog: typeof DEFAULT_TIMELINE_TRACK_CATALOG): TimelineTrack {
  const entry = catalog[kind] ?? catalog.generic;
  return {
    id: toTrackId(kind),
    label: entry.label ?? humanizeKind(kind),
    kind,
    order: entry.order ?? 99,
    visible: entry.visible ?? true,
    collapsible: entry.collapsible,
    description: entry.description,
    colorToken: entry.colorToken,
  };
}

function isActiveRecord(record: { deletedAt?: string }): boolean {
  return !record.deletedAt;
}

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

export const notesToTimelineAdapter: TimelineAdapter<BuildTimelineFromNotesInput> = {
  buildTimeline: (input) => buildTimelineFromNotesAdapter(input),
};
