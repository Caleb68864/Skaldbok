# Phase Spec: SS-06 — ReferenceScreen Two-Tier Pill Navigation

## Dependencies
- **None** — Self-contained feature.

## Objective
Upgrade the ReferenceScreen's existing pill navigation to a two-tier system: top-level category pills that expand sub-section pills beneath them, with active sub-pill tracked via IntersectionObserver.

## Requirements Covered
REQ-016, REQ-017

## Files to Modify
- `src/screens/ReferenceScreen.tsx` — two-tier pill navigation, IntersectionObserver, scroll behavior
- `src/theme/theme.css` — pill styles, active states, sub-pill row

## Acceptance Criteria
1. `[STRUCTURAL]` Top pill row contains the existing 4 reference page categories.
2. `[BEHAVIORAL]` Tapping a top-level pill expands a second row beneath it containing sub-section pills for that category's sections.
3. `[BEHAVIORAL]` Only one category can be expanded at a time. Tapping another category collapses the previous and expands the new one.
4. `[BEHAVIORAL]` Tapping a sub-section pill scrolls to that specific section via `scrollIntoView({ behavior: 'smooth' })`.
5. `[BEHAVIORAL]` An `IntersectionObserver` tracks which section is currently visible and highlights the corresponding sub-pill.
6. `[STRUCTURAL]` The active sub-pill is visually distinguished (accent background, bold text, or contrasting color).
7. `[STRUCTURAL]` Sub-pill row is horizontally scrollable with `overflow-x: auto` and `-webkit-overflow-scrolling: touch`.
8. `[STRUCTURAL]` All pills have >= 44px touch targets.
9. `[BEHAVIORAL]` IntersectionObserver is cleaned up on unmount/tab switch. If unavailable, pills render without active tracking (graceful degradation).
10. `[BEHAVIORAL]` Each `SectionPanel` in the reference tab has an `id` attribute matching its section ID for scroll targeting.

## Implementation Steps

1. **Define section data structure**: Create a mapping of top-level categories to their sub-sections with IDs matching DOM element IDs.

2. **Modify top pill row**: Keep existing 4 category pills. Add state tracking for which category is expanded (`expandedCategory`).

3. **Add sub-pill row**:
   - Render below the active top pill.
   - Contains pills for each sub-section of the expanded category.
   - Horizontally scrollable: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`.
   - Animated expand/collapse (CSS transition on max-height or similar).

4. **Implement scroll-to-section**:
   - On sub-pill tap, call `document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })`.
   - Ensure each `SectionPanel` has an `id` attribute matching section IDs.

5. **Implement IntersectionObserver tracking**:
   - Create observer watching all section elements with appropriate threshold.
   - On intersection change, update `activeSubPill` state.
   - Cleanup: disconnect observer on unmount and category switch.
   - Graceful degradation: if `IntersectionObserver` is undefined, skip active tracking.

6. **Style active sub-pill**: Apply accent background or bold text to the active sub-pill via CSS class.

7. **Add CSS**: Styles for `.sub-pill-row`, `.sub-pill`, `.sub-pill--active`, horizontal scroll in `theme.css`. All three themes via CSS custom properties.

## Edge Cases
- IntersectionObserver unavailable: pills render without active tracking (graceful degradation).
- IntersectionObserver cleanup: disconnected on component unmount and tab switch.
- Reference two-tier pills with active search: top pills always visible. Scrolling to a hidden section is a no-op.
- Must not conflict with existing DOM IDs.
- Theme switch: all pill styles adapt via CSS custom properties.

## Constraints
- Pill bar lives inline in `ReferenceScreen.tsx`.
- CSS in `theme.css`.
- Must not conflict with existing DOM IDs.
- No new npm dependencies.
- Component must not exceed 400 lines.
- All pills have >= 44px touch targets.

## Verification Commands
```bash
# Build check
npx vite build

# Verify two-tier pill structure
grep -r "sub-pill\|expandedCategory\|IntersectionObserver" src/screens/ReferenceScreen.tsx

# Verify scrollIntoView usage
grep -r "scrollIntoView" src/screens/ReferenceScreen.tsx

# Verify section IDs
grep -r "id=" src/screens/ReferenceScreen.tsx

# Verify pill styles
grep -r "sub-pill\|pill--active" src/theme/theme.css

# Verify observer cleanup
grep -r "disconnect\|cleanup\|useEffect" src/screens/ReferenceScreen.tsx
```
