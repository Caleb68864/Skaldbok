# Spec: UX Polish and Visual Texture — Attribute Buttons, Mode Toggle, Reference Jump Nav, Fantasy Styling

## Meta
- Client: Caleb Bennett (personal)
- Project: Skaldmark — The Adventurer's Ledger
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldmark
- Date: 2026-03-22
- Author: Forge Dark Factory
- Quality Score: 26/30
  - Outcome: 5/5
  - Scope: 5/5
  - Decision guidance: 5/5
  - Edges: 4/5
  - Criteria: 4/5
  - Decomposition: 3/5
- Status: draft

## Outcome

The Skaldmark character sheet PWA gains four independent touch-first UX improvements: (1) horizontal +/- stepper buttons replace the number `<input>` in `AttributeField` during edit mode, matching the existing `ResourceTracker` pattern; (2) the TopBar mode toggle button displays a `GameIcon` and explicit "PLAY MODE" / "EDIT MODE" label with a thicker colored border; (3) the Reference screen gains a floating pill bar above the bottom nav for quick section jumping via `scrollIntoView` with `IntersectionObserver`-driven active pill tracking; (4) a CSS-only fantasy texture system applies noise grain, leather headers, embossed inputs, beveled borders, and gold accents across all three themes (dark, parchment, light) using CSS custom properties and pseudo-elements. Done means: all four features are implemented in existing component files and `theme.css`, all three themes render correctly, touch targets remain >= 44px, and the app builds cleanly with `vite build`.

## Intent

Trade-Off Hierarchy:
1. **Touch usability over visual polish** — every interactive element must meet the 44px minimum touch target. If a texture or decoration would reduce tap accuracy, remove it.
2. **Theme consistency over individual flair** — all texture effects must adapt automatically via CSS custom properties. No theme-specific hardcoded colors in texture layers.
3. **Behavioral parity over new features** — the `AttributeField` stepper must produce identical `onChange` calls with identical min/max clamping as the current `<input type="number">`. No data model changes.
4. **Additive CSS over structural refactors** — texture additions go into `theme.css` as new rule blocks. Do not restructure existing selectors or move styles out of inline to CSS classes (except where the design explicitly calls for it).
5. **Progressive enhancement over hard requirements** — if `IntersectionObserver` is unavailable, the pill bar renders without active tracking. If CSS pseudo-elements don't paint on a browser, the app is still fully usable.

Decision Boundaries — stop and escalate if:
- A change would require modifying `AppStateContext` or `useAppState` beyond reading existing `settings.mode`
- The `AttributeField` props interface would need to change in a way that breaks existing call sites in `SheetScreen.tsx`
- Any texture CSS causes a measurable layout shift (CLS) on mobile Chrome
- A new npm dependency would be required for any feature

Decide autonomously for everything else.

## Context

Skaldmark is a Dragonbane TTRPG character sheet PWA built with React + TypeScript + Vite. It uses IndexedDB for persistence, a three-theme system (dark/parchment/light) via CSS custom properties on `[data-theme]`, and a play/edit mode toggle that controls field editability via `modeGuards.ts`.

The current state has four pain points this spec addresses:

1. **Attribute editing is clunky on mobile.** `AttributeField` uses `<input type="number">` which requires keyboard interaction. The `ResourceTracker` component already has touch-friendly +/- buttons (52px) — attributes should match this pattern.

2. **Mode toggle is ambiguous.** The TopBar button says "PLAY" or "EDIT" but doesn't explain that it's a mode indicator/toggle. Adding an icon and "MODE" suffix makes the state clearer.

3. **Reference screen requires scrolling to find sections.** With 13+ reference sections, users must scroll extensively. A floating jump nav solves this without consuming permanent screen space.

4. **Visual surfaces are flat.** The app has correct colors but no depth or texture. A fantasy TTRPG app should feel like a physical artifact — leather, parchment, embossing.

Key files:
- `src/components/fields/AttributeField.tsx` — attribute value display/edit (91 lines)
- `src/components/fields/ResourceTracker.tsx` — existing +/- button pattern (147 lines)
- `src/components/layout/TopBar.tsx` — mode toggle button, app header (139 lines)
- `src/components/layout/BottomNav.tsx` — sticky bottom navigation (31 lines)
- `src/components/primitives/SectionPanel.tsx` — collapsible section wrapper (55 lines)
- `src/components/primitives/GameIcon.tsx` — icon component (used for game-icons.net SVGs)
- `src/screens/ReferenceScreen.tsx` — reference tab with search and section panels (211 lines)
- `src/screens/SheetScreen.tsx` — main character sheet consuming AttributeField (212 lines)
- `src/theme/theme.css` — all design tokens and component CSS (553 lines)
- `src/data/dragonbaneReference.ts` — reference section data with `referencePages` categories
- `src/context/AppStateContext.tsx` — provides `settings.mode` and `toggleMode()`
- `src/types/settings.ts` — `ModeName = 'play' | 'edit'`

Existing patterns to follow:
- `ResourceTracker` uses inline `React.CSSProperties` objects for button styling with `minWidth: '52px'`, `minHeight: '52px'`
- `GameIcon` is used throughout for game-icons.net SVG icons (e.g., `crossed-swords`, `person`, `backpack`)
- `SectionPanel` renders a collapsible header + content div with `var(--color-surface-alt)` background headers
- Reference sections have `id` fields that can serve as scroll targets
- Theme CSS uses `[data-theme="dark"]`, `[data-theme="parchment"]`, `[data-theme="light"]` selectors

## Requirements

1. REQ-001: `AttributeField` displays horizontal `[-] value [+]` buttons in edit mode instead of `<input type="number">`.
2. REQ-002: `AttributeField` displays a static value (no buttons, no input) in play mode (when `disabled` is true).
3. REQ-003: Attribute +/- buttons are at least 48px touch targets and visually match `ResourceTracker` button style.
4. REQ-004: Attribute buttons clamp values to `min`/`max` props (default 3–18) and disable at boundaries.
5. REQ-005: The TopBar mode toggle button displays a `GameIcon` (`crossed-swords` for play, `open-book` for edit) alongside text.
6. REQ-006: The TopBar mode toggle label reads "PLAY MODE" or "EDIT MODE" (not just "PLAY"/"EDIT").
7. REQ-007: The TopBar bottom border is visually prominent (>= 3px) and colored by mode (green for play, blue for edit).
8. REQ-008: The Reference screen displays a floating pill bar above the bottom nav when the reference tab is active.
9. REQ-009: Each pill in the bar corresponds to a reference page category from `referencePages` (Combat & Time, Core Rules, NPCs & Animals, NPC Generator & Travel).
10. REQ-010: Tapping a pill scrolls to the first section in that category via `scrollIntoView({ behavior: 'smooth' })`.
11. REQ-011: The active pill is tracked via `IntersectionObserver` on section headers and visually highlighted.
12. REQ-012: The pill bar is compact (approximately 36px height), horizontally scrollable, and positioned `fixed` above the bottom nav.
13. REQ-013: CSS-only noise grain texture is applied to `body` background across all three themes.
14. REQ-014: Panel headers (`SectionPanel`) receive a leather-strip treatment (darker gradient + gold bottom border).
15. REQ-015: Inputs and buttons receive embossed/inset shadow styling via `box-shadow: inset`.
16. REQ-016: Cards and panels receive beveled border treatment (light top-left, dark bottom-right shadows).
17. REQ-017: Gold accent lines (`border-bottom` using `var(--color-gold)`) are applied to headers and the top bar.
18. REQ-018: All texture effects use CSS custom properties and `rgba()` overlays, automatically adapting to dark, parchment, and light themes.
19. REQ-019: All texture pseudo-elements are decorative (`pointer-events: none`) and do not affect layout or text contrast.
20. REQ-020: The app builds cleanly with `vite build` after all changes.

## Sub-Specs

### SS-1: AttributeField Touch-Friendly Stepper Buttons
- **Scope:** Replace `<input type="number">` in `AttributeField.tsx` with button-driven `[-] value [+]` counter, conditional on the `disabled` prop. Edit mode shows buttons; play mode shows static value only.
- **Files likely touched:** `src/components/fields/AttributeField.tsx`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` When `disabled` is false (edit mode), `AttributeField` renders a `<button>` for decrement, a `<span>` for the value, and a `<button>` for increment — no `<input type="number">` element.
  2. `[STRUCTURAL]` When `disabled` is true (play mode), `AttributeField` renders only a `<span>` displaying the value — no buttons, no input.
  3. `[BEHAVIORAL]` The decrement button calls `onChange(value - 1)` and is disabled when `value <= min`. The increment button calls `onChange(value + 1)` and is disabled when `value >= max`.
  4. `[BEHAVIORAL]` Default min/max remain 3 and 18 respectively, matching Dragonbane attribute range.
  5. `[STRUCTURAL]` Both stepper buttons have `minWidth` and `minHeight` of at least 48px, and the value span has `minWidth` of at least 40px with centered text.
  6. `[STRUCTURAL]` Buttons use a style object consistent with `ResourceTracker`'s `bigButtonStyle` pattern: `var(--color-surface-alt)` background, `var(--color-border)` border, `var(--color-text)` color, `userSelect: 'none'`.
  7. `[STRUCTURAL]` Each button has an `aria-label` attribute: "Decrease {abbreviation}" and "Increase {abbreviation}".
  8. `[BEHAVIORAL]` Existing call sites in `SheetScreen.tsx` require zero changes — the `AttributeFieldProps` interface is unchanged.
  9. `[STRUCTURAL]` Linked condition buttons below the attribute are unaffected — they render identically in both modes.
- **Dependencies:** none
- **Constraints:** No changes to `AttributeFieldProps` interface. The `onChange` callback signature is identical. No new component files.

### SS-2: TopBar Mode Toggle Enhancement
- **Scope:** Update the mode toggle button in `TopBar.tsx` to include a `GameIcon` and explicit "PLAY MODE" / "EDIT MODE" label. Ensure the top bar border is thick and mode-colored.
- **Files likely touched:** `src/components/layout/TopBar.tsx`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` The mode toggle button renders a `GameIcon` component: `name="crossed-swords"` in play mode, `name="open-book"` in edit mode.
  2. `[STRUCTURAL]` The button text reads "PLAY MODE" when `settings.mode === 'play'` and "EDIT MODE" when `settings.mode === 'edit'`.
  3. `[STRUCTURAL]` The button displays the icon and text inline with a gap (e.g., `display: 'inline-flex'`, `alignItems: 'center'`, `gap`).
  4. `[BEHAVIORAL]` The `onClick` handler remains `toggleMode` — no functional change to mode switching behavior.
  5. `[STRUCTURAL]` The `top-bar` header element's `borderBottom` is at least `3px solid` using `var(--color-mode-play)` or `var(--color-mode-edit)` based on current mode.
  6. `[BEHAVIORAL]` The `aria-label` attribute updates to "Switch to Edit Mode" or "Switch to Play Mode" based on current state.
- **Dependencies:** none
- **Constraints:** No changes to `AppStateContext` or `toggleMode()`. The `GameIcon` component is already available. No new state or props.

### SS-3: Reference Screen Floating Jump Nav
- **Scope:** Add a floating pill bar to `ReferenceScreen.tsx` that appears only on the reference tab, with pills for each reference page category. Implement smooth scrolling on tap and `IntersectionObserver`-driven active pill tracking.
- **Files likely touched:** `src/screens/ReferenceScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` A horizontal pill bar is rendered with `position: fixed` at the bottom of the viewport, above the bottom nav (e.g., `bottom: calc(var(--touch-target-min) + 8px)`), with `z-index` above content but below the bottom nav's z-index or equal.
  2. `[STRUCTURAL]` The pill bar contains one button per entry in `referencePages`: "Combat & Time", "Core Rules", "NPCs & Animals", "NPC Generator & Travel".
  3. `[BEHAVIORAL]` Tapping a pill calls `document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' })` where `sectionId` is the first section ID in that page's `sections` array.
  4. `[STRUCTURAL]` Each `SectionPanel` in the reference tab receives an `id` attribute matching its `section.id`, so `scrollIntoView` can target it.
  5. `[BEHAVIORAL]` An `IntersectionObserver` watches section header elements and updates the active pill to the most recently intersecting section's parent page category.
  6. `[STRUCTURAL]` The active pill is visually distinguished (e.g., `var(--color-accent)` background, bold text or contrasting color).
  7. `[STRUCTURAL]` The pill bar is only visible when `activeTab === 'reference'` — hidden on the notes tab.
  8. `[STRUCTURAL]` The pill bar has `overflow-x: auto` for horizontal scrolling, compact height (~36px), and `-webkit-overflow-scrolling: touch`.
  9. `[STRUCTURAL]` Pills have a minimum touch target of 44px height via padding.
  10. `[BEHAVIORAL]` If `IntersectionObserver` is not available (graceful degradation), the pill bar renders without active tracking — pills still scroll on tap.
- **Dependencies:** none
- **Constraints:** No new component files for the pill bar — it lives inline in `ReferenceScreen.tsx`. CSS for the pill bar goes in `theme.css`. Section IDs must not conflict with existing DOM IDs.

### SS-4: CSS-Only Fantasy Texture System
- **Scope:** Add CSS rules to `theme.css` that apply decorative textures across all three themes: noise grain on body, paper texture on panel content, leather strip on panel headers, embossed inputs/buttons, beveled borders on cards/panels, and gold accent lines. All effects use CSS custom properties, pseudo-elements, and `rgba()` overlays.
- **Files likely touched:** `src/theme/theme.css`, `src/components/primitives/SectionPanel.tsx` (add className for CSS targeting)
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` `body` receives a subtle noise grain via a repeating `radial-gradient` or similar CSS-only pattern applied as a `::before` or `::after` pseudo-element with `pointer-events: none` and `position: fixed` covering the viewport.
  2. `[STRUCTURAL]` `.section-panel__header` (or equivalent selector targeting `SectionPanel` headers) receives a darker gradient background and a `border-bottom: 2px solid var(--color-gold)` gold accent.
  3. `[STRUCTURAL]` `input`, `textarea`, `select`, and stepper/resource buttons receive an embossed look via `box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), inset 0 -1px 2px rgba(255,255,255,0.1)` or similar.
  4. `[STRUCTURAL]` `.section-panel` (or equivalent selector) receives a beveled border effect: lighter shadow on top-left edge, darker shadow on bottom-right edge.
  5. `[STRUCTURAL]` `.top-bar` receives a `border-bottom` using `var(--color-gold)` or the existing mode-colored border is supplemented with a gold accent.
  6. `[STRUCTURAL]` Headings (`h1`–`h3`) inside panels receive a subtle gold underline or bottom border accent.
  7. `[BEHAVIORAL]` All texture values (grain opacity, shadow depths, gold color) derive from CSS custom properties defined in each `[data-theme]` block, so dark/parchment/light each get appropriate intensity.
  8. `[STRUCTURAL]` Each theme block (`[data-theme="dark"]`, `[data-theme="parchment"]`, `[data-theme="light"]`) gains texture-specific custom properties: `--texture-grain-opacity`, `--texture-shadow-strength`, `--texture-highlight-strength`.
  9. `[BEHAVIORAL]` All pseudo-elements used for textures have `pointer-events: none` and `z-index` that does not intercept clicks on interactive elements.
  10. `[BEHAVIORAL]` Text contrast ratios remain unchanged — textures are applied behind or around text, not over it.
  11. `[STRUCTURAL]` `SectionPanel.tsx` adds a `className` (e.g., `section-panel`, `section-panel__header`, `section-panel__body`) to its root div, header div, and content div so CSS can target them without inline style conflicts.
  12. `[MECHANICAL]` `vite build` succeeds with no errors after all CSS additions.
- **Dependencies:** none (but SS-1 buttons will inherit the embossed style)
- **Constraints:** CSS-only — no JavaScript for textures. No images or external assets. No changes to layout or spacing tokens. Texture pseudo-elements must not cause scrollbar overflow. `SectionPanel` className additions must not break existing inline styles.

## Edge Cases

- **AttributeField at min/max boundary:** When `value === min`, the decrement button is `disabled` (grayed, no click handler fires). When `value === max`, the increment button is `disabled`. Both boundaries are respected simultaneously if `min === max`.
- **AttributeField with no linkedConditions:** Renders cleanly with just the abbreviation, buttons/value, and no condition row. Same as current behavior.
- **TopBar on narrow screens:** The "PLAY MODE" / "EDIT MODE" text plus icon may overflow on very narrow viewports (< 320px). Use `white-space: nowrap` and let the button flex-shrink if needed, but the icon alone is sufficient to convey mode.
- **Reference pill bar with active search filter:** When search filters hide some sections, pills for hidden sections still appear (they scroll to the section anchor, which may be invisible). This is acceptable — the user can clear search to see all sections.
- **Reference pill bar with collapsed sections:** `scrollIntoView` targets the `SectionPanel` root div (which has the `id`), so it scrolls to the header even when the section body is collapsed.
- **IntersectionObserver cleanup on tab switch:** The observer must be disconnected when switching to the notes tab or when the component unmounts, to prevent memory leaks.
- **Texture grain on high-DPI screens:** The repeating gradient pattern should use small enough dimensions (2–4px) to appear as fine grain, not visible dots, on retina displays.
- **Inline styles vs CSS classes on SectionPanel:** Adding classNames to `SectionPanel` must not override existing inline styles. CSS rules should use specificity carefully or only target properties not set inline.
- **Theme switch while on reference tab:** Pill bar and textures adapt automatically via CSS custom properties — no JS-side re-render needed for texture changes.
- **Rapid +/- button tapping on attributes:** Each tap is a synchronous `onChange(value ± 1)` call. React batches state updates, so rapid taps work correctly without debouncing.
- **Body pseudo-element and scroll:** The noise grain uses `position: fixed` so it doesn't scroll with content and doesn't create extra scrollable area.
- **Gold accent on parchment theme:** Gold (`#9C7934`) on parchment (`#E8D8B2`) has sufficient contrast as a decorative line but should not carry semantic meaning.

## Out of Scope

- Animated transitions between play/edit mode (e.g., button morphing, color fade)
- Swipe gestures on the pill bar to switch between reference pages
- Drag-to-reorder reference sections
- SVG-based textures or image assets for leather/parchment looks
- Dark mode auto-detection from OS preference (already handled elsewhere in ThemeProvider)
- Changes to any screen other than SheetScreen (via AttributeField), ReferenceScreen, and TopBar
- Unit tests for the UI components (no test framework is set up for React components in this project)
- Accessibility audit beyond maintaining existing touch targets and aria labels
- Performance profiling of CSS pseudo-elements on low-end devices
- Refactoring inline styles to CSS classes (beyond the minimal SectionPanel classNames needed for texture targeting)

## Constraints

**Musts:**
- All changes are in existing files: `AttributeField.tsx`, `TopBar.tsx`, `ReferenceScreen.tsx`, `SectionPanel.tsx`, `theme.css`
- Touch targets >= 44px on all interactive elements (buttons, pills, nav items)
- All three themes (dark, parchment, light) render correctly with textures
- `AttributeFieldProps` interface is unchanged — no breaking changes to call sites
- CSS textures use only custom properties and `rgba()` — no hardcoded theme-specific colors in texture rules
- `vite build` succeeds cleanly

**Must-Nots:**
- Must not modify `AppStateContext.tsx`, `modeGuards.ts`, or any data/type files
- Must not add new npm dependencies
- Must not use JavaScript for visual texture effects
- Must not change layout spacing tokens (`--space-*`, `--radius-*`)
- Must not reduce text contrast ratios in any theme
- Must not add `<input type="number">` back to `AttributeField` under any condition

**Preferences:**
- Prefer inline styles for component-specific layout (consistent with existing codebase pattern)
- Prefer CSS classes in `theme.css` only for texture/decoration effects that span multiple components
- Prefer `var(--color-gold)` for accent lines over introducing new color tokens
- Prefer `scrollIntoView` over scroll position calculation for jump nav

**Escalation Triggers:**
- `theme.css` exceeds 800 lines after additions — consider splitting into `theme-textures.css`
- Any single component file exceeds 300 lines after changes
- `IntersectionObserver` causes scroll jank on mobile — consider removing active tracking
- Gold accents clash with a theme's palette — escalate for design guidance

## Verification

End-to-end verification: After all sub-specs are implemented, confirm that:

1. `vite build` completes with no errors from the project root.
2. `AttributeField` renders `[-] value [+]` buttons in edit mode — no `<input type="number">` in the DOM.
3. `AttributeField` renders a static value span in play mode — no buttons in the DOM.
4. Attribute +/- buttons respect min=3, max=18 boundaries and disable correctly.
5. TopBar mode button shows `GameIcon` + "PLAY MODE" or "EDIT MODE".
6. TopBar border is >= 3px and colored by mode.
7. Reference screen shows a floating pill bar with 4 category pills when reference tab is active.
8. Tapping a pill scrolls to the corresponding section.
9. Active pill highlights based on scroll position.
10. Pill bar is hidden on notes tab.
11. Body has visible noise grain texture in all three themes.
12. `SectionPanel` headers have leather/gold treatment.
13. Inputs and buttons have embossed shadow appearance.
14. Panels have beveled border effect.
15. All textures adapt correctly when switching between dark, parchment, and light themes.
16. No interactive element has a touch target smaller than 44px.
17. `SectionPanel.tsx` has classNames on root, header, and body divs.
18. No `pointer-events` are intercepted by texture pseudo-elements.
