---
scenario_id: "EC-07"
title: "Form Validation"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario EC-07: Form Validation

## Description
Verifies that forms enforce required field validation: character creation with empty name, campaign creation with empty name, and note submission with no title all show appropriate validation errors or disabled submit buttons.

## Preconditions
- App is running at localhost

## Steps

**Character creation -- empty name:**
1. Navigate to `/library`.
2. Tap the "Create Character" or "+" button.
3. If a name input is shown, clear it to ensure it is empty.
4. Take a snapshot.
5. Check whether the submit/create button is disabled or if tapping it produces a validation error.
6. If the button is clickable, tap it and check if a validation message appears or if a default name is assigned.
7. Record the behavior (disabled button, error message, or default name fallback).

**Campaign creation -- empty name:**
8. Navigate to `/session`.
9. If no campaign exists, look for the "Create Campaign" prompt. If a campaign exists, look for a campaign creation option in the header or settings.
10. Open the campaign creation modal/drawer.
11. Clear the name field (ensure empty).
12. Take a snapshot.
13. Check whether the "Create" or "Save" button is disabled.
14. If clickable, tap it and verify a validation error appears or the action is prevented.

**Note creation -- no title:**
15. Navigate to `/notes`.
16. Tap the Quick Note creation button.
17. Leave the title field empty.
18. Optionally type body text.
19. Take a snapshot of the drawer.
20. Check whether the save/create button is disabled or tapping it produces a validation error.
21. If the button is enabled, tap it and verify behavior (error toast, inline validation, or note saved with default title).

22. Check `browser_console_messages` for any unhandled form submission errors.

## Expected Results
- Character creation either requires a name or assigns a default (e.g., "New Character").
- Campaign creation prevents empty name submission (disabled button or validation error).
- Note creation either requires a title or handles empty title gracefully.
- No unhandled errors in the console during any validation flow.

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** All forms either block empty required fields with validation feedback or gracefully assign defaults; no crashes.
- **Fail:** Forms submit empty required data without feedback, app crashes, or unhandled errors occur.
