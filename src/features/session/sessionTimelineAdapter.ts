import { createElement } from 'react';
import type { TimelineDataset, TimelineItem, TimelineMarker, TimelineTrack } from '@/components/timeline';
import { DEFAULT_TIMELINE_TRACK_CATALOG } from '@/components/timeline/config/defaultTimelineTrackCatalog';
import { getNotesBySession } from '@/storage/repositories/noteRepository';
import * as entityLinkRepository from '@/storage/repositories/entityLinkRepository';
import type { Encounter } from '@/types/encounter';
import type { Note } from '@/types/note';
import type { Session } from '@/types/session';
import { CalendarClock, NotebookText, Swords } from 'lucide-react';
import { resolveSessionTimelineTrackKind } from './sessionTimelineConfig';

export interface SessionTimelineSourceData {
  notes: Note[];
  noteEncounterMap: Record<string, string>;
  parentEncounterMap: Record<string, string>;
}

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
    collapsible: catalogEntry.collapsible,
    colorToken: catalogEntry.colorToken,
    description: catalogEntry.description,
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

export async function loadSessionTimelineSourceData(
  sessionId: string,
  encounters: Encounter[],
): Promise<SessionTimelineSourceData> {
  const notes = (await getNotesBySession(sessionId)).filter((note) => note.status === 'active');
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

  const noteTrackKinds = [...new Set(
    timelineData.notes
      .filter((note) => !note.deletedAt && note.status === 'active')
      .map((note) => resolveSessionTimelineTrackKind(note)),
  )].sort((left, right) => {
    const leftOrder = DEFAULT_TIMELINE_TRACK_CATALOG[left]?.order ?? 99;
    const rightOrder = DEFAULT_TIMELINE_TRACK_CATALOG[right]?.order ?? 99;
    return leftOrder - rightOrder || left.localeCompare(right);
  });

  noteTrackKinds.forEach((kind) => {
    tracks.push(buildTrack(kind));
  });

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

      items.push({
        id: `note-${note.id}`,
        trackId: `track-${trackKind}`,
        title: note.title,
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
        icon: createElement(NotebookText, { className: 'h-3.5 w-3.5 text-text-muted' }),
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
