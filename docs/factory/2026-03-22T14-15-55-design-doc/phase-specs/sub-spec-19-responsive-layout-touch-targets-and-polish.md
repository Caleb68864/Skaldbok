---
type: phase-spec
master_spec: "C:\\Users\\CalebBennett\\Documents\\GitHub\\Skaldmark\\docs\\factory\\2026-03-22T14-15-55-design-doc\\spec.md"
sub_spec_number: 19
title: "Responsive Layout, Touch Targets, and Cross-Orientation Polish"
date: 2026-03-22
dependencies: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"]
---

# Sub-Spec 19: Responsive Layout, Touch Targets, and Cross-Orientation Polish

Refined from spec.md -- Factory Run 2026-03-22T14-15-55-design-doc.

## Scope

Final polish pass across all screens to ensure portrait/landscape support on tablets, minimum 44x44px touch targets on all interactive elements, empty states with helpful placeholder text, storage write failure surfacing, and overall visual consistency. This sub-spec depends on all others being complete.

## Interface Contracts

### Provides
- Updated CSS and layout adjustments across all screen and component files
- Error boundary or toast system for surfacing storage write failures
- Empty state components or patterns applied to all screens

### Requires
- From sub-specs 1-18: All screens and components must exist

### Shared State
None -- this is a cross-cutting polish pass.

## Implementation Steps

### Step 1: Audit and fix touch targets
- **Files:** All component files in `src/components/primitives/`, `src/components/fields/`, `src/components/layout/`
- **Action:** modify
- **Changes:**
  - Ensure all buttons, toggles, chips, counter controls, nav items have `min-width: 44px; min-height: 44px`
  - Add padding to small elements to meet the 44x44px threshold
  - BottomNav items: ensure each nav item meets the target
  - TopBar buttons: ensure each button meets the target
  - Use the `--touch-target-min` CSS variable consistently

### Step 2: Add responsive layout rules
- **File:** `src/theme/theme.css`, `src/app/AppLayout.tsx`
- **Action:** modify
- **Changes:**
  - Add CSS media queries for portrait vs landscape:
    - Portrait (width < height): stack sections vertically, full-width cards
    - Landscape (width > height): optionally use 2-column layout for Sheet/Combat sections
  - Ensure BottomNav stays at bottom in both orientations
  - Ensure TopBar does not overlap content
  - Test at 768x1024 (portrait tablet) and 1024x768 (landscape tablet)
  - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` to prevent pinch-zoom

### Step 3: Add empty states to all screens
- **Files:** All screen files
- **Action:** modify
- **Changes:**
  - CharacterLibraryScreen: "No characters yet. Create your first character to get started."
  - SheetScreen: Already guards for no active character (redirects to library)
  - SkillsScreen: No empty state needed (system skills always exist)
  - GearScreen: "No weapons" / "No inventory items" sections show helpful text
  - MagicScreen: "No spells yet. Switch to Edit Mode to add spells." / "No heroic abilities yet."
  - CombatScreen: Redirect if no active character
  - ReferenceScreen: "No reference notes yet. Add your own shorthand notes."
  - SettingsScreen: No empty state needed

### Step 4: Add storage error handling
- **File:** `src/hooks/useAutosave.ts`, `src/utils/importExport.ts`, relevant screen files
- **Action:** modify
- **Changes:**
  - Create a simple toast/notification system or use a state variable for error display
  - In `useAutosave`: if save fails, show error message to user (e.g., "Failed to save changes. Storage may be full.")
  - In import: errors already surfaced (sub-spec 15)
  - In character actions: catch and surface write failures
  - Ensure errors are never silently swallowed

### Step 5: Visual consistency pass
- **Files:** `src/theme/theme.css`, various component CSS
- **Action:** modify
- **Changes:**
  - Ensure consistent spacing using `--space-*` variables
  - Ensure consistent border radius using `--radius-*` variables
  - Ensure all text uses `--font-size-*` variables
  - Verify parchment theme looks distinct and fantasy-inspired
  - Verify dark theme has sufficient contrast
  - Verify light theme is clean and readable

### Step 6: Final build verification
- **Run:** `npm run build`
- **Expected:** Build succeeds with zero errors and zero warnings.

### Step 7: Commit
- **Stage:** `git add .`
- **Message:** `feat: responsive layout, touch targets, and polish`

## Acceptance Criteria

- `[BEHAVIORAL]` Rotating the device between portrait and landscape does not break any screen layout (REQ-043)
- `[STRUCTURAL]` All interactive elements (buttons, toggles, counters, nav items) have a minimum effective touch area of 44x44px as verified by CSS inspection (REQ-044)
- `[BEHAVIORAL]` No screen requires pinch-zoom to access any control on a 10-inch tablet viewport (REQ-043)
- `[BEHAVIORAL]` Empty states (no characters, no spells, no notes) show helpful placeholder text rather than blank screens (REQ-042)

## Verification Commands

- **Build:** `npm run build`
- **Tests:** No test framework -- manual verification.
- **Type-check:** `npx tsc --noEmit`
- **Acceptance:**
  - Orientation: Use Chrome DevTools device emulation (iPad), toggle between portrait/landscape on each screen
  - Touch targets: Inspect interactive elements in DevTools, verify computed min-width/min-height >= 44px
  - Pinch-zoom: Verify `user-scalable=no` in viewport meta and test on tablet
  - Empty states: Clear all data, navigate to each screen, verify helpful placeholder text

## Patterns to Follow

- Use CSS media queries for orientation-specific layouts, not JavaScript detection.
- Touch target enforcement: prefer adding padding over making elements visually larger (padding extends touch area without changing visual size).
- Empty states should be encouraging, not error-like: use muted text with a clear call-to-action.
- Storage errors use a non-blocking notification (toast) rather than a modal (user should not be blocked from continuing to use the app).

## Files

| File | Action | Purpose |
|------|--------|---------|
| src/theme/theme.css | Modify | Responsive layout rules and touch target enforcement |
| src/app/AppLayout.tsx | Modify | Layout adjustments for orientation support |
| index.html | Modify | Viewport meta tag for pinch-zoom prevention |
| src/components/primitives/*.tsx | Modify | Touch target size enforcement |
| src/components/fields/*.tsx | Modify | Touch target size enforcement |
| src/components/layout/*.tsx | Modify | Touch target and layout adjustments |
| src/screens/*.tsx | Modify | Empty states and error handling |
| src/hooks/useAutosave.ts | Modify | Storage error surfacing |
