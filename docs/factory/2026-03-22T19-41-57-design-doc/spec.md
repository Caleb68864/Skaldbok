# Forge Specification: Skaldmark Dragonbane PWA — Phase 2 Enhancements

**Run ID**: `2026-03-22T19-41-57-design-doc`
**Branch**: `2026/03/22-1939-caleb-feat-design-doc`
**Date**: 2026-03-22
**Objective**: Implement Reference tab with full Dragonbane reference data, fix rules engine deviations, complete gear forms, wire mode guards, improve navigation, refactor styles, and add a toast system.
**Constraints**: Correctness over speed. No shell commands. Cross-platform.

---

## Intent Hierarchy

```
L0  Skaldmark PWA is a complete, usable Dragonbane digital character sheet
 L1  All game-reference data from the official reference sheet is accessible in-app
  L2  Reference tab renders all 15 YAML-sourced sections as browsable content
  L2  Reference data matches dragonbane_reference_sheet.yaml exactly
 L1  Rules engine computes derived values correctly per Dragonbane rules
  L2  Encumbrance limit formula matches official rules (no +5 deviation)
  L2  Damage bonus thresholds align with reference sheet
  L2  Skill base-chance lookup aligns with reference sheet
 L1  All character management screens are fully functional in both play and edit modes
  L2  GearScreen has drawer-based armor/helmet edit forms
  L2  Mode guard hook is used consistently (not inline checks)
 L1  All routes are reachable via standard navigation
  L2  Reference and Settings appear in navigation UI
 L1  Code quality meets production standards
  L2  Inline styles migrated to CSS modules
  L2  Responsive layout handles orientation changes
  L2  Non-modal feedback via toast/notification system
```

---

## Sub-Specifications

### SS-01: Reference Tab — Full Dragonbane Reference Data

**Priority**: P0 (Critical)
**Score**: 30 / 100
**Intent**: L1 > L2 — All game-reference data from the official reference sheet is accessible in-app

#### Description

The existing `ReferenceScreen` at `/reference` currently only displays user-created notes. It must be extended (or replaced) to render the full Dragonbane reference sheet data sourced from `dragonbane_reference_sheet.yaml`. This includes all 15 sections organized into browsable, searchable content within the PWA.

#### Data Sections Required

All sections from the reference YAML must be rendered:

| # | Section ID | Type | Row/Item Count |
|---|-----------|------|----------------|
| 1 | `measuring_time` | table | 3 rows |
| 2 | `free_actions` | key_value_list | 4 items |
| 3 | `actions` | key_value_list | 16 items |
| 4 | `severe_injuries` | table | 14 rows |
| 5 | `attributes` | table | 6 rows |
| 6 | `skills` | table | 31 rows (incl. weapon sub-skills) |
| 7 | `healing_and_rest` | table | 3 rows |
| 8 | `conditions` | table | 6 rows + footnote |
| 9 | `fear` | table | 8 rows |
| 10 | `skill_level_base_chance` | table | 5 rows |
| 11 | `typical_npcs` | table | 11 rows |
| 12 | `common_animals` | table | 11 rows |
| 13 | `npc_attribute_guidelines` | rules_text | 5 paragraphs |
| 14 | `creating_npcs` | table | 20 rows |
| 15 | `mishaps` | table | 12 rows |

#### Rendering Rules (from Blueprint)

- Section headers: dark green (`#2f5b1f`) bar with white uppercase text
- Table headers: lighter green (`#9bc07b`) background, bold
- Table body: alternating row striping (`#ffffff` / `#e4eddc`)
- Key-value lists: bold label (20% width), body text (80% width)
- Rules text: freeform paragraphs
- Page grouping from blueprint `pages` array should inform collapsible section grouping

#### Implementation Approach

- Reference data should be bundled as a static JSON/TS module (converted from YAML at build time or hardcoded as a TypeScript constant)
- The `ReferenceScreen` should render this data alongside existing user notes (user notes in a separate tab/section)
- Use `SectionPanel` (collapsible) for each reference section
- Tables rendered with proper column headers and row striping
- Search/filter functionality across all reference sections

#### Acceptance Criteria

- [ ] **AC-01.1**: ReferenceScreen renders all 15 sections from `dragonbane_reference_sheet.yaml`
- [ ] **AC-01.2**: Each section displays correct title, matching the `title` field in the YAML
- [ ] **AC-01.3**: Table sections render with column headers and all rows (row counts match YAML)
- [ ] **AC-01.4**: Key-value list sections render with bold labels and description text
- [ ] **AC-01.5**: Rules text sections render as paragraphs
- [ ] **AC-01.6**: Conditions section includes the footnote: "Bane on all rolls against attribute and skill rolls based on that attribute"
- [ ] **AC-01.7**: Reference sections use Dragonbane theme colors (green header bars, alternating row stripes)
- [ ] **AC-01.8**: User-created reference notes remain accessible (not removed)
- [ ] **AC-01.9**: Section content is searchable or filterable
- [ ] **AC-01.10**: Data values match YAML source exactly (spot-check: Severe Injuries has 14 entries d20 1-2 through 20; Skills has 31 entries; Typical NPCs has 11 entries including 3 boss types)

---

### SS-02: Armor/Helmet Edit Forms (Drawer-Based in GearScreen)

**Priority**: P1 (High)
**Score**: 15 / 100
**Intent**: L1 > L2 — GearScreen has drawer-based armor/helmet edit forms

#### Description

GearScreen currently supports equip/unequip toggles for armor and helmet, but lacks drawer-based forms for editing armor/helmet properties (name, rating/protection value, weight, body part coverage, movement penalty). These forms should follow the same Drawer pattern used for weapons and spells editing elsewhere in the app.

#### Fields Required

**Armor Form**:
- Name (text)
- Rating / Protection (number — damage reduction)
- Body part (select or text — what it covers)
- Weight (number — contributes to encumbrance)
- Movement penalty (number — if applicable)
- Equipped (toggle — already exists)

**Helmet Form**:
- Name (text)
- Rating / Protection (number)
- Weight (number)
- Equipped (toggle — already exists)

#### Acceptance Criteria

- [ ] **AC-02.1**: Tapping armor card in edit mode opens a Drawer with editable fields
- [ ] **AC-02.2**: Tapping helmet card in edit mode opens a Drawer with editable fields
- [ ] **AC-02.3**: Changes persist to IndexedDB via `updateCharacter()`
- [ ] **AC-02.4**: Drawer uses existing `Drawer` primitive component
- [ ] **AC-02.5**: Fields are disabled / drawer does not open in play mode (respects mode guard)
- [ ] **AC-02.6**: Armor weight value feeds into encumbrance calculation
- [ ] **AC-02.7**: Empty/new character can add armor and helmet where none existed before

---

### SS-03: Encumbrance Formula Fix

**Priority**: P0 (Critical)
**Score**: 10 / 100
**Intent**: L1 > L2 — Encumbrance limit formula matches official rules

#### Description

`computeEncumbranceLimit(character)` in `src/utils/derivedValues.ts` currently returns `Math.ceil(STR / 2) + 5`. The Dragonbane core rules define encumbrance capacity as **half STR (rounded up)** with no +5 bonus. The formula has a +5 deviation that must be corrected.

#### Cross-Reference with Reference Sheet

The reference sheet YAML does not include an explicit encumbrance section (it's in the core rules, not the reference supplement). However, the Dragonbane core rules (p. 46) specify:

> Carrying capacity = STR / 2 (rounded up)

The current formula `Math.ceil(STR / 2) + 5` adds 5 extra units of capacity. This is incorrect.

#### Acceptance Criteria

- [ ] **AC-03.1**: `computeEncumbranceLimit(character)` returns `Math.ceil(STR / 2)` (no +5)
- [ ] **AC-03.2**: GearScreen encumbrance display reflects corrected formula
- [ ] **AC-03.3**: Encumbrance warning triggers at the correct threshold
- [ ] **AC-03.4**: Characters with `derivedOverrides` for encumbrance still work (override takes precedence)

---

### SS-04: Mode Guard Wiring into GearScreen / MagicScreen

**Priority**: P1 (High)
**Score**: 10 / 100
**Intent**: L1 > L2 — Mode guard hook is used consistently

#### Description

A dedicated mode guard system exists in `src/utils/modeGuards.ts` providing `useIsEditMode()` and `useFieldEditable(fieldPath)` hooks. However, both `GearScreen` and `MagicScreen` use inline checks (`settings.mode === 'edit'`) instead of the centralized hooks. This creates maintenance risk and inconsistency.

#### Current State

- `GearScreen.tsx` line ~30: `const isEditMode = settings.mode === 'edit';`
- `MagicScreen.tsx` line ~21: `const isEditMode = settings.mode === 'edit';`
- `modeGuards.ts` exports: `useIsEditMode()`, `useFieldEditable()`, `isFieldEditableInPlayMode()`
- Play-mode editable prefixes include: `armor.equipped`, `helmet.equipped`, `weapons.*`, `conditions.*`, `resources.*`

#### Acceptance Criteria

- [ ] **AC-04.1**: GearScreen uses `useIsEditMode()` from `modeGuards.ts` instead of inline check
- [ ] **AC-04.2**: MagicScreen uses `useIsEditMode()` from `modeGuards.ts` instead of inline check
- [ ] **AC-04.3**: Play-mode-editable fields (armor.equipped, helmet.equipped) remain toggleable in play mode via `useFieldEditable()` or `isFieldEditableInPlayMode()`
- [ ] **AC-04.4**: No behavioral regression — edit-mode-only UI elements remain hidden in play mode
- [ ] **AC-04.5**: No remaining inline `settings.mode === 'edit'` checks in GearScreen or MagicScreen

---

### SS-05: Navigation Improvements — Reference/Settings Routes Reachable

**Priority**: P1 (High)
**Score**: 10 / 100
**Intent**: L1 > L2 — Reference and Settings appear in navigation UI

#### Description

Routes for `/reference` and `/settings` exist in the router configuration, and both screens are implemented. However, neither appears in the `BottomNav` component (`src/components/layout/BottomNav.tsx`), making them unreachable through normal navigation. Only direct URL entry works.

#### Current BottomNav Tabs

1. Sheet (`/sheet`)
2. Skills (`/skills`)
3. Gear (`/gear`)
4. Magic (`/magic`)
5. Combat (`/combat`)

#### Design Approach

Two options (implementation should choose the most appropriate):

**Option A — Extended BottomNav**: Add Reference and Settings as additional tabs (7 total). May require horizontal scroll or icon-only mode on small screens.

**Option B — TopBar Menu**: Add a hamburger/overflow menu in the TopBar that contains Reference and Settings links. This keeps BottomNav at 5 tabs and avoids crowding.

**Recommended**: Option B (TopBar menu) for better mobile UX, unless the team prefers Option A.

#### Acceptance Criteria

- [ ] **AC-05.1**: Reference screen is reachable via a visible UI element (nav link, menu item, or tab)
- [ ] **AC-05.2**: Settings screen is reachable via a visible UI element
- [ ] **AC-05.3**: Navigation element is visible on all screen sizes (mobile-first)
- [ ] **AC-05.4**: Active state styling indicates when user is on Reference or Settings route
- [ ] **AC-05.5**: Back navigation returns user to previous screen

---

### SS-06: Inline Styles to CSS Modules Refactor

**Priority**: P2 (Medium)
**Score**: 10 / 100
**Intent**: L1 > L2 — Code quality: inline styles migrated to CSS modules

#### Description

The entire codebase uses inline `React.CSSProperties` objects with CSS variable references. While functional, this pattern:
- Prevents pseudo-class/pseudo-element usage (`:hover`, `:focus`, `::before`)
- Blocks media queries for responsive design
- Makes style reuse harder
- Increases bundle size with repeated style objects

Refactor to CSS Modules (`.module.css` files co-located with components).

#### Scope

Prioritized refactor order (most impactful first):

1. **Primitives** (`src/components/primitives/`): Button, Card, Modal, Drawer, SectionPanel, Chip, CounterControl, IconButton
2. **Layout** (`src/components/layout/`): TopBar, BottomNav
3. **Screens** (`src/screens/`): All screen components
4. **Fields** (`src/components/fields/`): Domain-specific components

#### Acceptance Criteria

- [ ] **AC-06.1**: All primitive components use CSS modules instead of inline styles
- [ ] **AC-06.2**: Layout components (TopBar, BottomNav) use CSS modules
- [ ] **AC-06.3**: Screen components use CSS modules
- [ ] **AC-06.4**: CSS modules reference the same CSS variables from `theme.css`
- [ ] **AC-06.5**: No visual regression — components render identically before and after refactor
- [ ] **AC-06.6**: Vite CSS module support is enabled (default in Vite — no config change needed)
- [ ] **AC-06.7**: Each `.module.css` file is co-located with its component

---

### SS-07: CSS Media Queries for Orientation

**Priority**: P2 (Medium)
**Score**: 5 / 100
**Intent**: L1 > L2 — Responsive layout handles orientation changes

#### Description

As a mobile-first PWA, Skaldmark should adapt layout to portrait and landscape orientations. Currently, no media queries exist for orientation. After the CSS modules refactor (SS-06), add orientation-aware styles.

#### Key Orientation Behaviors

- **Portrait** (default): Single-column stacked layout, bottom nav visible
- **Landscape**: Where appropriate, use two-column layouts (e.g., attributes + skills side-by-side on SheetScreen); consider hiding or collapsing bottom nav to maximize vertical space

#### Acceptance Criteria

- [ ] **AC-07.1**: At least one `@media (orientation: landscape)` query exists in the codebase
- [ ] **AC-07.2**: SheetScreen or GearScreen adapts layout in landscape mode
- [ ] **AC-07.3**: BottomNav remains usable in both orientations
- [ ] **AC-07.4**: No horizontal overflow or content clipping in either orientation
- [ ] **AC-07.5**: Touch targets remain >= 44px in both orientations (per `--touch-target-min` variable)

---

### SS-08: Toast / Notification System

**Priority**: P2 (Medium)
**Score**: 5 / 100
**Intent**: L1 > L2 — Non-modal feedback via toast/notification system

#### Description

The app currently uses Modal dialogs for all feedback (errors, success messages). For non-blocking feedback (save confirmations, copy-to-clipboard, minor warnings), a lightweight toast/notification system is more appropriate.

#### Requirements

- Toast component that auto-dismisses after a configurable duration (default: 3 seconds)
- Support for variants: `success`, `error`, `warning`, `info`
- Accessible: uses `role="alert"` or `aria-live="polite"`
- Positioned at top or bottom of viewport, above BottomNav
- Context-based API: `useToast()` hook returning `showToast(message, variant?, duration?)`
- No external dependencies — build with existing primitives and CSS variables

#### Acceptance Criteria

- [ ] **AC-08.1**: `Toast` component exists and renders notification messages
- [ ] **AC-08.2**: `useToast()` hook provides `showToast()` function
- [ ] **AC-08.3**: Toasts auto-dismiss after configurable duration
- [ ] **AC-08.4**: At least `success` and `error` variants are styled differently
- [ ] **AC-08.5**: Toast is accessible (`role="alert"` or `aria-live`)
- [ ] **AC-08.6**: Toast renders above BottomNav (z-index layering correct)
- [ ] **AC-08.7**: At least one existing Modal-based feedback is migrated to use toast (e.g., character save confirmation)

---

### SS-09: Rules Engine Validation Against Reference Sheet

**Priority**: P1 (High)
**Score**: 5 / 100
**Intent**: L1 > L2 — Rules engine computes derived values correctly per Dragonbane rules

#### Description

Cross-reference the computed values in `src/utils/derivedValues.ts` against the Dragonbane reference sheet YAML to ensure correctness.

#### Validation Matrix

| Derived Value | Current Implementation | Reference Sheet | Status |
|--------------|----------------------|-----------------|--------|
| **HP Max** | `character.attributes['con'] ?? 10` | CON = Constitution (physical fitness) | Correct — HP = CON |
| **WP Max** | `character.attributes['wil'] ?? 10` | WIL = Willpower (self-discipline) | Correct — WP = WIL |
| **Movement** | Hardcoded `10` | Not in reference sheet (core rules: base 10) | Correct default |
| **Damage Bonus** | STR >= 17 → +D6, >= 13 → +D4, else +0 | NPC guidelines: "+D6 roll against 17, +D4 roll against 14, no bonus roll against 10" | **Match** — thresholds 17/13 vs NPC guideline 17/14 needs review |
| **Encumbrance** | `Math.ceil(STR / 2) + 5` | Not in ref sheet (core rules: STR/2 rounded up) | **DEVIATION** — see SS-03 |
| **Skill Base Chance** | Not implemented in derivedValues | `skill_level_base_chance` table: 1-5→3, 6-8→4, 9-12→5, 13-15→6, 16-18→7 | **Missing** — should be available |

#### Damage Bonus Threshold Note

The NPC attribute guidelines say: "At +D6, roll against an attribute score of 17. At +D4, roll against 14." This describes NPC attribute inference from damage bonus, NOT the damage bonus formula itself. The current implementation (STR >= 17 → +D6, STR >= 13 → +D4) may differ from the core rules. The NPC guideline implies STR 14+ → +D4 (not 13+). Verify against core rules and adjust if needed.

#### Acceptance Criteria

- [ ] **AC-09.1**: Damage bonus thresholds are verified against core rules and corrected if needed
- [ ] **AC-09.2**: Skill base-chance lookup function exists or is documented as out-of-scope
- [ ] **AC-09.3**: All derivedValues functions have inline comments citing their rule source
- [ ] **AC-09.4**: Movement base value of 10 is documented with source reference

---

## Scoring Summary

| Sub-Spec | Priority | Score | Description |
|----------|----------|-------|-------------|
| SS-01 | P0 | 30 | Reference Tab — Full Dragonbane Reference Data |
| SS-02 | P1 | 15 | Armor/Helmet Edit Forms (Drawer-based) |
| SS-03 | P0 | 10 | Encumbrance Formula Fix |
| SS-04 | P1 | 10 | Mode Guard Wiring |
| SS-05 | P1 | 10 | Navigation Improvements |
| SS-06 | P2 | 10 | Inline Styles to CSS Modules |
| SS-07 | P2 | 5 | CSS Media Queries for Orientation |
| SS-08 | P2 | 5 | Toast/Notification System |
| SS-09 | P1 | 5 | Rules Engine Validation |
| **Total** | | **100** | |

---

## Dependency Graph

```
SS-06 (CSS Modules) ──→ SS-07 (Orientation Queries)
SS-03 (Encumbrance Fix) ──→ SS-02 (Armor Forms, weight feeds encumbrance)
SS-04 (Mode Guards) ──→ SS-02 (Armor forms respect mode guard)
SS-08 (Toast System) ── independent (can be wired into any screen after)
SS-01 (Reference Tab) ──→ SS-05 (Navigation — reference must be reachable)
SS-09 (Rules Validation) ──→ SS-03 (Encumbrance fix is a subset)
```

## Recommended Execution Order

1. **SS-03** — Encumbrance Formula Fix (small, critical, unblocks SS-02)
2. **SS-09** — Rules Engine Validation (inform any other formula fixes)
3. **SS-04** — Mode Guard Wiring (refactor, unblocks SS-02)
4. **SS-02** — Armor/Helmet Edit Forms (depends on SS-03, SS-04)
5. **SS-01** — Reference Tab (largest item, independent of above)
6. **SS-05** — Navigation Improvements (makes SS-01 accessible)
7. **SS-06** — CSS Modules Refactor (independent, large scope)
8. **SS-07** — Orientation Queries (depends on SS-06)
9. **SS-08** — Toast/Notification System (independent)

---

## Source Files Referenced

| File | Purpose |
|------|---------|
| `src/utils/derivedValues.ts` | Rules engine — computed values |
| `src/utils/modeGuards.ts` | Mode guard hooks |
| `src/screens/GearScreen.tsx` | Gear management screen |
| `src/screens/MagicScreen.tsx` | Magic management screen |
| `src/screens/ReferenceScreen.tsx` | Reference screen (currently user notes only) |
| `src/screens/SettingsScreen.tsx` | Settings screen |
| `src/components/layout/BottomNav.tsx` | Bottom navigation tabs |
| `src/components/layout/TopBar.tsx` | Top bar component |
| `src/components/primitives/Drawer.tsx` | Drawer primitive |
| `src/components/primitives/SectionPanel.tsx` | Collapsible section primitive |
| `src/routes/index.tsx` | Route definitions |
| `src/theme/theme.css` | Theme CSS variables |
| `src/context/AppStateContext.tsx` | App state context |
| `src/types/character.ts` | Character type definitions |
| `dragonbane_reference_sheet.yaml` | Reference data source |
| `dragonbane_reference_blueprint.yaml` | Rendering blueprint |
