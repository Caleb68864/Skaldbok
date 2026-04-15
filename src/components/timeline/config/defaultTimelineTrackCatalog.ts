import type { TimelineTrack } from '../types';

export type TimelineTrackCatalogEntry = Pick<
  TimelineTrack,
  'label' | 'kind' | 'order' | 'visible'
> &
  Partial<Pick<TimelineTrack, 'collapsible' | 'colorToken' | 'description'>>;

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
  generic: {
    label: 'Notes',
    kind: 'generic',
    order: 99,
    visible: true,
    collapsible: true,
  },
};
