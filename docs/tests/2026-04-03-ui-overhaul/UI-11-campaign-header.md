---
scenario_id: "UI-11"
title: "CampaignHeader shows campaign info"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
  - shell
---

# Scenario UI-11: CampaignHeader shows campaign info

## Description
Verify the CampaignHeader displays campaign name, session info, Lucide icons (ChevronDown, Menu), pulsing session indicator, and dropdown campaign selector.

## Preconditions
- App running at https://localhost:4173
- Active campaign with session

## Steps

1. Navigate to https://localhost:4173/character/sheet
2. Dismiss stale session dialog if present
3. Verify campaign name is displayed in header
4. Verify session info (session name + date) is displayed
5. Verify pulsing green dot for active session
6. Verify "Select campaign" button exists with ChevronDown icon
7. Verify "Menu" button exists (hamburger icon)
8. Click the campaign selector button
9. Verify dropdown menu opens
10. Take screenshot

## Expected Results
- Campaign name in display font (Marcellus)
- Session info shown
- Green pulsing dot for active session
- Lucide SVG icons (not Unicode)
- Campaign dropdown opens on click
- No JS console errors

## Execution Tool
playwright — browser_navigate, browser_snapshot, browser_click, browser_take_screenshot

## Pass / Fail Criteria
- **Pass:** Header shows all expected elements with Lucide icons
- **Fail:** Missing elements, Unicode symbols instead of Lucide, or broken dropdown
