---
scenario_id: "UI-06"
title: "Gear Screen weapon, armor, and inventory management"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-06: Gear Screen weapon, armor, and inventory management

## Description
Verify the Gear Screen supports adding and managing weapons, armor, helmets, inventory items, coins, tiny items, memento, and encumbrance tracking via their respective editor drawers and controls.

## Preconditions
- A character exists and is set as active.
- The app is in Edit Mode so that add/edit buttons are visible.

## Steps
1. Navigate to `http://localhost:5173/character/gear`.
2. Assert the page heading "Gear" is visible.
3. Assert the "Weapons" SectionPanel is visible with text "No weapons."
4. Click the "+ Add Weapon" button. Assert the WeaponEditor drawer opens with title "Add Weapon" or similar.
5. Fill in the weapon name field with "Broadsword". Fill in other fields as available (damage, grip, range).
6. Click "Save" in the drawer. Assert the drawer closes.
7. Assert "Broadsword" now appears in the Weapons section as a WeaponCard.
8. Assert the "Armor & Helmet" SectionPanel is visible.
9. Click the "+ Add Armor" button. Assert the armor editor drawer opens with title "Add Armor" or "Edit Armor".
10. Fill in the armor name with "Chainmail". Set rating to 3 and weight to 2.
11. Click "Save". Assert the drawer closes.
12. Assert "Chainmail" appears in the Armor section with "rating 3" text.
13. Click the "+ Add Helmet" button. Assert the helmet editor drawer opens.
14. Fill in helmet name with "Iron Helm". Set rating to 1.
15. Click "Save". Assert the drawer closes.
16. Assert "Iron Helm" appears in the Helmet section with "rating 1" text.
17. Assert the "Inventory" SectionPanel is visible.
18. Click the add button in the inventory section. Assert the InventoryItemEditor drawer opens.
19. Fill in item name with "Rope (50 ft)" and set weight to 1.
20. Click "Save". Assert the drawer closes and "Rope (50 ft)" appears in the inventory list.
21. Assert the "Coins" SectionPanel is visible with Gold, Silver, and Copper counters.
22. Locate the Gold counter. Click the increment button. Assert the gold value increases to 1.
23. Click the Gold increment button again. Assert gold shows 2.
24. Click the Gold decrement button. Assert gold shows 1.
25. Assert the "Tiny Items" SectionPanel is visible.
26. Type "Flint & Steel" in the tiny item input and click "Add" (or press Enter). Assert "Flint & Steel" appears in the tiny items list.
27. Click "Remove" next to "Flint & Steel". Assert it is removed from the list.
28. Assert the "Memento" SectionPanel is visible. Type "Mother's locket" in the memento input. Assert the value is set.
29. Assert the "Encumbrance" SectionPanel is visible showing a weight/limit ratio.

## Expected Results
- Weapon editor drawer opens, saves a weapon, and it appears as a WeaponCard.
- Armor and helmet editor drawers save correctly and display name/rating in the section.
- Inventory item editor creates items that appear in the list.
- Coin counters increment and decrement correctly.
- Tiny items can be added and removed.
- Memento input accepts text.
- Encumbrance shows total weight vs. limit.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All gear editors open and save, items appear in their sections, coin counters work, tiny items add/remove, memento saves, and encumbrance displays.
- **Fail:** Any drawer fails to open or save, items do not appear after saving, coin counters do not respond, or encumbrance is not displayed.
