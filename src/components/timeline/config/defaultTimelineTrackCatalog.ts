import type { TimelineTrack } from '../types';

export type TimelineTrackCatalogEntry = Pick<
  TimelineTrack,
  'label' | 'kind' | 'order' | 'visible'
> &
  Partial<Pick<TimelineTrack, 'collapsible' | 'collapsed' | 'colorToken' | 'description' | 'parentTrackId'>>;

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
