---
scenario_id: "UI-07"
title: "Magic Screen spell and ability management"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-07: Magic Screen spell and ability management

## Description
Verify the Magic Screen supports adding spells via the spell editor drawer, toggling spell preparation, switching between Prepared and Grimoire filter tabs, managing power levels, and adding heroic abilities.

## Preconditions
- A character exists and is set as active.
- The app is in Edit Mode so that "+ Add Spell" and "+ Add Ability" buttons are visible.

## Steps
1. Navigate to `http://localhost:5173/character/magic`.
2. Assert the page heading "Magic" is visible.
3. Assert the prepared counter badge is visible showing "0/N Prepared" where N is the computed max.
4. Assert the filter tabs "Prepared" and "Grimoire" are visible. Assert "Prepared" tab has the active class (`magic-filter-tab--active`).
5. Assert the "Spells" SectionPanel is visible with text "No prepared spells."
6. Click the "Grimoire" filter tab. Assert it becomes active. Assert the empty state text changes to "No spells yet. Add a spell above."
7. Click the "+ Add Spell" button. Assert the spell editor drawer opens with title "Add Spell".
8. Fill in Name with "Fireball". Fill in School with "Elementalism". Fill in Range with "4 hexes". Fill in Duration with "Instant". Fill in Summary with "Deals fire damage in an area."
9. Click "Save". Assert the drawer closes.
10. Assert "Fireball" now appears as a MagicSpellCard in the Grimoire view.
11. Click the "+ Add Spell" button again. Fill in Name with "Heal Wound", School with "Healing", Range with "Touch", Duration with "Instant", Summary with "Restores HP to target."
12. Click "Save". Assert "Heal Wound" also appears in the Grimoire.
13. On the "Fireball" card, locate and click the prepare/toggle button. Assert Fireball is now marked as prepared.
14. Assert the prepared counter updates to "1/N Prepared".
15. Click the "Prepared" filter tab. Assert only "Fireball" is visible (Heal Wound is not shown since it is not prepared).
16. Click the "Grimoire" tab. Assert both "Fireball" and "Heal Wound" are visible.
17. On the "Fireball" card, locate the power level control. Increase the power level to 2. Assert the power level display updates.
18. Assert the "Heroic Abilities" SectionPanel is visible with text "No heroic abilities yet."
19. Click the "+ Add Ability" button. Assert the ability editor drawer opens with title "Add Ability".
20. Fill in Name with "Veteran". Fill in Summary with "Re-roll one failed attack per stretch."
21. Click "Save". Assert the drawer closes.
22. Assert "Veteran" appears as an AbilityCard in the Heroic Abilities section.
23. On the "Fireball" card (in edit mode), click the edit button. Assert the drawer reopens with "Fireball" data pre-filled. Change the Summary to "Massive fire damage in area." Click "Save". Assert the updated summary is visible.
24. On the "Heal Wound" card, click the delete button. Confirm if prompted. Assert "Heal Wound" is removed from the list.

## Expected Results
- Spell editor drawer opens, saves spells, and they appear as MagicSpellCards.
- Preparation toggle marks spells as prepared and updates the counter.
- Filter tabs correctly show only prepared spells or all spells.
- Power level controls update the per-spell power level.
- Ability editor drawer creates abilities that appear as AbilityCards.
- Editing a spell re-opens the drawer with pre-filled data and saves changes.
- Deleting a spell removes it from the list.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Spells and abilities can be created, edited, and deleted; preparation toggle and filter tabs work; power level controls respond; prepared counter updates accurately.
- **Fail:** Drawer fails to open or save, preparation toggle does not update the counter, filter tabs show incorrect spells, or delete does not remove the spell.
