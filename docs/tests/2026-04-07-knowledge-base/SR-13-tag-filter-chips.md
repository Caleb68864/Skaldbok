---
scenario_id: "SR-13"
title: "Tag filter chips filter displayed cards"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - ui
  - ss-07
---

# Scenario SR-13: Tag filter chips filter displayed cards

## Description
Verifies that the VaultBrowser on /kb displays tag filter chips and that clicking a tag chip filters the displayed cards to only those matching the selected tag.

## Preconditions
- App is built and running at https://localhost:4173
- A campaign exists with kb_nodes that have tags assigned
- At least two different tags are in use across nodes

## Steps

1. Use `browser_navigate` to open https://localhost:4173/kb
2. Use `browser_snapshot` to capture the VaultBrowser view
3. Locate the tag filter chip area (typically below the category tabs or in a filter bar)
4. Verify that tag chips are visible, each showing a tag name
5. Use `browser_snapshot` to count the total number of displayed cards before filtering
6. Use `browser_click` on one of the tag filter chips
7. Use `browser_snapshot` to capture the filtered view
8. Verify the displayed cards are reduced to only those with the selected tag
9. Use `browser_click` on the same tag chip again to deselect it (toggle off)
10. Use `browser_snapshot` to verify all cards are shown again (filter removed)
11. Use `browser_click` on a different tag chip to verify it filters to a different set

## Expected Results
- Tag filter chips are visible on /kb
- Clicking a tag chip filters cards to only those matching the tag
- The selected chip has a visually distinct active state
- Clicking the chip again removes the filter and shows all cards
- Different tags produce different filtered sets

## Execution Tool
playwright — Use browser_navigate to /kb, browser_click on tag chips, browser_snapshot to verify filtering

## Pass / Fail Criteria
- **Pass:** Tag chips are visible, clicking a chip filters cards correctly, and toggling off restores all cards
- **Fail:** No tag chips appear, clicking a chip does not filter, or deselecting does not restore the full list
