# Phase Spec: SS-01 — SheetScreen Identity Section (Age, Weakness, Portrait, Damage Bonuses)

## Dependencies
- **None** — This is a foundational sub-spec. SS-2 (ProfileScreen) depends on the portrait data model established here.

## Objective
Add age and weakness metadata fields to the identity section, a portrait thumbnail with lightbox, and AGL damage bonus to derived values on SheetScreen. Extend `CharacterRecord` type with `metadata.age`, `metadata.weakness`, and `portraitUri`.

## Requirements Covered
REQ-001, REQ-002, REQ-003

## Files to Modify
- `src/types/character.ts` (or equivalent type definition file) — extend `CharacterRecord` with `metadata.age`, `metadata.weakness`, `portraitUri`
- `src/screens/SheetScreen.tsx` — add age/weakness fields, portrait thumbnail, lightbox, AGL damage bonus
- `src/theme/theme.css` — styles for portrait thumbnail, lightbox overlay, responsive grid

## Acceptance Criteria
1. `[STRUCTURAL]` Age and weakness fields render below kin and profession in the identity section, using a 2x2 grid on viewports >= 600px and single-column on narrower.
2. `[STRUCTURAL]` A portrait thumbnail image (~64px) is rendered next to the character name. If no portrait exists, a placeholder silhouette is shown.
3. `[BEHAVIORAL]` Tapping the portrait thumbnail opens a full-size lightbox modal overlay displaying the portrait at max available resolution.
4. `[BEHAVIORAL]` An upload button is available on the portrait (edit mode only) that accepts image files, compresses to <= 500KB, and stores as data URI in `portraitUri`.
5. `[BEHAVIORAL]` Invalid file types are rejected with a toast: "Please select an image file".
6. `[STRUCTURAL]` AGL damage bonus is displayed in the derived values section alongside STR damage bonus, movement, HP max, and WP max.
7. `[BEHAVIORAL]` AGL damage bonus is computed with the same threshold logic as STR damage bonus (>=17 -> +D6, >=13 -> +D4, <=12 -> +0) unless an alternative formula is confirmed.
8. `[BEHAVIORAL]` Age and weakness fields are editable in edit mode and read-only in play mode.
9. `[STRUCTURAL]` All new fields have `aria-label` attributes for accessibility.

## Implementation Steps

1. **Extend character types**: In `src/types/character.ts`, add optional fields to the character metadata interface:
   - `age?: string`
   - `weakness?: string`
   - `portraitUri?: string`

2. **Add portrait thumbnail**: In SheetScreen identity section, render a ~64px thumbnail next to the character name. Use a placeholder silhouette SVG/div when `portraitUri` is falsy.

3. **Implement lightbox**: Create a simple modal overlay triggered by tapping the thumbnail. Display the portrait at full resolution. Close on backdrop tap or close button.

4. **Implement portrait upload** (edit mode only):
   - Add a file input accepting `image/jpeg,image/png,image/gif,image/webp`.
   - Validate MIME type; reject with toast "Please select an image file" on invalid type.
   - Compress via canvas: draw image to canvas, reduce dimensions if needed, export as JPEG data URI targeting <= 500KB.
   - Store result in `portraitUri` field.

5. **Add age and weakness fields**: Render below kin and profession. Use a responsive grid (2x2 at >= 600px, single-column below). Fields are editable in edit mode, read-only in play mode.

6. **Add AGL damage bonus**: In derived values section, compute AGL damage bonus using same threshold logic as STR:
   - AGL >= 17: +D6
   - AGL >= 13: +D4
   - AGL <= 12: +0
   Display alongside existing STR damage bonus.

7. **Add aria-labels**: Ensure all new fields have appropriate `aria-label` attributes.

8. **Add CSS**: Add styles for `.portrait-thumbnail`, `.portrait-lightbox`, responsive grid for age/weakness fields to `theme.css`. Ensure all three themes render correctly via CSS custom properties.

## Edge Cases
- No portrait set: show placeholder silhouette on thumbnail.
- Portrait upload invalid type: reject with toast.
- Portrait upload large file: compress via canvas, reduce dimensions iteratively until <= 500KB.
- All new interactive elements must have >= 44px touch targets.

## Constraints
- Reuse existing field component patterns.
- Portrait storage as data URI (no external hosting).
- No new npm dependencies for image compression — use canvas-based resize.
- Component must not exceed 400 lines after changes.

## Verification Commands
```bash
# Build check
npx vite build

# Verify type extension exists
grep -r "age" src/types/character.ts
grep -r "weakness" src/types/character.ts
grep -r "portraitUri" src/types/character.ts

# Verify SheetScreen references new fields
grep -r "age\|weakness\|portraitUri\|damage.*bonus\|AGL.*bonus" src/screens/SheetScreen.tsx

# Verify aria-labels
grep -r "aria-label" src/screens/SheetScreen.tsx

# Verify theme styles
grep -r "portrait-thumbnail\|portrait-lightbox" src/theme/theme.css
```
