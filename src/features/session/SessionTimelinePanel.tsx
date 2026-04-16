import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Layers3, NotebookText, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimelineRoot } from '@/components/timeline';
import type { TimelineFilterState, TimelineItem, TimelineTrack } from '@/components/timeline';
import type { Encounter } from '@/types/encounter';
import type { Session } from '@/types/session';
import {
  buildSessionTimelineDataset,
  loadSessionTimelineSourceData,
  type SessionTimelineSourceData,
} from './sessionTimelineAdapter';
import type { AttachToValue } from './quickActions/AttachToControl';

interface SessionTimelinePanelProps {
  session: Session;
  encounters: Encounter[];
  activeEncounter: Encounter | null;
  onStartEncounter: () => void;
  onOpenEncounter: (encounterId: string) => void;
  onReopenEncounter: (encounterId: string) => Promise<void> | void;
  onOpenNote: (noteId: string) => void;
  searchText?: string;
  onSearchTextChange?: (searchText: string) => void;
  onSelectionContextChange?: (context: { attachTo: AttachToValue; label: string | null }) => void;
  onAddToTimeline?: () => void;
  refreshToken?: number;
}

function humanizeLabel(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderTrackLabel(track: TimelineTrack) {
  if (track.kind === 'session') {
    return (
      <div>
        <span className="block truncate font-medium text-text">{track.label}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <CalendarClock className="h-3.5 w-3.5" />
          Overall session span
        </span>
      </div>
    );
  }

  if (track.kind === 'encounter') {
    return (
      <div>
        <span className="block truncate font-medium text-text">{track.label}</span>
        <span className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <Swords className="h-3.5 w-3.5" />
          Encounter beats
        </span>
      </div>
    );
  }

  return (
    <div>
      <span className="block truncate font-medium text-text">{track.label}</span>
      <span className="mt-1 flex items-center gap-2 text-xs text-text-muted">
        <NotebookText className="h-3.5 w-3.5" />
        Session log entries
      </span>
    </div>
  );
}

export function SessionTimelinePanel({
  session,
  encounters,
  activeEncounter,
  onStartEncounter,
  onOpenEncounter,
  onReopenEncounter,
  onOpenNote,
  searchText = '',
  onSearchTextChange,
  onSelectionContextChange,
  onAddToTimeline,
  refreshToken = 0,
}: SessionTimelinePanelProps) {
  const [timelineData, setTimelineData] = useState<SessionTimelineSourceData>({
    notes: [],
    noteEncounterMap: {},
    parentEncounterMap: {},
  });
  const [loading, setLoading] = useState(true);

  const encounterSignature = useMemo(
    () => encounters
      .map((encounter) => `${encounter.id}:${encounter.updatedAt}:${encounter.status}`)
      .sort()
      .join('|'),
    [encounters],
  );

  const encounterById = useMemo(
    () => new Map(encounters.map((encounter) => [encounter.id, encounter])),
    [encounters],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadTimelineData() {
      setLoading(true);
      try {
        const loadedData = await loadSessionTimelineSourceData(session.id, encounters);
        if (!cancelled) {
          setTimelineData(loadedData);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTimelineData().catch(() => {
      if (!cancelled) {
        setTimelineData({ notes: [], noteEncounterMap: {}, parentEncounterMap: {} });
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [encounterSignature, encounters, refreshToken, session.id]);

  const nowValue = session.endedAt ?? new Date().toISOString();

  const timelineDataset = useMemo(
    () => buildSessionTimelineDataset({
      session,
      encounters,
      timelineData,
      now: nowValue,
    }),
    [encounters, nowValue, session, timelineData],
  );

  const [timelineFilterState, setTimelineFilterState] = useState<TimelineFilterState>(() => ({
    visibleTrackIds: timelineDataset.tracks.filter((track) => track.visible).map((track) => track.id),
    hiddenTrackIds: timelineDataset.tracks.filter((track) => !track.visible).map((track) => track.id),
    includedKinds: [],
    excludedKinds: [],
    searchText,
    tagFilters: [],
    statusFilters: [],
  }));

  useEffect(() => {
    setTimelineFilterState((currentState) => {
      const nextVisibleTrackIds = timelineDataset.tracks
        .filter((track) => track.visible && !currentState.hiddenTrackIds.includes(track.id))
        .map((track) => track.id);
      const nextHiddenTrackIds = timelineDataset.tracks
        .filter((track) => !nextVisibleTrackIds.includes(track.id))
        .map((track) => track.id);

      const visibleUnchanged =
        nextVisibleTrackIds.length === currentState.visibleTrackIds.length &&
        nextVisibleTrackIds.every((trackId, index) => currentState.visibleTrackIds[index] === trackId);
      const hiddenUnchanged =
        nextHiddenTrackIds.length === currentState.hiddenTrackIds.length &&
        nextHiddenTrackIds.every((trackId, index) => currentState.hiddenTrackIds[index] === trackId);

      if (visibleUnchanged && hiddenUnchanged) {
        return currentState;
      }

      return {
        ...currentState,
        visibleTrackIds: nextVisibleTrackIds,
        hiddenTrackIds: nextHiddenTrackIds,
      };
    });
  }, [timelineDataset.tracks]);

  const handleNavigateToSource = useCallback((item: TimelineItem) => {
    if (item.sourceType === 'encounter' && item.sourceId) {
      onOpenEncounter(item.sourceId);
      return;
    }

    if (item.noteId) {
      onOpenNote(item.noteId);
    }
  }, [onOpenEncounter, onOpenNote]);

  useEffect(() => {
    if (timelineFilterState.searchText === searchText) {
      return;
    }

    setTimelineFilterState((currentState) => ({ ...currentState, searchText }));
  }, [searchText, timelineFilterState]);

  const handleFilterStateChange = useCallback((nextState: TimelineFilterState) => {
    setTimelineFilterState(nextState);
    onSearchTextChange?.(nextState.searchText);
  }, [onSearchTextChange]);

  const handleTimelineItemSelect = useCallback((item: TimelineItem) => {
    if (!onSelectionContextChange) {
      return;
    }

    if (item.sourceType === 'encounter' && item.sourceId) {
      onSelectionContextChange({ attachTo: item.sourceId, label: item.title });
      return;
    }

    if (item.sourceType === 'session') {
      onSelectionContextChange({ attachTo: null, label: session.title });
      return;
    }

    const encounterId = typeof item.metadata?.encounterId === 'string'
      ? item.metadata.encounterId
      : null;

    onSelectionContextChange({
      attachTo: encounterId,
      label: encounterId ? `${item.title} (${item.metadata?.encounterTitle ?? 'Encounter'})` : session.title,
    });
  }, [onSelectionContextChange, session.title]);

  const handleTimelineTrackSelect = useCallback((track: TimelineTrack) => {
    if (!onSelectionContextChange) {
      return;
    }

    if (track.kind === 'encounter') {
      onSelectionContextChange({
        attachTo: activeEncounter?.id ?? 'auto',
        label: activeEncounter?.title ?? 'active encounter',
      });
      return;
    }

    onSelectionContextChange({
      attachTo: null,
      label: track.label,
    });
  }, [activeEncounter?.id, activeEncounter?.title, onSelectionContextChange]);

  const renderItemDetails = useCallback((item: TimelineItem) => {
    if (item.sourceType === 'encounter' && item.sourceId) {
      const encounter = encounterById.get(item.sourceId);
      if (!encounter) {
        return null;
      }

      const parentEncounterId = typeof item.metadata?.parentEncounterId === 'string'
        ? item.metadata.parentEncounterId
        : undefined;
      const parentEncounter = parentEncounterId ? encounterById.get(parentEncounterId) : undefined;

      return (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Encounter</p>
            <p className="mt-1 text-sm text-text">
              {encounter.type} · {encounter.participants.length} participant{encounter.participants.length === 1 ? '' : 's'}
            </p>
            {encounter.location ? <p className="mt-1 text-sm text-text-muted">{encounter.location}</p> : null}
            {parentEncounter ? (
              <p className="mt-1 text-sm text-text-muted">Occurred during {parentEncounter.title}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenEncounter(encounter.id)}>
              Open Encounter
            </Button>
            {encounter.status === 'ended' ? (
              <Button type="button" variant="outline" onClick={() => void onReopenEncounter(encounter.id)}>
                Reopen Encounter
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (item.noteId) {
      const noteId = item.noteId;
      const noteEncounterTitle = typeof item.metadata?.encounterTitle === 'string'
        ? item.metadata.encounterTitle
        : undefined;

      return (
        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Note</p>
            <p className="mt-1 text-sm text-text">{humanizeLabel(item.kind ?? 'note')}</p>
            {noteEncounterTitle ? (
              <p className="mt-1 text-sm text-text-muted">Attached to {noteEncounterTitle}</p>
            ) : (
              <p className="mt-1 text-sm text-text-muted">Logged at the session level</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onOpenNote(noteId)}>
              Open Note
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-[var(--radius-md)] border border-border bg-surface-alt p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Session</p>
        <p className="mt-1 text-sm text-text">Use this row to see the overall play window for the session.</p>
      </div>
    );
  }, [encounterById, onOpenEncounter, onOpenNote, onReopenEncounter]);

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-border bg-surface/80 p-4 texture-card-bevel">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <Layers3 className="h-4 w-4 text-accent" />
            Session Timeline
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Follow the session arc, encounters, and quick-log notes in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeEncounter ? (
            <Button type="button" variant="outline" onClick={() => onOpenEncounter(activeEncounter.id)}>
              Open Active Encounter
            </Button>
          ) : null}
          <Button type="button" onClick={onStartEncounter}>
            Start Encounter
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface-alt/60 px-4 py-10 text-sm text-text-muted">
          Building session timeline...
        </div>
      ) : (
        <TimelineRoot
          tracks={timelineDataset.tracks}
          items={timelineDataset.items}
          markers={timelineDataset.markers}
          toolbarTitle="Timeline Workspace"
          filterState={timelineFilterState}
          onFilterStateChange={handleFilterStateChange}
          renderTrackLabel={renderTrackLabel}
          renderItemDetails={renderItemDetails}
          onNavigateToSource={handleNavigateToSource}
          onItemSelect={handleTimelineItemSelect}
          onTrackSelect={handleTimelineTrackSelect}
          onAddItem={onAddToTimeline}
          addItemLabel="Add to Timeline"
          emptyStateTitle="No timeline entries yet"
          emptyStateDescription="Start an encounter or log a note to build the session timeline."
          showNowMarker={!session.endedAt}
          now={nowValue}
        />
      )}
    </section>
  );
}
