---
scenario_id: "UI-19"
title: "Combat timeline event logging"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-19: Combat timeline event logging

## Description
Verify the combat timeline can be started from the session screen, log events using the quick event chips (attack, damage, condition), use the ability and spell picker drawers, advance rounds, and display events in the event log. Verify ending combat archives the combat note.

## Preconditions
- App is running at localhost (default port)
- An active campaign and active session exist
- An active character is selected (their name pre-fills the actor field)

## Steps
1. Navigate to `/session`
2. Verify the active session card is visible with the "Start Combat" button
3. Click "Start Combat"
4. Verify the combat timeline appears with heading "Combat -- Round 1"
5. Verify the "Next Round" button, event type chips (Attack, Spell, Ability, Damage, Heal, Condition, Note), and "End Combat" button are visible
6. Verify the "Event Log" section shows "No events yet."
7. Click the "Attack" event type chip
8. Verify the event form appears with fields: Actor, Target, Label (pre-filled with "Attack"), and Value
9. Verify the Actor field is pre-filled with the active character's name
10. Fill the Target field with "Goblin Scout"
11. Fill the Value field with "14"
12. Click the "Log Event" button
13. Verify the event appears in the Event Log showing the actor name, "Attack", target "Goblin Scout", and value "[14]"
14. Click the "Damage" event type chip
15. Fill the Target field with "Goblin Scout"
16. Fill the Value field with "8"
17. Click "Log Event"
18. Verify the damage event appears in the Event Log
19. Click the "Condition" event type chip
20. Verify the "Apply Condition" drawer opens with a list of Dragonbane conditions: Exhausted (STR), Sickly (CON), Dazed (AGL), Angry (INT), Scared (WIL), Disheartened (CHA)
21. Optionally fill the "Who is affected?" input with "Goblin Scout"
22. Click "Dazed"
23. Verify the condition event appears in the Event Log showing "Dazed" with attribute "[AGL]"
24. Click the "Ability" event type chip
25. Verify the "Heroic Abilities" drawer opens (Drawer component with title "Heroic Abilities")
26. Select an ability from the picker (click any listed ability)
27. Verify the ability event appears in the Event Log
28. Click the "Next Round" button
29. Verify the heading updates to "Combat -- Round 2"
30. Verify a round separator line appears in the Event Log (italic text indicating round transition)
31. Click "End Combat"
32. Verify the combat timeline closes and the session screen returns to its normal view
33. Navigate to `/notes`
34. Verify a combat note (e.g., "Combat -- Round 2") appears in the "Combat Logs" section

## Expected Results
- Start Combat creates a combat note and opens the timeline at Round 1
- Event type chips open the appropriate form or picker drawer
- Actor name is pre-filled from the active character
- Events are logged and appear in the Event Log in reverse chronological order
- Condition picker shows all six Dragonbane conditions with attributes
- Ability picker opens in a Drawer component
- Next Round advances the round counter and adds a separator
- End Combat closes the timeline and archives the combat note
- Combat note is visible in the Notes screen under Combat Logs

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All event types can be logged, pickers open correctly, rounds advance, and ending combat returns to normal session view with an archived combat note
- **Fail:** Event form does not appear, events are not logged to the timeline, pickers fail to open, round does not advance, or combat note is not created/archived
