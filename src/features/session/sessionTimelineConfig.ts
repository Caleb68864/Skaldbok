import type { Note } from '@/types/note';

/**
 * Per-note-type track kind used by the session timeline. Each kind maps to a
 * child row under the `notes` parent track (except `npc`, which keeps its
 * own top-level row for parity with the existing default catalog).
 *
 * When the `notes` parent is collapsed, the child rows hide and their items
 * aggregate onto the parent row — so the user sees "Notes: 7 events" as a
 * single row in compact mode, and "Notes → Rumors (3), Quotes (2), Loot (1),
 * Recaps (1)" when expanded.
 */
export const DEFAULT_SESSION_TIMELINE_NOTE_TRACKS: Record<string, string> = {
  generic: 'generic',
  npc: 'npc',
  combat: 'combat',
  location: 'location',
  loot: 'loot',
  rumor: 'rumor',
  quote: 'quote',
  'skill-check': 'skill-check',
  'spell-cast': 'spell-cast',
  'ability-use': 'ability-use',
  recap: 'recap',
};

/**
 * Note-type track kinds that nest under the `notes` parent. `npc` stays at
 * the top level because it's a first-class campaign entity (per the default
 * catalog); everything else is a child of Notes.
 */
export const NOTE_CHILD_TRACK_KINDS = [
  'generic',
  'combat',
  'location',
  'loot',
  'rumor',
  'quote',
  'skill-check',
  'spell-cast',
  'ability-use',
  'recap',
] as const;

export function resolveSessionTimelineTrackKind(note: Pick<Note, 'type'>): string {
  return DEFAULT_SESSION_TIMELINE_NOTE_TRACKS[note.type] ?? 'generic';
}
