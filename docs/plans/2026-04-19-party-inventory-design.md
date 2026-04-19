# Party Inventory — Design

_Date:_ 2026-04-19
_Status:_ Approved, ready for implementation plan

## Problem

During play we had a donkey, a groom, and loot picked up by the party — none
of which fit cleanly onto any single character's inventory. We also lose time
working out "who has how much gold" when the party shares a pool. The Gear
screen currently only models one character's personal inventory.

## Goal

Add a party-wide inventory view that:

- Aggregates every party PC's personal inventory.
- Introduces lightweight "containers" (party coffer, donkey, groom, any future
  NPC/animal) that can hold items _and_ coin.
- Makes it one tap to move items between any two carriers.
- Shows a running total of party gold (converted across denominations) and
  party weight.

## Non-goals

- Full NPC character sheets for carriers. An NPC that needs combat stats gets
  promoted to a real `Character` later; this feature does not block that.
- Hard capacity enforcement. Over-capacity is a red warning, not a block.
- Multi-campaign / global containers. Containers are scoped to one campaign.

## Data model

A new entity, `InventoryContainer`:

```ts
interface InventoryContainer extends Timestamped {
  id: ID;
  campaignId: ID;             // scoped to the campaign it travels with
  name: string;               // "Donkey", "Party Coffer", "Groom"
  kind: 'coffer' | 'animal' | 'npc' | 'other';  // drives icon only
  capacity: number | null;    // weight cap in wt units; null = unlimited
  coins: { gold: number; silver: number; copper: number };
  items: InventoryItem[];     // same shape PCs use (tiny/consumable carry through)
  deletedAt?: string;
  softDeletedBy?: string;
}
```

- New Dexie table `inventoryContainers` added via a new `db.version(N)` block.
  Existing versions are never edited.
- New `src/storage/repositories/inventoryContainerRepository.ts` with
  `list(campaignId)` / `get` / `save` / `softDelete` / `restore` /
  `hardDelete`. All read methods call `excludeDeleted` by default and accept
  `{ includeDeleted: true }` for trash/restore paths.
- PC inventory and coins stay exactly where they are today
  (`Character.inventory`, `Character.coins`). The party screen reads/writes
  them through `characterRepository`.

## UI

### Location

A new **Party** tab is added to the Gear screen. The existing Gear content
becomes the **My Gear** tab. Nothing about the current Gear screen behavior
changes when the My Gear tab is selected.

The Party tab renders only when there is an active campaign; otherwise it
shows a "no active campaign" prompt.

### Party tab layout

1. **Totals strip** at the top:
   - Total gold equivalent across every carrier
     (`gold + silver/10 + copper/100`).
   - Total weight carried across every carrier.
   - Count of over-capacity carriers (hidden when 0).
2. **Carrier cards**, stacked. Each card shows name, kind icon, coins strip,
   weight / capacity, and the item list:
   - One card per party PC, reading from `characterRepository`.
   - One card per `InventoryContainer` for the active campaign.
   - The active character's card starts expanded; every other card starts
     collapsed.
3. **"+ Add Container"** button at the bottom opens a drawer for name / kind
   / capacity (with an "unlimited" toggle).
4. Container cards have an overflow menu with **Edit** (name, kind, capacity)
   and **Delete** (soft delete; cascaded edges if any).

### Item move flow

Tapping an item (anywhere it appears) opens a **Move [item]** drawer:

- Lists every carrier in the party except the current one.
- If `item.quantity > 1`, a stepper lets you pick how many to move (defaults
  to the full stack).
- Tap a destination → atomic write: remove from source `items[]`, append to
  destination `items[]`. If the item was partially split, the source row is
  decremented instead of removed.
- If the move pushes the destination over capacity, the move still succeeds
  but the destination card shows the red over-capacity badge (same visual
  treatment PC encumbrance uses today).

### Item edit flow

Tapping the item's **name area** (not the "Move" icon) opens the existing
`InventoryItemEditor` drawer, wired to save back to whichever carrier owns it.
This works uniformly for PCs and containers.

### Coin flow

Each carrier card has its own G/S/C stepper strip, reusing the borrow-on-
decrement logic just shipped for the PC coin widget (so a coffer holding only
gold can still pay 5 silver). Each card also has a **Move coins** button that
opens a destination picker with G/S/C amount steppers.

### Consumables and tiny items

No new flags — the existing `InventoryItem.tiny` and `InventoryItem.consumable`
fields already work inside `InventoryContainer.items`. The inline +/− stepper
for consumables and the tiny-weight-zero rule apply uniformly across PCs and
containers.

## Cross-character writes

The Gear screen today only writes to the active character. The Party tab must
write to any PC in the current campaign. Every write goes through
`characterRepository.save` by id, not through `ActiveCharacterContext`. We do
not need to keep the active character in sync with every list — the Party
view simply re-reads its PC list after any write.

## Soft delete and cascades

`InventoryContainer` follows the project-wide soft-delete convention:
`softDelete` sets `deletedAt` + `softDeletedBy`; `restore` clears both. The
current feature does not introduce any `entityLinks` rows for containers, so
no cascade is needed yet. If we later link containers to sessions or
encounters, we add a cascade on `softDeletedBy` at that time.

## Configuration over hardcoding

The four `kind` values (`coffer`, `animal`, `npc`, `other`) drive the icon
only. The full list of kinds and their default icons lives in
`src/config/defaults/inventoryContainerKinds.ts` so a preferences screen can
later let the user rename or extend the list. Components never import the
default list directly — they read through a settings selector.

## Out of scope for this iteration

- Weight contribution to _PC_ encumbrance when a PC "carries" a container
  (e.g. groom's pack on my back). Containers are standalone carriers for now.
- Coin transfer shortcuts ("give each PC an equal share").
- Container loot templates / randomized contents.
- Filtering or searching across all party inventories.

These are all natural follow-ups but none of them block the primary
"who's got the rope?" problem this feature solves.

## Success criteria

- During play I can add a "Donkey" with a capacity of 30 in under 10 seconds.
- I can move an item from my PC to the donkey in 2 taps.
- I can see total party gold without opening any character sheet.
- I can spend 5 silver from the coffer while it holds only gold, without
  manually converting.
- Items marked consumable or tiny work exactly the same on containers as on
  PCs.
