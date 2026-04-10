---
scenario_id: "SR-18"
title: "Graph View tag toggle and type filters"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-10
---

# Scenario SR-18: Graph View tag toggle and type filters

## Description
Verifies that the graph view provides a "Show tags" toggle that reveals tag nodes, and type filter toggles that hide/show specific node types (People, Places, Loot, Notes).

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with kb_nodes of multiple types and nodes with tags assigned
- Graph view has data to render

## Steps

1. Use `browser_navigate` to open https://localhost:4173/kb?view=graph
2. Use `browser_snapshot` to capture the initial graph view with controls
3. Locate the "Show tags" toggle control
4. Verify tag nodes are NOT visible by default (toggle is off)
5. Use `browser_click` on the "Show tags" toggle
6. Use `browser_take_screenshot` to verify tag nodes now appear on the graph (smaller or differently colored nodes for tags)
7. Use `browser_click` on the "Show tags" toggle again to hide them
8. Use `browser_take_screenshot` to verify tag nodes are hidden again
9. Locate the type filter controls (e.g., People, Places, Loot, Notes toggles)
10. Use `browser_click` to toggle off one type (e.g., "People")
11. Use `browser_take_screenshot` to verify people-type nodes are hidden from the graph
12. Use `browser_click` to toggle "People" back on
13. Use `browser_take_screenshot` to verify people-type nodes reappear

## Expected Results
- "Show tags" toggle is present and defaults to off
- Enabling "Show tags" adds tag nodes to the graph visualization
- Disabling "Show tags" removes tag nodes
- Type filter toggles are present for each node type
- Toggling a type off hides those nodes from the graph
- Toggling a type back on restores those nodes

## Execution Tool
playwright — Use browser_click on toggles, browser_take_screenshot to verify visual changes in the graph

## Pass / Fail Criteria
- **Pass:** Tag toggle shows/hides tag nodes, and type filters correctly show/hide nodes of each type
- **Fail:** Toggles are missing, clicking toggles has no effect, or wrong node types are hidden
