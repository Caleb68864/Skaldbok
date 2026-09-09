import type { NoteType } from '../../types/note';

/** How one note type is presented wherever the user picks or filters by type. */
export interface NoteTypeConfig {
  /** The stored discriminator — stable; renaming `label` must not change it. */
  id: NoteType;
  /** Display name. */
  label: string;
  /**
   * Hidden from the notes grid's chips and its "All" filter unless the user
   * reveals it. Log entries are freeform captures, not authored notes, so they
   * clutter the grid — but they stay searchable.
   */
  hiddenByDefault?: boolean;
  /**
   * Offered when promoting log entries into a note. System-assigned types
   * (`npc`, `combat`, `skill-check`) are not, because the flows that create
   * them choose the type; nor is `log`, since promoting a log entry back into
   * a log entry is not a thing.
   */
  promotable?: boolean;
}

/**
 * Default presentation of the note types.
 *
 * @remarks
 * This was two divergent literal arrays — one in `NotesGrid`, one in
 * `PromoteEntriesSheet` — plus a `HIDDEN_NOTE_TYPES` list beside the first.
 * CLAUDE.md names "note type groupings" and "filter presets" as things that
 * must be configurable. Components read this through `useNoteTypeConfig()`,
 * never directly. Order here is display order.
 */
export const DEFAULT_NOTE_TYPE_CONFIG: NoteTypeConfig[] = [
  { id: 'generic', label: 'Note', promotable: true },
  // `npc`, `spell-cast` and `ability-use` were missing from this list while
  // being actively written — by `useSessionLog`, `noteCreationService`,
  // `SkillCheckEditDrawer` and `PromoteEntriesSheet`. `NotesGrid` builds its
  // filter chips from this array, so there was no way to filter to any of the
  // three, and the "All" filter is assembled from it too. None is `promotable`:
  // like `combat` and `skill-check`, the flow that creates them picks the type.
  { id: 'npc', label: 'NPC' },
  { id: 'location', label: 'Location', promotable: true },
  { id: 'combat', label: 'Combat' },
  { id: 'loot', label: 'Loot', promotable: true },
  { id: 'rumor', label: 'Rumor', promotable: true },
  { id: 'quote', label: 'Quote', promotable: true },
  { id: 'skill-check', label: 'Skill Check' },
  { id: 'spell-cast', label: 'Spell Cast' },
  { id: 'ability-use', label: 'Ability Use' },
  { id: 'recap', label: 'Recap', promotable: true },
  { id: 'log', label: 'Log', hiddenByDefault: true },
];
