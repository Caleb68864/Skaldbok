---
scenario_id: "UI-13"
title: "Campaign creation modal"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
sequential: true
---

# Scenario UI-13: Campaign creation modal

## Description
Verify the campaign creation flow: open the campaign selector from the header, click "+ Create Campaign", fill out the form with name and description, submit, and confirm the new campaign becomes active.

## Preconditions
- App is running at localhost (default port)
- No specific campaign is required (test creates a new one)

## Steps
1. Navigate to `/session`
2. Click the campaign selector button in the header (aria-label "Select campaign") to open the campaign selector overlay
3. Verify the campaign selector overlay appears (role="dialog", aria-label="Campaign selector")
4. Click the "+ Create Campaign" button at the bottom of the overlay
5. Verify the Create Campaign modal appears (role="dialog", aria-label="Create campaign") with heading "Create Campaign"
6. Verify the "Create" submit button is disabled (opacity reduced) because the name field is empty
7. Fill the "Campaign name" input with "Test Campaign Alpha"
8. Verify the "Create" submit button is now enabled
9. Fill the "Brief description..." textarea with "A test campaign for Playwright verification"
10. Click the "Create" button to submit the form
11. Verify the modal closes
12. Verify the campaign header now displays "Test Campaign Alpha" as the active campaign name
13. Navigate to `/session`
14. Verify the session screen shows the campaign name "Test Campaign Alpha" as a heading
15. Navigate to `/notes`
16. Verify the notes screen loads (action bar with "Quick Note", "Quick NPC", "Location" buttons visible) rather than the NoCampaignPrompt

## Expected Results
- Campaign selector overlay opens when header button is clicked
- "+ Create Campaign" opens the creation modal
- Create button is disabled when name is empty, enabled when name is provided
- Submitting the form creates the campaign and sets it as active
- Campaign name appears in the header after creation
- Session and Notes screens recognize the new active campaign

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Campaign is created, becomes active, and is reflected in the header and dependent screens
- **Fail:** Modal does not open, form validation does not work, campaign is not created, or campaign does not become active after creation
