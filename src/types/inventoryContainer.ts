import { z } from 'zod';
import type { ID, Timestamped } from './common';
import type { InventoryItem } from './character';

/**
 * Lenient Zod schema for inventory items as they appear inside containers /
 * character inventories within import bundles. Mirrors the optional flags on
 * {@link InventoryItem} (tiny, consumable, capacityBonus) but stays permissive
 * about extra fields so legacy bundles round-trip cleanly.
 */
const bundleInventoryItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    weight: z.number(),
    quantity: z.number(),
    description: z.string(),
    tiny: z.boolean().optional(),
    consumable: z.boolean().optional(),
    capacityBonus: z.number().optional(),
  })
  .passthrough();

/**
 * Zod schema for {@link InventoryContainer}.
 * Used to validate containers inside import bundles.
 */
export const inventoryContainerSchema = z
  .object({
    id: z.string().min(1),
    campaignId: z.string().min(1),
    name: z.string(),
    kind: z.enum(['coffer', 'animal', 'npc', 'other']),
    capacity: z.number().nullable(),
    // Keyed by the active system's currency denomination id, like
    // `CharacterRecord.wealth`. Defaults to empty so a container written before
    // this change still validates; `coins` is accepted for the same reason and
    // folded into `wealth` on read.
    wealth: z.record(z.string(), z.number()).default({}),
    coins: z
      .object({ gold: z.number(), silver: z.number(), copper: z.number() })
      .optional()
      .describe('Legacy fixed coin purse; superseded by wealth'),
    items: z.array(bundleInventoryItemSchema),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().optional(),
    softDeletedBy: z.string().optional(),
  })
  .passthrough();

/**
 * Reads a container's money, folding a legacy `coins` purse into the
 * denomination-keyed shape.
 *
 * @remarks
 * Containers have no `schemaVersion`, so rather than a ladder they are
 * normalised on read. Always go through this instead of touching either field.
 */
export function containerWealth(container: {
  wealth?: Record<string, number>;
  coins?: { gold: number; silver: number; copper: number };
}): Record<string, number> {
  if (container.wealth && Object.keys(container.wealth).length > 0) return container.wealth;
  if (container.coins) {
    return { gold: container.coins.gold, silver: container.coins.silver, copper: container.coins.copper };
  }
  return {};
}

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
  /**
   * Money held by this container, keyed by currency denomination id.
   *
   * @remarks
   * Mirrors `CharacterRecord.wealth` so the Party tab can aggregate a character
   * and a container with the same code, and so a system using Credits is not
   * stuck with a gold/silver/copper purse.
   */
  wealth: Record<string, number>;
  /** @deprecated Legacy fixed coin purse; read via {@link containerWealth}. */
  coins?: {
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
