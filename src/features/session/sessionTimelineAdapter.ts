import { createElement } from 'react';
import type { TimelineDataset, TimelineItem, TimelineMarker, TimelineTrack } from '@/components/timeline';
import { DEFAULT_TIMELINE_TRACK_CATALOG } from '@/components/timeline/config/defaultTimelineTrackCatalog';
import { getNotesBySession } from '@/storage/repositories/noteRepository';
import * as entityLinkRepository from '@/storage/repositories/entityLinkRepository';
import type { Encounter } from '@/types/encounter';
import type { Note } from '@/types/note';
import type { Session } from '@/types/session';
import { CalendarClock, Swords } from 'lucide-react';
import { resolveSessionTimelineTrackKind, NOTE_CHILD_TRACK_KINDS } from './sessionTimelineConfig';
import { sessionTimelineIcon } from './sessionTimelineIcons';
import { docToText } from '@/features/notes/textToDoc';

const LOG_LABEL_MAX_LENGTH = 60;

/** Derives a timeline item label for a `type: 'log'` note from its body, truncated to 60 chars. */
function deriveLogItemLabel(note: Note): string {
  const text = docToText(note.body).trim().replace(/\s+/g, ' ');
  if (!text) {
    return '(empty entry)';
  }
  return text.length > LOG_LABEL_MAX_LENGTH ? `${text.slice(0, LOG_LABEL_MAX_LENGTH)}…` : text;
}

/**
 * Pre-resolved data the timeline builder needs, gathered from the repositories.
 *
 * @remarks
 * The encounter maps are derived from `entityLinks` (`contains` and
 * `happened_during`) so the pure {@link buildSessionTimelineDataset} does no I/O.
 */
export interface SessionTimelineSourceData {
  notes: Note[];
  /** Note id → the encounter that logged it (its `contains` parent). */
  noteEncounterMap: Record<string, string>;
  /** Encounter id → the encounter it happened during (soft parent link). */
  parentEncounterMap: Record<string, string>;
}

/** Inputs to {@link buildSessionTimelineDataset}; `now` defaults to the session end or the current time. */
export interface BuildSessionTimelineDatasetInput {
  session: Session;
  encounters: Encounter[];
  timelineData: SessionTimelineSourceData;
  now?: string;
}

function humanizeLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildTrack(kind: string): TimelineTrack {
  const catalogEntry = DEFAULT_TIMELINE_TRACK_CATALOG[kind] ?? DEFAULT_TIMELINE_TRACK_CATALOG.generic;

  return {
    id: `track-${kind}`,
    label: catalogEntry.label ?? humanizeLabel(kind),
    kind: catalogEntry.kind ?? kind,
    order: catalogEntry.order ?? 99,
    visible: catalogEntry.visible ?? true,
    defaultHidden: catalogEntry.defaultHidden,
    collapsible: catalogEntry.collapsible,
    collapsed: catalogEntry.collapsed,
    colorToken: catalogEntry.colorToken,
    description: catalogEntry.description,
    parentTrackId: catalogEntry.parentTrackId,
    icon: sessionTimelineIcon(catalogEntry.kind ?? kind),
  };
}

function getEncounterBounds(
  encounter: Encounter,
  fallbackEnd: string,
): { start: string; end: string; type: TimelineItem['type'] } | null {
  if (encounter.deletedAt || encounter.segments.length === 0) {
    return null;
  }

  const orderedSegments = [...encounter.segments].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const first = orderedSegments[0];
  const last = orderedSegments[orderedSegments.length - 1];

  return {
    start: first.startedAt,
    end: last.endedAt ?? fallbackEnd,
    type: 'range',
  };
}

function getNoteVariant(note: Note): TimelineItem['variant'] {
  switch (note.type) {
    case 'npc':
      return 'accent';
    case 'rumor':
      return 'warning';
    case 'loot':
      return 'success';
    default:
      return 'default';
  }
}

/**
 * Loads the active notes and encounter-link maps a session timeline needs.
 *
 * @remarks
 * The I/O half of the adapter: resolves the note→encounter (`contains`) and
 * encounter→parent (`happened_during`) relationships from `entityLinks` so the
 * builder stays pure and synchronous. Only active, non-deleted rows are included.
 */
export async function loadSessionTimelineSourceData(
  sessionId: string,
  encounters: Encounter[],
): Promise<SessionTimelineSourceData> {
  const notes = (await getNotesBySession(sessionId)).filter(
    (note) => note.status === 'active',
  );
  const activeEncounters = encounters.filter((encounter) => !encounter.deletedAt);

  const containsLinksByEncounter = await Promise.all(
    activeEncounters.map(async (encounter) => ({
      encounterId: encounter.id,
      links: await entityLinkRepository.getLinksFrom(encounter.id, 'contains'),
    })),
  );

  const parentLinksByEncounter = await Promise.all(
    activeEncounters.map(async (encounter) => ({
      encounterId: encounter.id,
      links: await entityLinkRepository.getLinksFrom(encounter.id, 'happened_during'),
    })),
  );

  const noteEncounterMap: Record<string, string> = {};
  containsLinksByEncounter.forEach(({ encounterId, links }) => {
    links
      .filter((link) => link.toEntityType === 'note')
      .forEach((link) => {
        noteEncounterMap[link.toEntityId] ??= encounterId;
      });
  });

  const parentEncounterMap: Record<string, string> = {};
  parentLinksByEncounter.forEach(({ encounterId, links }) => {
    const parentLink = links.find((link) => link.toEntityType === 'encounter');
    if (parentLink) {
      parentEncounterMap[encounterId] = parentLink.toEntityId;
    }
  });

  return { notes, noteEncounterMap, parentEncounterMap };
}

/**
 * Assembles the tracks, items, and markers for a session's timeline view.
 *
 * @remarks
 * Pure and synchronous — all data access happens up front in
 * {@link loadSessionTimelineSourceData}. Note child tracks are always emitted
 * (even when empty) so the Notes hierarchy is visible before anything is logged,
 * while `npc` stays a top-level sibling and encounters render as ranges spanning
 * their segments. An open segment extends to `now`.
 */
export function buildSessionTimelineDataset({
  session,
  encounters,
  timelineData,
  now,
}: BuildSessionTimelineDatasetInput): TimelineDataset {
  const nowValue = now ?? session.endedAt ?? new Date().toISOString();
  const tracks: TimelineTrack[] = [buildTrack('session'), buildTrack('encounter')];
  const items: TimelineItem[] = [];
  const markers: TimelineMarker[] = [
    {
      id: `session-start-${session.id}`,
      label: 'Start',
      at: session.startedAt,
      kind: 'session-start',
      colorToken: '--color-gold',
    },
  ];

  if (session.endedAt) {
    markers.push({
      id: `session-end-${session.id}`,
      label: 'End',
      at: session.endedAt,
      kind: 'session-end',
      colorToken: '--color-border',
    });
  }

  // Assemble note-bucket tracks. We always emit the `notes` parent + every
  // child kind from NOTE_CHILD_TRACK_KINDS so the hierarchy is visible even
  // before the user has logged anything of that type. The `npc` track is
  // kept as a top-level sibling (not under Notes) per the default catalog.
  const activeNotes = timelineData.notes.filter((note) => !note.deletedAt && note.status === 'active');
  const noteTrackKinds = new Set(activeNotes.map((note) => resolveSessionTimelineTrackKind(note)));

  tracks.push(buildTrack('notes'));
  for (const childKind of NOTE_CHILD_TRACK_KINDS) {
    tracks.push(buildTrack(childKind));
  }
  // `npc` and `log` are first-class top-level tracks — add only if notes of
  // that kind exist. `log` starts switched off via `defaultHidden` in the
  // catalog (deliberately **not** `visible: false`, which would make the lane
  // permanently unreachable — see TimelineTrack.defaultHidden); the track
  // filter reveals it. Neither belongs in NOTE_CHILD_TRACK_KINDS.
  if (noteTrackKinds.has('npc')) {
    tracks.push(buildTrack('npc'));
  }
  if (noteTrackKinds.has('log')) {
    tracks.push(buildTrack('log'));
  }

  items.push({
    id: `session-${session.id}`,
    trackId: 'track-session',
    title: session.title,
    subtitle: session.date,
    start: session.startedAt,
    end: session.endedAt ?? nowValue,
    type: 'range',
    kind: 'session',
    status: session.status,
    sourceId: session.id,
    sourceType: 'session',
    variant: 'accent',
    colorToken: '--color-gold',
    icon: createElement(CalendarClock, { className: 'h-3.5 w-3.5 text-text-muted' }),
    metadata: {
      date: session.date,
    },
  });

  const encounterById = new Map(encounters.map((encounter) => [encounter.id, encounter]));

  encounters.forEach((encounter) => {
    const bounds = getEncounterBounds(encounter, nowValue);
    if (!bounds) {
      return;
    }

    const parentEncounterId = timelineData.parentEncounterMap[encounter.id];
    const parentEncounter = parentEncounterId ? encounterById.get(parentEncounterId) : undefined;
    const subtitleParts = [
      encounter.location,
      parentEncounter ? `During ${parentEncounter.title}` : undefined,
    ].filter(Boolean);

    items.push({
      id: `encounter-${encounter.id}`,
      trackId: 'track-encounter',
      title: encounter.title,
      subtitle: subtitleParts.join(' · ') || encounter.type,
      start: bounds.start,
      end: bounds.end,
      type: bounds.type,
      kind: encounter.type,
      status: encounter.status,
      sourceId: encounter.id,
      sourceType: 'encounter',
      tags: encounter.tags,
      variant: encounter.status === 'active'
        ? 'warning'
        : encounter.type === 'combat'
          ? 'danger'
          : 'default',
      colorToken: '--color-danger',
      icon: createElement(Swords, { className: 'h-3.5 w-3.5 text-text-muted' }),
      metadata: {
        location: encounter.location,
        participantCount: encounter.participants.length,
        parentEncounterId,
        parentEncounterTitle: parentEncounter?.title,
      },
    });
  });

  timelineData.notes
    .filter((note) => !note.deletedAt && note.status === 'active')
    .forEach((note) => {
      const noteEncounterId = timelineData.noteEncounterMap[note.id];
      const noteEncounter = noteEncounterId ? encounterById.get(noteEncounterId) : undefined;
      const trackKind = resolveSessionTimelineTrackKind(note);
      const title = note.type === 'log' ? deriveLogItemLabel(note) : note.title;

      items.push({
        id: `note-${note.id}`,
        trackId: `track-${trackKind}`,
        title,
        subtitle: noteEncounter ? `${humanizeLabel(note.type)} · ${noteEncounter.title}` : humanizeLabel(note.type),
        start: note.createdAt,
        type: 'milestone',
        kind: note.type,
        status: note.status,
        sourceId: note.id,
        sourceType: 'note',
        noteId: note.id,
        tags: note.tags,
        variant: getNoteVariant(note),
        icon: sessionTimelineIcon(trackKind),
        metadata: {
          encounterId: noteEncounterId,
          encounterTitle: noteEncounter?.title,
          createdAt: note.createdAt,
        },
      });
    });

  return {
    tracks: tracks.sort((left, right) => left.order - right.order),
    items,
    markers,
  };
}
