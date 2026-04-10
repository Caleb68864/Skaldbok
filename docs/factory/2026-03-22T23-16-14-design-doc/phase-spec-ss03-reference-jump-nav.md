# Phase Spec — SS-03: Reference Screen Floating Jump Nav

## Dependencies
None. This sub-spec can be implemented independently.

## Objective
Add a floating pill bar to `ReferenceScreen.tsx` for quick section jumping via `scrollIntoView`. Implement `IntersectionObserver`-driven active pill tracking. Style the pill bar in `theme.css`.

## Files to Modify
- `src/screens/ReferenceScreen.tsx`
- `src/theme/theme.css`

## Files to Read (Reference Only)
- `src/data/dragonbaneReference.ts` — confirm `referencePages` structure, category names, section IDs
- `src/components/primitives/SectionPanel.tsx` — confirm how sections are rendered, ensure `id` can be passed through
- `src/components/layout/BottomNav.tsx` — confirm bottom nav height/positioning for pill bar placement

## Acceptance Criteria
1. `[STRUCTURAL]` A horizontal pill bar is rendered with `position: fixed` at the bottom of the viewport, above the bottom nav (e.g., `bottom: calc(var(--touch-target-min) + 8px)`), with `z-index` above content but below or equal to the bottom nav's z-index.
2. `[STRUCTURAL]` The pill bar contains one button per entry in `referencePages`: "Combat & Time", "Core Rules", "NPCs & Animals", "NPC Generator & Travel".
3. `[BEHAVIORAL]` Tapping a pill calls `document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })` where `sectionId` is the first section ID in that page's `sections` array.
4. `[STRUCTURAL]` Each `SectionPanel` in the reference tab receives an `id` attribute matching its `section.id`, so `scrollIntoView` can target it.
5. `[BEHAVIORAL]` An `IntersectionObserver` watches section header elements and updates the active pill to the most recently intersecting section's parent page category.
6. `[STRUCTURAL]` The active pill is visually distinguished (e.g., `var(--color-accent)` background, bold text or contrasting color).
7. `[STRUCTURAL]` The pill bar is only visible when `activeTab === 'reference'` — hidden on the notes tab.
8. `[STRUCTURAL]` The pill bar has `overflow-x: auto` for horizontal scrolling, compact height (~36px), and `-webkit-overflow-scrolling: touch`.
9. `[STRUCTURAL]` Pills have a minimum touch target of 44px height via padding.
10. `[BEHAVIORAL]` If `IntersectionObserver` is not available (graceful degradation), the pill bar renders without active tracking — pills still scroll on tap.

## Implementation Steps

1. **Read `dragonbaneReference.ts`** to understand the `referencePages` data structure — extract category names and the first section ID per page for scroll targets.
2. **Read `ReferenceScreen.tsx`** to understand current rendering structure, how `activeTab` is tracked, and where `SectionPanel` components are rendered.
3. **Read `SectionPanel.tsx`** to confirm how to pass an `id` prop through to the root div.
4. **Read `BottomNav.tsx`** to determine bottom nav height and z-index for pill bar positioning.
5. **Read `theme.css`** to understand existing CSS custom property patterns and find the right insertion point for pill bar styles.
6. **Modify `ReferenceScreen.tsx`**:
   - Add `id` attributes to each `SectionPanel` (or its wrapper div) matching the section's `id` field.
   - Create a mapping from `referencePages` entries to their first section ID for scroll targets.
   - Add state: `const [activePage, setActivePage] = useState<string>(referencePages[0]?.name ?? '')`.
   - Render the pill bar conditionally when `activeTab === 'reference'`:
     - `position: 'fixed'`, `bottom: 'calc(var(--touch-target-min) + 8px)'`, `left: 0`, `right: 0`.
     - `display: 'flex'`, `overflowX: 'auto'`, `WebkitOverflowScrolling: 'touch'`.
     - `zIndex` appropriate (e.g., 90, below bottom nav).
     - `className="reference-pill-bar"` for CSS styling.
   - Each pill button:
     - Text = page category name (possibly abbreviated if long).
     - `onClick` → `document.getElementById(firstSectionId)?.scrollIntoView({ behavior: 'smooth' })`.
     - Active state styling when `activePage === page.name`.
     - `minHeight: '44px'` via padding for touch target compliance.
   - Add `useEffect` for `IntersectionObserver`:
     - Guard: `if (!('IntersectionObserver' in window)) return;`
     - Create observer watching all section elements by ID.
     - On intersection, determine which page category the intersecting section belongs to and `setActivePage(pageName)`.
     - Cleanup: `observer.disconnect()` on unmount or tab switch.
   - Ensure observer is disconnected when `activeTab !== 'reference'`.
7. **Modify `theme.css`**:
   - Add `.reference-pill-bar` styles: background with slight transparency, backdrop-filter if desired, border-radius, padding, gap between pills.
   - Add `.reference-pill-bar button` styles: pill shape (border-radius, padding, font-size), default and active states.
   - Active pill: `var(--color-accent)` background, contrasting text color.
   - Ensure styles adapt to all three themes via CSS custom properties.

## Edge Cases
- **Active search filter hiding sections:** Pills for hidden sections still appear and attempt to scroll; this is acceptable per spec.
- **Collapsed sections:** `scrollIntoView` targets the `SectionPanel` root div (which has the `id`), scrolling to the header even when collapsed.
- **IntersectionObserver cleanup on tab switch:** Observer MUST be disconnected when switching to notes tab or on component unmount.
- **Theme switch while on reference tab:** Pill bar adapts via CSS custom properties — no JS re-render needed.
- **Section IDs must not conflict:** Use existing section `id` fields from `dragonbaneReference.ts` data — verify no conflicts with other DOM IDs.

## Constraints
- No new component files — pill bar lives inline in `ReferenceScreen.tsx`.
- CSS for pill bar goes in `theme.css`.
- No new npm dependencies.
- Touch targets >= 44px on all pills.
- Must not modify `AppStateContext.tsx` or any data/type files.

## Verification Commands
```bash
# Build must succeed
npx vite build

# Verify pill bar rendering
grep -n "reference-pill-bar\|pill" src/screens/ReferenceScreen.tsx
# Expected: pill bar container and pill buttons

# Verify scrollIntoView usage
grep -n "scrollIntoView" src/screens/ReferenceScreen.tsx
# Expected: at least 1 match

# Verify IntersectionObserver usage
grep -n "IntersectionObserver" src/screens/ReferenceScreen.tsx
# Expected: at least 1 match with graceful degradation guard

# Verify section IDs are set
grep -n "id=" src/screens/ReferenceScreen.tsx
# Expected: id attributes on SectionPanel elements

# Verify CSS styles added
grep -n "reference-pill-bar" src/theme/theme.css
# Expected: pill bar CSS rules

# Verify observer cleanup
grep -n "disconnect" src/screens/ReferenceScreen.tsx
# Expected: observer.disconnect() in cleanup
```
