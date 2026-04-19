import type { ID, Timestamped } from './common';
import type { InventoryItem } from './character';

/**
 * Kinds of inventory carrier other than a player character. Drives the icon
 * only — the full list and their default icons live in
 * `src/config/defaults/inventoryContainerKinds.ts` so the user can later
 * rename or extend them through a preferences screen.
 */
export type InventoryContainerKind = 'coffer' | 'animal' | 'npc' | 'other';

/**
 * Party-scoped carrier for shared loot, pack animals, hirelings, or a common
 * coffer. Coexists with each PC's personal `Character.inventory` and
 * `Character.coins`; the Party tab aggregates both.
 *
 * @remarks
 * `capacity` is a weight cap in the same units a PC uses for encumbrance.
 * `null` means unlimited (e.g. a treasure chest that stays at home). The
 * party UI treats over-capacity as a soft warning, not a block.
 */
export interface InventoryContainer extends Timestamped {
  /** Unique identifier for the container. */
  id: ID;
  /** Campaign this container travels with. */
  campaignId: ID;
  /** Display name, e.g. "Donkey", "Party Coffer". */
  name: string;
  /** Carrier kind — drives the icon only. */
  kind: InventoryContainerKind;
  /** Weight capacity in wt units; `null` means unlimited. */
  capacity: number | null;
  /** Coin purse held by this container. */
  coins: {
    gold: number;
    silver: number;
    copper: number;
  };
  /** Items carried. Same shape PC inventory uses so tiny/consumable apply uniformly. */
  items: InventoryItem[];
  /** ISO datetime when this container was soft-deleted; absent while active. */
  deletedAt?: string;
  /** Transaction UUID identifying the cascade that soft-deleted this container. */
  softDeletedBy?: string;
}
