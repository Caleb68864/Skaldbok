# Phase Spec: SS-02 — ProfileScreen (New)

## Dependencies
- **SS-01** (SheetScreen Identity) — depends on portrait data model (`portraitUri`, `metadata.appearance`, `metadata.notes` on `CharacterRecord`).
- **SS-08** (Bottom Nav Configuration) — depends on configurable bottom nav infrastructure for optional Profile tab. Can stub the nav registration if SS-08 is not yet complete.

## Objective
Create a new ProfileScreen component with hero-sized portrait, appearance text area, and notes text area. Register it in the app's routing/navigation system as accessible from the hamburger menu and optionally from bottom nav.

## Requirements Covered
REQ-005, REQ-006

## Files to Modify
- `src/screens/ProfileScreen.tsx` — **NEW FILE** — hero portrait, appearance, notes
- `src/types/character.ts` (or equivalent) — ensure `metadata.appearance` and `metadata.notes` fields exist
- Routing/navigation config file — register ProfileScreen route
- Hamburger menu component — add Profile menu item
- `src/components/layout/BottomNav.tsx` — register Profile as optional tab (off by default)
- `src/theme/theme.css` — styles for hero portrait, text areas

## Acceptance Criteria
1. `[STRUCTURAL]` ProfileScreen renders a hero-sized portrait image taking approximately 40% of the viewport height, with an upload/change overlay button.
2. `[STRUCTURAL]` Below the portrait, an appearance multi-line text area is rendered.
3. `[STRUCTURAL]` Below appearance, a notes multi-line text area is rendered.
4. `[BEHAVIORAL]` In play mode, both text areas are read-only and the upload button is hidden. In edit mode, text areas are editable and upload is available.
5. `[BEHAVIORAL]` Changes to appearance and notes persist to `character.metadata.appearance` and `character.metadata.notes` in IndexedDB.
6. `[BEHAVIORAL]` If no portrait is set, a placeholder silhouette fills the hero area with an "Add Portrait" button.
7. `[STRUCTURAL]` ProfileScreen is accessible from the hamburger menu.
8. `[STRUCTURAL]` ProfileScreen is available as an optional bottom nav tab (off by default, configurable in Settings).
9. `[STRUCTURAL]` Touch targets on upload button and text areas meet >= 44px minimum.

## Implementation Steps

1. **Ensure type fields exist**: Verify/add `metadata.appearance?: string` and `metadata.notes?: string` to the character type definition (may already be done by SS-01).

2. **Create ProfileScreen component** (`src/screens/ProfileScreen.tsx`):
   - Import character context and mode context.
   - Render hero portrait section (~40vh) with the character's `portraitUri`. If no portrait, show placeholder silhouette with "Add Portrait" button.
   - Upload overlay button (edit mode only): same image upload + canvas compression logic as SS-01.
   - Appearance `<textarea>` — bound to `character.metadata.appearance`. Read-only in play mode.
   - Notes `<textarea>` — bound to `character.metadata.notes`. Read-only in play mode.
   - Persist changes on blur/change to IndexedDB via existing character update pattern.

3. **Register route**: Add ProfileScreen to the app's routing/navigation system following existing screen patterns.

4. **Add hamburger menu item**: Add "Profile" to the hamburger menu, navigating to ProfileScreen.

5. **Register as optional bottom nav tab**: Add Profile to BottomNav tab definitions with `defaultVisible: false`. If SS-08 isn't complete yet, just add the tab entry — configurability will come from SS-08.

6. **Add CSS**: Styles for `.profile-hero`, `.profile-textarea`, placeholder silhouette in `theme.css`. Ensure all three themes work via CSS custom properties.

## Edge Cases
- No portrait: placeholder silhouette fills hero area with "Add Portrait" button.
- Play mode: text areas read-only, upload button hidden.
- Large portrait upload: same canvas compression as SS-01 (<=500KB).
- Touch targets >= 44px on all interactive elements.
- Theme switch: all elements adapt via CSS custom properties.

## Constraints
- New file `ProfileScreen.tsx`. Follows existing screen component patterns.
- No new npm dependencies.
- Component must not exceed 400 lines.
- Reuse portrait upload logic from SS-01 (extract shared utility if needed).

## Verification Commands
```bash
# Build check
npx vite build

# Verify new file exists
ls src/screens/ProfileScreen.tsx

# Verify route registration
grep -r "ProfileScreen\|profile" src/App.tsx

# Verify hamburger menu entry
grep -r "Profile" src/components/layout/

# Verify text area and portrait elements
grep -r "appearance\|notes\|portraitUri" src/screens/ProfileScreen.tsx

# Verify theme styles
grep -r "profile-hero\|profile-textarea" src/theme/theme.css
```
