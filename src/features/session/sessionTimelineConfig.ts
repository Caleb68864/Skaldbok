import type { Note } from '@/types/note';

export const DEFAULT_SESSION_TIMELINE_NOTE_TRACKS: Record<string, string> = {
  generic: 'generic',
  npc: 'npc',
  combat: 'generic',
  location: 'location',
  loot: 'generic',
  rumor: 'generic',
  quote: 'generic',
  'skill-check': 'generic',
  recap: 'generic',
};

export function resolveSessionTimelineTrackKind(note: Pick<Note, 'type'>): string {
  return DEFAULT_SESSION_TIMELINE_NOTE_TRACKS[note.type] ?? 'generic';
}
