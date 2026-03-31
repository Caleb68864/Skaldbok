---
scenario_id: "UI-02"
title: "Profile Screen portrait upload and bio editing"
tool: "playwright"
type: test-scenario
tags:
  - test-scenario
---

# Scenario UI-02: Profile Screen portrait upload and bio editing

## Description
Verify the Profile Screen displays the portrait placeholder, supports image upload, and allows editing of the Appearance and Notes text areas.

## Preconditions
- A character exists and is set as active.
- The app mode is set to "edit" (Edit Mode) so that text areas are writable and the upload button is visible.
- A test image file (JPEG or PNG, under 500KB) is available at a known path for upload.

## Steps
1. Navigate to `http://localhost:5173/profile`.
2. Assert the profile screen loads (look for the class `profile-screen` or the profile hero area).
3. Assert the portrait placeholder is visible: look for the text "No portrait set" inside `.profile-hero__placeholder`.
4. Assert the "Add Portrait" button is visible (aria-label "Add portrait image").
5. Locate the hidden file input with aria-label "Choose portrait image file".
6. Upload a test image file (e.g., `test-portrait.png`) to the file input using Playwright's file upload capability.
7. Wait for the portrait image to render. Assert an `<img>` element with alt text containing "portrait" is now visible inside `.profile-hero`.
8. Assert the "No portrait set" text is no longer visible.
9. Assert the "Change Portrait" button is now visible (aria-label "Change portrait image"), replacing the "Add Portrait" button.
10. Locate the Appearance textarea (id `profile-appearance`). Assert it is present and editable (not readonly).
11. Clear the Appearance textarea and type "Tall with dark hair and a scar across the left cheek."
12. Assert the textarea value matches the typed text.
13. Locate the Notes textarea (id `profile-notes`). Assert it is present and editable.
14. Clear the Notes textarea and type "Former soldier from the Misty Vale. Seeks revenge for a fallen comrade."
15. Assert the textarea value matches the typed text.
16. Navigate away to `http://localhost:5173/character/sheet`, then navigate back to `http://localhost:5173/profile`.
17. Assert the Appearance textarea still contains "Tall with dark hair and a scar across the left cheek." (autosave persisted).
18. Assert the Notes textarea still contains the previously entered text.
19. Assert the portrait image is still displayed (not reverted to placeholder).

## Expected Results
- The portrait placeholder renders initially with "No portrait set" text.
- After uploading an image, the portrait `<img>` element renders and the placeholder disappears.
- Appearance and Notes textareas accept input and display the entered text.
- Data persists across navigation (autosave via Dexie/IndexedDB).

## Execution Tool
playwright -- Navigate, interact, and verify using Playwright MCP tools

## Pass / Fail Criteria
- **Pass:** Portrait upload displays the image, both text areas accept and persist input across navigation.
- **Fail:** Portrait does not display after upload, text areas are readonly in edit mode, or data does not persist after navigating away and back.
