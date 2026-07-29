import type { TimelineTrack } from '../types';

/** The catalog-level shape of a track: its identity/order/visibility plus optional presentation and nesting hints. */
export type TimelineTrackCatalogEntry = Pick<
  TimelineTrack,
  'label' | 'kind' | 'order' | 'visible'
> &
  Partial<
    Pick<
      TimelineTrack,
      'collapsible' | 'collapsed' | 'colorToken' | 'description' | 'parentTrackId' | 'defaultHidden'
    >
  >;

/**
 * Default mapping of note/entity kind → timeline track (label, order, color, nesting).
 *
 * @remarks
 * This is the out-of-the-box grouping the "configuration over hardcoding" rule calls
 * for: which kinds cluster into which lane lives here, not inside
 * {@link components/timeline/adapters/notesToTimeline!buildTimelineFromNotesAdapter | buildTimelineFromNotesAdapter}, so it can be overridden per call (and later
 * surfaced as a user preference). Kinds with no entry fall back to `generic`.
 */
export const DEFAULT_TIMELINE_TRACK_CATALOG: Record<string, TimelineTrackCatalogEntry> = {
  session: {
    label: 'Session',
    kind: 'session',
    order: 0,
    visible: true,
    collapsible: false,
    colorToken: '--color-gold',
  },
  encounter: {
    label: 'Encounters',
    kind: 'encounter',
    order: 1,
    visible: true,
    collapsible: true,
    colorToken: '--color-danger',
  },
  // Top-level, sibling of Encounters/NPCs — not nested under Notes, because a
  // collapsed `notes` parent aggregates every descendant's items onto its row
  // (`useTimelineLayout.ts`), which would bury promoted notes under the raw
  // capture.
  //
  // `defaultHidden`, not `visible: false`: a session's worth of raw entries
  // should not clutter the default view, but the lane must stay switchable.
  // `visible: false` means "never render" here — `useTimelineLayout` drops the
  // row and `toggleTrack` won't move it into `visibleTrackIds` — so it would
  // make the lane permanently unreachable. `collapsed` is no use either: it
  // only hides *children*, and this is a leaf.
  log: {
    label: 'Log',
    kind: 'log',
    order: 1.5,
    visible: true,
    defaultHidden: true,
    collapsible: true,
    colorToken: '--color-danger',
  },
  npc: {
    label: 'NPCs',
    kind: 'npc',
    order: 2,
    visible: true,
    collapsible: true,
    colorToken: '--color-accent',
  },
  quest: {
    label: 'Quests',
    kind: 'quest',
    order: 3,
    visible: true,
    collapsible: true,
    colorToken: '--color-warning',
  },
  travel: {
    label: 'Travel',
    kind: 'travel',
    order: 4,
    visible: true,
    collapsible: true,
    colorToken: '--color-info',
  },
  downtime: {
    label: 'Downtime',
    kind: 'downtime',
    order: 5,
    visible: true,
    collapsible: true,
    colorToken: '--color-success',
  },
  location: {
    label: 'Locations',
    kind: 'location',
    order: 6,
    visible: true,
    collapsible: true,
    colorToken: '--color-info',
  },
  faction: {
    label: 'Factions',
    kind: 'faction',
    order: 7,
    visible: true,
    collapsible: true,
    colorToken: '--color-accent-alt',
  },
  // Parent "Notes" row. Its children (below) are per-note-type sub-rows.
  // Starts collapsed so the default view is compact and users can expand
  // when they want the per-type breakdown.
  notes: {
    label: 'Notes',
    kind: 'notes',
    order: 10,
    visible: true,
    collapsible: true,
    collapsed: true,
  },
  // Child rows under `notes`. Each renders indented beneath the Notes
  // parent and inherits the parent's collapse state.
  generic: {
    label: 'Notes',
    kind: 'generic',
    order: 11,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
  rumor: {
    label: 'Rumors',
    kind: 'rumor',
    order: 12,
    visible: true,
    collapsible: true,
    colorToken: '--color-warning',
    parentTrackId: 'track-notes',
  },
  quote: {
    label: 'Quotes',
    kind: 'quote',
    order: 13,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
  loot: {
    label: 'Loot',
    kind: 'loot',
    order: 14,
    visible: true,
    collapsible: true,
    colorToken: '--color-success',
    parentTrackId: 'track-notes',
  },
  combat: {
    label: 'Combat',
    kind: 'combat',
    order: 15,
    visible: true,
    collapsible: true,
    colorToken: '--color-danger',
    parentTrackId: 'track-notes',
  },
  'skill-check': {
    label: 'Skill Checks',
    kind: 'skill-check',
    order: 16,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
  'spell-cast': {
    label: 'Spells Cast',
    kind: 'spell-cast',
    order: 16.5,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
  'ability-use': {
    label: 'Abilities Used',
    kind: 'ability-use',
    order: 16.6,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
  recap: {
    label: 'Recaps',
    kind: 'recap',
    order: 17,
    visible: true,
    collapsible: true,
    parentTrackId: 'track-notes',
  },
};
