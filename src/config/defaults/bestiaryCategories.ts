/** One bestiary category. `id` is stored on the creature; `label` is display only. */
export interface BestiaryCategoryConfig {
  id: 'monster' | 'npc' | 'animal';
  label: string;
}

/**
 * Default bestiary categories, in display order. The list screen and the creature
 * form each kept their own copy, and read through `useBestiaryCategories()` now.
 */
export const DEFAULT_BESTIARY_CATEGORIES: BestiaryCategoryConfig[] = [
  { id: 'monster', label: 'Monster' },
  { id: 'npc', label: 'NPC' },
  { id: 'animal', label: 'Animal' },
];
