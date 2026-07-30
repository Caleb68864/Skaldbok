/** One named group of preset tags shown as a labelled row in the tag picker. */
export interface TagPresetGroup {
  /** Stable id — persisted, so renaming `label` must not change it. */
  id: string;
  /** Display heading for the row. */
  label: string;
  tags: string[];
}

/**
 * Default tag palette offered by the tag picker.
 *
 * @remarks
 * These were four `as const` arrays inside `TagPicker` itself — exactly the
 * "enum of user-meaningful strings" CLAUDE.md names as a code smell, since a GM
 * running horror wants different moods than one running a heist. Components must
 * read the active list through `useTagPresets()`, never import this directly.
 *
 * Ids are separate from labels because the group id is what a stored override is
 * keyed by; deriving it from the label would orphan the user's edits the moment
 * they renamed a row.
 */
export const DEFAULT_TAG_PRESETS: TagPresetGroup[] = [
  {
    id: 'mood',
    label: 'Mood',
    tags: ['tense', 'funny', 'dramatic', 'sad', 'victorious'],
  },
  {
    id: 'scene',
    label: 'Scene',
    tags: ['combat', 'exploration', 'social', 'mystery', 'travel', 'downtime'],
  },
  {
    id: 'meta',
    label: 'Meta',
    tags: ['important', 'follow-up', 'plot-hook', 'lore', 'treasure'],
  },
  {
    id: 'type',
    label: 'Type',
    tags: [
      'npc',
      'location',
      'rumor',
      'quest',
      'loot',
      'skill-check',
      'spell',
      'ability',
      'death',
      'rest',
    ],
  },
];
