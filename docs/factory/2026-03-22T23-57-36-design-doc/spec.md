# Spec: Sheet Enhancements, Session Tools, Advancement Tracking, and UX Fixes

## Meta
- Client: Caleb Bennett (personal)
- Project: Skaldmark — The Adventurer's Ledger
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldmark
- Date: 2026-03-22
- Author: Forge Dark Factory
- Quality Score: 25/30
  - Outcome: 5/5
  - Scope: 5/5
  - Decision guidance: 5/5
  - Edges: 4/5
  - Criteria: 3/5
  - Decomposition: 3/5
- Status: draft

## Outcome

The Skaldmark TTRPG PWA receives a comprehensive update across nine sub-systems: (1) SheetScreen gains age, weakness, portrait thumbnail, AGL damage bonus, and rest buttons; (2) a new ProfileScreen displays hero portrait, appearance, and notes; (3) SkillsScreen adds a global boon/bane selector, per-skill overrides with condition-driven auto-bane, adjusted probability display, attribute tags, and dragon mark toggles; (4) CombatScreen gains duplicated rest buttons; (5) shared rest action logic handles round and stretch rest with user-entered physical dice results; (6) ReferenceScreen upgrades to two-tier pill navigation with sub-section pills; (7) TopBar mode toggle gets its own layout slot to prevent overlap; (8) BottomNav becomes configurable via Settings with toggle visibility per tab; (9) a new End-of-Session Modal walks through the Dragonbane advancement flow (session checklist → bonus roll assignment → roll-through → summary). Session boon/bane state is ephemeral in `AppStateContext`; character advancement data persists to IndexedDB. Done means: all nine features are implemented, the app builds with `vite build`, touch targets ≥ 44px, all three themes render correctly, and session state persists across screen navigation but resets on app restart.

## Intent

Trade-Off Hierarchy:
1. **Correctness of game mechanics over speed of implementation** — boon/bane probability math, advancement rules, rest recovery logic, and damage bonus calculations must faithfully represent Dragonbane rules. Inaccurate mechanics break trust with TTRPG players.
2. **Data integrity over UX polish** — dragon marks, advancement checks, and skill values persist to IndexedDB. Session state (boon/bane) is ephemeral by design. Never persist session state; never lose persisted data.
3. **Touch usability over information density** — every interactive element (buttons, toggles, pills, selectors) must meet the 44px minimum touch target. If content doesn't fit, use scrolling or collapsing — not smaller targets.
4. **Additive architecture over refactors** — new features extend existing patterns (`AppStateContext`, `SectionPanel`, `ResourceTracker` style). Do not restructure existing context providers, state shape, or component hierarchies beyond what the design requires.
5. **Cross-platform consistency over platform-specific polish** — all features must work in mobile Chrome, Safari, Firefox, and desktop browsers. No platform-specific APIs beyond `IntersectionObserver` (with graceful degradation).

Decision Boundaries — stop and escalate if:
- A change would require modifying the Dexie database schema version or migration logic beyond adding new fields to `CharacterRecord`
- The `AppStateContext` state shape change for `sessionState` would break existing consumers
- Any component file exceeds 400 lines after changes
- A new npm dependency would be required
- AGL damage bonus formula cannot be confirmed (see Open Questions)
- Session advancement checklist items cannot be confirmed from rulebook

Decide autonomously for everything else.

## Context

Skaldmark is a Dragonbane TTRPG character sheet PWA built with React + TypeScript + Vite. It uses IndexedDB (via Dexie) for persistence, a three-theme system (dark/parchment/light) via CSS custom properties, and a play/edit mode toggle. The app currently has Sheet, Skills, Gear, Magic, Combat, and Reference screens accessible via bottom navigation.

Key architectural decisions from the design:
- **Session state** (`globalBoonBane`, `skillOverrides`) lives in `AppStateContext` as in-memory-only state — survives screen navigation but resets on app restart. This matches the session-oriented nature of TTRPG play.
- **Character data** (dragon marks, advancement checks, age, weakness, appearance, notes, portrait) persists to IndexedDB via the existing `ActiveCharacterContext` and Dexie layer.
- **Profile** is a new screen, accessible from hamburger menu and optionally bottom nav.
- **Rest actions** appear on both Sheet and Combat screens, sharing logic via a utility function.
- **End-of-Session Modal** is a multi-step wizard triggered from hamburger menu.

Key files (existing):
- `src/context/AppStateContext.tsx` — app-wide settings and state
- `src/context/ActiveCharacterContext.tsx` — current character data
- `src/screens/SheetScreen.tsx` — main character sheet
- `src/screens/SkillsScreen.tsx` — skills list
- `src/screens/CombatScreen.tsx` — combat tracker
- `src/screens/ReferenceScreen.tsx` — reference materials
- `src/components/layout/TopBar.tsx` — app header with mode toggle
- `src/components/layout/BottomNav.tsx` — bottom tab navigation
- `src/theme/theme.css` — all design tokens and component CSS
- `src/types/` — TypeScript type definitions

Key files (new):
- `src/screens/ProfileScreen.tsx` — hero portrait, appearance, notes
- `src/components/modals/EndOfSessionModal.tsx` — advancement wizard
- `src/utils/restActions.ts` — shared rest logic
- `src/utils/boonBane.ts` — probability calculation utilities

## Requirements

1. REQ-001: SheetScreen identity section displays age and weakness fields below kin and profession.
2. REQ-002: SheetScreen displays a portrait thumbnail (~64px) next to character name with tap-to-lightbox.
3. REQ-003: SheetScreen derived values section includes both STR and AGL damage bonuses.
4. REQ-004: SheetScreen has a "Rest & Recovery" section with Round Rest and Stretch Rest buttons (play mode only).
5. REQ-005: A new ProfileScreen displays hero-sized portrait with upload, appearance text area, and notes text area.
6. REQ-006: ProfileScreen is read-only in play mode and editable in edit mode.
7. REQ-007: SkillsScreen displays a global boon/bane three-segment selector at the top.
8. REQ-008: SkillsScreen supports per-skill boon/bane override (cycle: boon → bane → inherit-global).
9. REQ-009: SkillsScreen shows adjusted probability percentages when boon or bane is active.
10. REQ-010: SkillsScreen auto-applies bane when a skill's linked attribute has its condition active; boon + auto-bane cancel to normal.
11. REQ-011: SkillsScreen displays governing attribute tag per skill row.
12. REQ-012: SkillsScreen supports dragon mark toggle per skill with gold highlight and count badge.
13. REQ-013: CombatScreen includes round rest and stretch rest buttons matching SheetScreen.
14. REQ-014: Round rest prompts for d6 WP recovery input, adds to WP.current (capped at max), shows toast.
15. REQ-015: Stretch rest prompts for d6 WP and d6 HP inputs, restores WP to max, adds HP (capped), optionally clears one condition.
16. REQ-016: ReferenceScreen uses two-tier pill navigation: top-level category pills expand sub-section pills below.
17. REQ-017: Only one reference category is expanded at a time; sub-pill taps scroll to section; active sub-pill tracked via IntersectionObserver.
18. REQ-018: TopBar mode toggle has a dedicated layout slot that does not overlap other top bar buttons at any viewport width.
19. REQ-019: On narrow screens (<360px), the mode toggle collapses to icon-only (no label text).
20. REQ-020: BottomNav tabs are configurable via Settings screen toggle per tab.
21. REQ-021: All screens remain accessible via hamburger menu regardless of bottom nav config.
22. REQ-022: End-of-Session Modal Step 1 presents a session event checklist; each checked item = 1 bonus advancement roll.
23. REQ-023: End-of-Session Modal Step 2 lets the player assign bonus rolls to specific skills.
24. REQ-024: End-of-Session Modal Step 3 presents each marked + bonus skill one at a time with Pass/Fail buttons.
25. REQ-025: End-of-Session Modal Step 4 shows a summary of advanced skills; "Done" clears all marks and checks.
26. REQ-026: Session boon/bane state is ephemeral (in-memory only in AppStateContext), surviving screen navigation but not app restart.
27. REQ-027: Dragon marks and advancement checks persist to IndexedDB.
28. REQ-028: The app builds cleanly with `vite build` after all changes.
29. REQ-029: All interactive elements maintain ≥ 44px touch targets.
30. REQ-030: All features render correctly across dark, parchment, and light themes.

## Sub-Specs

### SS-1: SheetScreen Identity Section — Age, Weakness, Portrait, Damage Bonuses
- **Scope:** Add age and weakness metadata fields to the identity section, a portrait thumbnail with lightbox, and AGL damage bonus to derived values. Extend `CharacterRecord` type with `metadata.age`, `metadata.weakness` if not already present.
- **Files likely touched:** `src/screens/SheetScreen.tsx`, `src/types/character.ts` (or equivalent), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Age and weakness fields render below kin and profession in the identity section, using a 2×2 grid on viewports ≥ 600px and single-column on narrower.
  2. `[STRUCTURAL]` A portrait thumbnail image (~64px) is rendered next to the character name. If no portrait exists, a placeholder silhouette is shown.
  3. `[BEHAVIORAL]` Tapping the portrait thumbnail opens a full-size lightbox modal overlay displaying the portrait at max available resolution.
  4. `[BEHAVIORAL]` An upload button is available on the portrait (edit mode only) that accepts image files, compresses to ≤ 500KB, and stores as data URI in `portraitUri`.
  5. `[BEHAVIORAL]` Invalid file types are rejected with a toast: "Please select an image file".
  6. `[STRUCTURAL]` AGL damage bonus is displayed in the derived values section alongside STR damage bonus, movement, HP max, and WP max.
  7. `[BEHAVIORAL]` AGL damage bonus is computed with the same threshold logic as STR damage bonus (≥17 → +D6, ≥13 → +D4, ≤12 → +0) unless an alternative formula is confirmed.
  8. `[BEHAVIORAL]` Age and weakness fields are editable in edit mode and read-only in play mode.
  9. `[STRUCTURAL]` All new fields have `aria-label` attributes for accessibility.
- **Dependencies:** Character type extension for `metadata.age`, `metadata.weakness`, `portraitUri`
- **Constraints:** Reuse existing field component patterns. Portrait storage as data URI (no external hosting). No new npm dependencies for image compression — use canvas-based resize.

### SS-2: ProfileScreen (New)
- **Scope:** Create a new ProfileScreen component with hero-sized portrait, appearance text area, and notes text area. Register it in the app's routing/navigation system.
- **Files likely touched:** `src/screens/ProfileScreen.tsx` (new), `src/components/layout/BottomNav.tsx`, routing/navigation config
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` ProfileScreen renders a hero-sized portrait image taking approximately 40% of the viewport height, with an upload/change overlay button.
  2. `[STRUCTURAL]` Below the portrait, an appearance multi-line text area is rendered.
  3. `[STRUCTURAL]` Below appearance, a notes multi-line text area is rendered.
  4. `[BEHAVIORAL]` In play mode, both text areas are read-only and the upload button is hidden. In edit mode, text areas are editable and upload is available.
  5. `[BEHAVIORAL]` Changes to appearance and notes persist to `character.metadata.appearance` and `character.metadata.notes` in IndexedDB.
  6. `[BEHAVIORAL]` If no portrait is set, a placeholder silhouette fills the hero area with an "Add Portrait" button.
  7. `[STRUCTURAL]` ProfileScreen is accessible from the hamburger menu.
  8. `[STRUCTURAL]` ProfileScreen is available as an optional bottom nav tab (off by default, configurable in Settings).
  9. `[STRUCTURAL]` Touch targets on upload button and text areas meet ≥ 44px minimum.
- **Dependencies:** SS-1 (portrait data model), SS-8 (configurable bottom nav)
- **Constraints:** New file `ProfileScreen.tsx`. Follows existing screen component patterns.

### SS-3: SkillsScreen — Boon/Bane Controls and Session State
- **Scope:** Add global boon/bane selector, per-skill overrides, condition-driven auto-bane, adjusted probability display, and attribute tags to SkillsScreen. Extend `AppStateContext` with ephemeral `sessionState`.
- **Files likely touched:** `src/screens/SkillsScreen.tsx`, `src/context/AppStateContext.tsx`, `src/utils/boonBane.ts` (new), `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` A three-segment control (Boon / Normal / Bane) is rendered at the top of the skills list, controlling `sessionState.globalBoonBane`.
  2. `[BEHAVIORAL]` Tapping a segment sets `sessionState.globalBoonBane` to `'boon'`, `'none'`, or `'bane'`. State persists across screen navigation but not app restart.
  3. `[BEHAVIORAL]` Tapping the boon/bane area on a skill row cycles through: boon → bane → inherit-global. Per-skill overrides are stored in `sessionState.skillOverrides[skillId]`.
  4. `[STRUCTURAL]` Each skill row displays the adjusted probability when boon or bane is effective. Format: "Swords 14 AGL — 14% (26% with boon)".
  5. `[BEHAVIORAL]` Boon probability is calculated as `P = 1 - (1 - value/20)²`. Bane probability is calculated as `P = (value/20)²`.
  6. `[BEHAVIORAL]` If a skill's linked attribute has its condition active (e.g., Dazed → AGL skills), auto-bane is applied. Boon + auto-bane = normal. Bane + auto-bane = single bane (no stacking).
  7. `[STRUCTURAL]` Each skill row displays a small attribute tag (STR, AGL, INT, etc.) next to the skill name.
  8. `[STRUCTURAL]` `AppStateContext` gains a `sessionState` object with `globalBoonBane: 'boon' | 'none' | 'bane'` and `skillOverrides: Record<string, 'boon' | 'bane' | undefined>`, initialized in-memory only.
  9. `[BEHAVIORAL]` Skill value 1 (Dragon roll) displays adjusted % but notes "auto-success" in the display.
  10. `[STRUCTURAL]` The global selector and per-skill overrides have ≥ 44px touch targets.
- **Dependencies:** None (AppStateContext extension is self-contained)
- **Constraints:** Session state must NOT be persisted to IndexedDB or localStorage. Probability calculation is a pure function in a utility file. No changes to existing `settings` state shape — `sessionState` is a sibling.

### SS-4: SkillsScreen — Dragon Marks and Advancement Tracking
- **Scope:** Add dragon mark toggle per skill row with visual feedback and count badge. Extend `CharacterSkill` type with `dragonMarked` field and `CharacterRecord` with `advancementChecks`.
- **Files likely touched:** `src/screens/SkillsScreen.tsx`, `src/types/character.ts`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Each skill row has a dragon mark toggle icon. Marked skills receive a gold highlight.
  2. `[BEHAVIORAL]` Tapping the dragon icon in play mode toggles `skill.dragonMarked` (persisted to IndexedDB).
  3. `[BEHAVIORAL]` In edit mode, the dragon mark toggle is hidden or disabled (marks are a play-mode action).
  4. `[STRUCTURAL]` A count badge near the top of the skills list shows the number of marked skills (e.g., "4 marked").
  5. `[BEHAVIORAL]` Dragon marks persist across app restarts via IndexedDB.
  6. `[STRUCTURAL]` The `CharacterSkill` type gains an optional `dragonMarked: boolean` field.
  7. `[STRUCTURAL]` The `CharacterRecord` type gains an `advancementChecks` object for session event tracking.
  8. `[BEHAVIORAL]` Skill at value 18 (maximum) can still be marked but is flagged during advancement (see SS-7).
- **Dependencies:** None (type extensions are additive)
- **Constraints:** Dragon mark toggle touch target ≥ 44px. Gold highlight uses `var(--color-gold)`.

### SS-5: Rest Actions — Shared Logic and UI
- **Scope:** Implement round rest and stretch rest action flows as shared logic, and add rest buttons to both SheetScreen and CombatScreen. Rest buttons are play-mode only.
- **Files likely touched:** `src/utils/restActions.ts` (new), `src/screens/SheetScreen.tsx`, `src/screens/CombatScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` SheetScreen has a "Rest & Recovery" `SectionPanel` containing Round Rest and Stretch Rest buttons.
  2. `[STRUCTURAL]` CombatScreen has matching Round Rest and Stretch Rest buttons.
  3. `[BEHAVIORAL]` Rest buttons are visible only in play mode. In edit mode, the rest section is hidden or buttons are disabled.
  4. `[BEHAVIORAL]` Round Rest: opens a prompt/modal asking "Roll a d6 for WP recovery", accepts a number input (1–6), adds the value to `WP.current` (capped at `WP.max`), and shows a toast "Recovered X WP".
  5. `[BEHAVIORAL]` Stretch Rest: opens a prompt/modal asking for WP d6 and HP d6 results, sets `WP.current = WP.max`, adds HP value to `HP.current` (capped at `HP.max`), optionally presents condition list to clear one, and shows a toast summary.
  6. `[BEHAVIORAL]` Resting when already at full WP/HP works without error; toast shows "Already at full WP/HP".
  7. `[BEHAVIORAL]` Entered values exceeding remaining capacity are automatically capped at max.
  8. `[STRUCTURAL]` Rest buttons have ≥ 44px touch targets and use existing button styling patterns.
  9. `[BEHAVIORAL]` No in-app dice rolling — all dice results are entered manually from physical dice.
- **Dependencies:** None
- **Constraints:** Shared logic in utility file, consumed by both SheetScreen and CombatScreen. Modal/prompt for dice input reuses existing modal patterns if available.

### SS-6: ReferenceScreen — Two-Tier Pill Navigation
- **Scope:** Upgrade the ReferenceScreen's existing pill navigation to a two-tier system: top-level category pills that expand sub-section pills beneath them. Active sub-pill tracked via IntersectionObserver.
- **Files likely touched:** `src/screens/ReferenceScreen.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` Top pill row contains the existing 4 reference page categories.
  2. `[BEHAVIORAL]` Tapping a top-level pill expands a second row beneath it containing sub-section pills for that category's sections.
  3. `[BEHAVIORAL]` Only one category can be expanded at a time. Tapping another category collapses the previous and expands the new one.
  4. `[BEHAVIORAL]` Tapping a sub-section pill scrolls to that specific section via `scrollIntoView({ behavior: 'smooth' })`.
  5. `[BEHAVIORAL]` An `IntersectionObserver` tracks which section is currently visible and highlights the corresponding sub-pill.
  6. `[STRUCTURAL]` The active sub-pill is visually distinguished (accent background, bold text, or contrasting color).
  7. `[STRUCTURAL]` Sub-pill row is horizontally scrollable with `overflow-x: auto` and `-webkit-overflow-scrolling: touch`.
  8. `[STRUCTURAL]` All pills have ≥ 44px touch targets.
  9. `[BEHAVIORAL]` IntersectionObserver is cleaned up on unmount/tab switch. If unavailable, pills render without active tracking (graceful degradation).
  10. `[BEHAVIORAL]` Each `SectionPanel` in the reference tab has an `id` attribute matching its section ID for scroll targeting.
- **Dependencies:** None
- **Constraints:** Pill bar lives inline in `ReferenceScreen.tsx`. CSS in `theme.css`. Must not conflict with existing DOM IDs.

### SS-7: End-of-Session Modal (New)
- **Scope:** Create a multi-step End-of-Session Modal implementing the Dragonbane advancement flow: session checklist → bonus roll assignment → roll-through → summary.
- **Files likely touched:** `src/components/modals/EndOfSessionModal.tsx` (new), `src/screens/SheetScreen.tsx` or hamburger menu, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` The modal is triggered from a hamburger menu option and/or a button on SheetScreen/CombatScreen.
  2. `[STRUCTURAL]` Step 1 (Session Checklist) presents checkboxes for Dragonbane session events (combat participation, explored new location, role-played weakness, used heroic ability). Each checked = 1 bonus roll.
  3. `[STRUCTURAL]` Step 2 (Assign Bonus Rolls) presents a list of skills (trained-first filter, show-all toggle) where the player assigns each bonus roll to a skill.
  4. `[STRUCTURAL]` Step 3 (Roll Through) presents each dragon-marked + bonus skill one at a time, showing skill name, current value, and target ("roll above 14 on d20"). Two buttons: Pass and Fail.
  5. `[BEHAVIORAL]` Pass increments `skill.value` by 1 and clears the dragon mark. Fail clears the dragon mark only.
  6. `[BEHAVIORAL]` A skill at value 18 (maximum) that appears in the roll-through auto-skips with a message "Already at maximum".
  7. `[STRUCTURAL]` Step 4 (Summary) shows which skills advanced and by how much. "Done" button clears all dragon marks and advancement checks.
  8. `[BEHAVIORAL]` If no marks exist and no session checks are checked, the modal shows "Nothing to advance this session".
  9. `[BEHAVIORAL]` Dragon marks persist in IndexedDB, so if the app closes mid-advancement, the user can re-trigger the modal later.
  10. `[BEHAVIORAL]` Bonus rolls assigned to already-marked skills are valid (one roll covers both).
  11. `[STRUCTURAL]` All buttons and checkboxes have ≥ 44px touch targets.
  12. `[BEHAVIORAL]` Skill value changes persist to IndexedDB immediately upon Pass.
- **Dependencies:** SS-4 (dragon marks data model)
- **Constraints:** New file. Multi-step wizard uses internal component state for step tracking. Must handle edge case of empty advancement gracefully.

### SS-8: TopBar Mode Toggle Fix and Bottom Nav Configuration
- **Scope:** Fix the TopBar mode toggle positioning to prevent overlap with other buttons. Add configurable bottom nav tab visibility in Settings.
- **Files likely touched:** `src/components/layout/TopBar.tsx`, `src/components/layout/BottomNav.tsx`, `src/screens/SettingsScreen.tsx` (or equivalent), `src/context/AppStateContext.tsx`, `src/theme/theme.css`
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` The mode toggle button occupies a dedicated slot in the TopBar layout, not inside the actions button group.
  2. `[BEHAVIORAL]` The mode toggle does not overlap fullscreen, wake-lock, or hamburger buttons at any viewport width ≥ 320px.
  3. `[STRUCTURAL]` On narrow screens (<360px), the mode toggle collapses to icon-only (no label text).
  4. `[STRUCTURAL]` SettingsScreen has a "Bottom Navigation" section with toggle switches for each tab.
  5. `[BEHAVIORAL]` Toggling a tab off removes it from the bottom nav but the screen remains accessible via hamburger menu.
  6. `[BEHAVIORAL]` Default visible tabs: Sheet, Skills, Gear, Magic, Combat, Reference (6 tabs). Profile is optional 7th.
  7. `[BEHAVIORAL]` If all tabs are hidden, the hamburger menu remains the fallback navigation.
  8. `[STRUCTURAL]` On screens <360px wide, bottom nav uses icon-only mode.
  9. `[BEHAVIORAL]` Tab visibility settings persist to IndexedDB/settings.
  10. `[STRUCTURAL]` All bottom nav tabs maintain ≥ 44px touch targets.
- **Dependencies:** SS-2 (Profile as optional tab)
- **Constraints:** TopBar layout fix must not change mode toggle functionality. Settings persistence uses existing settings infrastructure.

### SS-9: AppStateContext Session State Extension
- **Scope:** Extend `AppStateContext` with an ephemeral `sessionState` object for boon/bane tracking. This state lives in-memory only and resets on app restart.
- **Files likely touched:** `src/context/AppStateContext.tsx`, `src/types/settings.ts` (or equivalent)
- **Acceptance Criteria:**
  1. `[STRUCTURAL]` `AppStateContext` exposes `sessionState` with shape: `{ globalBoonBane: 'boon' | 'none' | 'bane', skillOverrides: Record<string, 'boon' | 'bane' | undefined> }`.
  2. `[BEHAVIORAL]` `sessionState` is initialized to `{ globalBoonBane: 'none', skillOverrides: {} }` on app start.
  3. `[BEHAVIORAL]` `sessionState` is NOT persisted to IndexedDB, localStorage, or any storage — it lives only in React state.
  4. `[STRUCTURAL]` Context exposes `setGlobalBoonBane(value)` and `setSkillOverride(skillId, value)` updater functions.
  5. `[BEHAVIORAL]` Existing consumers of `AppStateContext` are not broken — the `settings` shape and all existing functions remain unchanged.
  6. `[STRUCTURAL]` TypeScript types are properly defined for `SessionState` and exported.
- **Dependencies:** None (foundational — SS-3 depends on this)
- **Constraints:** Minimal changes to existing context. `sessionState` is a sibling to `settings`, not nested inside it.

## Edge Cases

- **Portrait upload invalid type:** Reject non-image files with toast "Please select an image file". Only accept common image MIME types (image/jpeg, image/png, image/gif, image/webp).
- **Portrait upload large file:** Compress/resize client-side via canvas before storing. Cap stored data URI at ~500KB. If compression still exceeds limit, reduce dimensions further.
- **No portrait set:** Show placeholder silhouette on both SheetScreen thumbnail and ProfileScreen hero area.
- **Boon/bane skill value 1 (Dragon roll):** Always succeeds in Dragonbane. Display adjusted % but note "auto-success".
- **Boon/bane skill value 20:** Bane shows very low probability. Display honestly — do not special-case.
- **Condition auto-bane + manual bane:** Single bane (no double-bane in Dragonbane rules).
- **Condition auto-bane + manual boon:** Cancel to normal roll.
- **Rest when already full:** Button works, toast shows "Already at full WP" or "Already at full HP". No error.
- **Rest entered value exceeding capacity:** Automatically capped at max — no validation error shown.
- **Rest buttons in edit mode:** Hidden or disabled. Rest is a play-mode action.
- **Advancement skill at 18 (max):** Appears in modal, Pass auto-skips with "Already at maximum" message.
- **No marks + no session checks:** End-of-session modal shows "Nothing to advance this session" with a Close button.
- **App closed mid-advancement:** Dragon marks persist in IndexedDB. User re-triggers modal later to complete advancement.
- **Bonus roll assigned to already-marked skill:** Valid — one roll covers the mark and the bonus.
- **All bottom nav tabs hidden:** Hamburger menu remains always available as navigation fallback.
- **TopBar on very narrow screens (<360px):** Mode toggle collapses to icon-only.
- **Reference two-tier pills with active search:** Top pills always visible. Sub-pills correspond to sections that may be filtered — scrolling to a hidden section is a no-op.
- **IntersectionObserver cleanup:** Observer disconnected on component unmount and tab switch to prevent memory leaks.
- **Theme switch during session:** Boon/bane selector, dragon marks, pills, and all new UI adapts via CSS custom properties — no JS re-render needed for theme changes.
- **Session state across screen flips:** Boon/bane settings persist because they live in AppStateContext (in-memory), not in component local state.
- **Rapid dragon mark toggling:** Each tap is a synchronous state update. React batches correctly.

## Out of Scope

- In-app dice rolling (physical dice only per design)
- Animated transitions between play/edit mode
- Swipe gestures on pill bars
- Drag-to-reorder reference sections or bottom nav tabs
- SVG-based or image-based textures
- Dark mode auto-detection from OS preference (handled elsewhere)
- Unit tests (no test framework for React components in this project)
- Full accessibility audit beyond touch targets and aria labels
- Performance profiling on low-end devices
- Multi-character session state (boon/bane is per-session, not per-character)
- Multiplayer/shared session features
- Export/import of advancement history
- AGL damage bonus formula confirmation (flagged as open question — implement with STR formula as default)

## Constraints

**Musts:**
- All three themes (dark, parchment, light) render correctly for all new features
- Touch targets ≥ 44px on all interactive elements
- Session state (boon/bane) is ephemeral — in-memory only
- Character data (marks, checks, age, weakness, appearance, notes, portrait) persists to IndexedDB
- `vite build` succeeds cleanly after all changes
- Cross-platform: works in Chrome, Safari, Firefox (mobile and desktop)
- Boon/bane probability math matches Dragonbane rules exactly

**Must-Nots:**
- Must not persist session boon/bane state to storage
- Must not add new npm dependencies
- Must not break existing consumers of AppStateContext
- Must not reduce text contrast ratios in any theme
- Must not implement in-app dice rolling
- Must not modify the Dexie migration history in a backward-incompatible way

**Preferences:**
- Prefer inline styles for component-specific layout (consistent with codebase pattern)
- Prefer CSS classes in `theme.css` for shared decoration/texture effects
- Prefer `var(--color-gold)` for accent/highlight colors
- Prefer `scrollIntoView` over manual scroll position calculation
- Prefer reusing existing modal/toast patterns over creating new ones
- Prefer trained-skills-first ordering in advancement UI

**Escalation Triggers:**
- Any single component file exceeds 400 lines
- AGL damage bonus formula differs from STR pattern (need rulebook confirmation)
- Session checklist items differ from assumed list (need rulebook confirmation)
- Dexie schema migration complexity exceeds adding optional fields
- Gold accents clash with a theme's palette

## Verification

End-to-end verification: After all sub-specs are implemented, confirm that:

1. `vite build` completes with no errors from the project root.
2. SheetScreen shows age, weakness fields in identity section.
3. SheetScreen shows portrait thumbnail (~64px) with tap-to-lightbox.
4. SheetScreen shows both STR and AGL damage bonuses in derived values.
5. SheetScreen has "Rest & Recovery" section with Round Rest and Stretch Rest buttons (play mode only).
6. ProfileScreen renders hero portrait, appearance text area, and notes text area.
7. ProfileScreen is read-only in play mode, editable in edit mode.
8. ProfileScreen is accessible from hamburger menu.
9. SkillsScreen has a three-segment boon/bane selector at top.
10. Per-skill boon/bane override cycles correctly (boon → bane → inherit).
11. Adjusted probability percentages display correctly with boon and bane.
12. Condition auto-bane applies correctly; boon + auto-bane cancels to normal.
13. Attribute tags (STR, AGL, etc.) appear next to skill names.
14. Dragon mark toggle works in play mode with gold highlight and count badge.
15. CombatScreen has matching rest buttons.
16. Round rest flow: prompt → input → WP recovery → toast.
17. Stretch rest flow: prompt → inputs → WP full + HP recovery → optional condition clear → toast.
18. ReferenceScreen has two-tier pill nav: top pills expand sub-section pills.
19. Sub-pill taps scroll to corresponding sections.
20. Active sub-pill highlights based on scroll position via IntersectionObserver.
21. TopBar mode toggle has dedicated slot, does not overlap other buttons.
22. Mode toggle collapses to icon-only on screens <360px.
23. Settings has "Bottom Navigation" section with per-tab toggles.
24. Hiding all tabs leaves hamburger menu as fallback.
25. End-of-Session Modal: checklist → assign rolls → roll-through → summary flow works end-to-end.
26. Advancement Pass increments skill value by 1 and clears mark.
27. Advancement Fail clears mark without incrementing.
28. "Done" in summary clears all marks and advancement checks.
29. Session boon/bane state persists across screen navigation.
30. Session boon/bane state resets on app restart.
31. Dragon marks persist across app restarts.
32. All interactive elements have ≥ 44px touch targets.
33. All three themes render correctly with all new features.
34. No `pointer-events` are intercepted by decorative elements.
