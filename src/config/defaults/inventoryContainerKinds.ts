import type { InventoryContainerKind } from '../../types/inventoryContainer';

export interface InventoryContainerKindConfig {
  id: InventoryContainerKind;
  label: string;
  /** Short emoji glyph used as the card icon until the theme provides a richer one. */
  icon: string;
}

/**
 * Default list of carrier kinds. Drives the icon on party inventory cards and
 * the options shown in the add/edit container drawer. A future preferences
 * screen can override this list through the settings layer — components must
 * always read the active list via a selector, never import this constant
 * directly.
 */
export const DEFAULT_INVENTORY_CONTAINER_KINDS: InventoryContainerKindConfig[] = [
  { id: 'coffer', label: 'Coffer', icon: '💰' },
  { id: 'animal', label: 'Pack Animal', icon: '🐴' },
  { id: 'npc', label: 'NPC / Hireling', icon: '🧑' },
  { id: 'other', label: 'Other', icon: '📦' },
];
