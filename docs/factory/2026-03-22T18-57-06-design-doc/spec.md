# Skaldbok Enhancement Run — Scored Specification

**Spec ID:** SPEC-SKALDBOK-ENHANCE-001
**Parent Spec:** SPEC-SKALDBOK-V1
**Run ID:** 2026-03-22T18-57-06-design-doc
**Version:** 1.0.0
**Status:** scored
**Date:** 2026-03-22
**Supersedes:** SPEC-SKALDBOK-BUGFIX-002 (run 2026-03-22T17-55-04-design-doc, scored 96/100)

---

## Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Completeness** | 95 | All 8 input items triaged; 5 in-scope with full sub-specs; 3 explicitly deferred with rationale |
| **Clarity** | 94 | Each sub-spec has exact file paths, code-level guidance, and implementation patterns |
| **Testability** | 93 | 38 acceptance criteria, all binary pass/fail, zero subjective criteria |
| **Feasibility** | 96 | All changes are additive or surgical modifications in known files; no architectural risk |
| **Risk Coverage** | 91 | 6 risks identified with mitigations; CSS module migration is largest scope risk |
| **Total (weighted)** | **94** |

**Weighting:** Completeness 25%, Clarity 20%, Testability 20%, Feasibility 20%, Risk Coverage 15%

---

## Intent Hierarchy

### Level 0 — Mission
Address the deferred items from the prior factory run that are needed for a complete, polished V1 experience — focusing on death roll success tracking, armor/helmet edit forms, encumbrance formula correctness, mode guard consistency, and navigation improvements.

### Level 1 — Goals
| ID | Goal | Priority | Rationale |
|----|------|----------|-----------|
| G1 | Add death roll success tracking to match Dragonbane rules | P0 | Core gameplay mechanic — players must track both successes AND failures on death rolls |
| G2 | Add armor/helmet edit forms for name, rating, and features | P0 | Users currently can only create default armor; no way to customize |
| G3 | Fix encumbrance formula to match Dragonbane rules | P1 | Current formula deviates from RAW; could mislead players |
| G4 | Refactor mode guard usage for consistency | P1 | GearScreen and MagicScreen bypass useFieldEditable; inconsistent pattern |
| G5 | Add Reference and Settings routes to BottomNav or overflow menu | P1 | Routes exist but are unreachable from the main navigation |
| G6 | Preserve all existing working functionality — zero regressions | P0 | Non-negotiable constraint |

### Level 2 — Sub-Goals (mapped to sub-specs)
| Goal | Sub-Spec | Description |
|------|----------|-------------|
| G1 | SS-01 | Death roll success tracking alongside failure tracking |
| G2 | SS-02 | Armor and helmet edit forms with Drawer component |
| G3 | SS-03 | Encumbrance formula fix to match Dragonbane RAW |
| G4 | SS-04 | Mode guard consistency refactor |
| G5 | SS-05 | Navigation improvements — add overflow/secondary nav items |

### Level 3 — Tactics
Each sub-spec below details the exact files, code changes, and verification criteria.

---

## Scope

### In Scope
1. **Death roll success tracking** (SS-01) — Add success marks alongside existing failure marks in CombatScreen
2. **Armor/helmet edit forms** (SS-02) — Add Drawer-based edit forms for armor and helmet in GearScreen
3. **Encumbrance formula fix** (SS-03) — Correct the `+5` deviation in `computeEncumbranceLimit`
4. **Mode guard consistency refactor** (SS-04) — Replace direct `settings.mode` checks with `useFieldEditable` in GearScreen and MagicScreen
5. **Navigation improvements** (SS-05) — Add Reference and Settings to BottomNav as secondary items or overflow menu

### Out of Scope (with rationale)
| Item | Rationale |
|------|-----------|
| **Refactoring inline styles to CSS modules** | Architectural choice, not a functional gap. Would touch every component file. Deferred to a dedicated refactor sprint. |
| **CSS media queries for orientation** | Enhancement. Current flexbox layout handles tablet form factor. Deferred to responsive design sprint. |
| **Toast/notification system** | Enhancement. Current inline error display is functional. Would require new component + context infrastructure. Deferred. |

---

## Constraints

1. **Correctness over speed** — every change must be verifiably correct
2. **No shell commands** during implementation
3. **Cross-platform** compatible changes only
4. **Preserve all existing working functionality** — zero regressions
5. **Minimal diff** — change only what is needed
6. **No `any` types** — maintain strict TypeScript throughout
7. **No hardcoded colors** — use CSS variables via the theme system
8. **Use existing component patterns** — SectionPanel, Button, Drawer, CounterControl

---

## Trade-Off Hierarchy

1. Data safety & zero regressions > comprehensive refactoring
2. Gameplay accuracy (matching Dragonbane rules) > code elegance
3. Fix correctness > fix speed
4. Consistent patterns > minimal changes

---

## Sub-Specs

### SS-01: Death Roll Success Tracking
**Score:** 96 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** Deferred item — "Death roll success tracking"

**Intent:** In Dragonbane, when a character is DOWN (HP = 0), they must roll a death roll each round. On a success, they survive that round. On 3 successes, they stabilize and are no longer dying. On a failure, they take a death mark. On 3 failures, they die. The current implementation only tracks failures. This sub-spec adds success tracking alongside failure tracking.

**Current State Analysis:**
- `CombatScreen.tsx` tracks `deathRolls` resource as failure count (0-3)
- `system.json` defines `deathRolls` resource with `defaultMax: 3`
- `CharacterResource` type has `current` and `max` fields only — insufficient for tracking both successes and failures

**Design Decision:** Add a separate `deathSuccesses` resource to track successes, keeping the existing `deathRolls` resource for failures. This avoids modifying the existing `CharacterResource` interface and leverages the same resource tracking pattern.

**Files Modified:**
- `src/systems/dragonbane/system.json` — add `deathSuccesses` resource definition
- `src/screens/CombatScreen.tsx` — add success tracking UI alongside failure tracking
- `src/utils/modeGuards.ts` — add `resources.deathSuccesses.current` to play-mode editable list

**Implementation Notes:**
- Add `{ "id": "deathSuccesses", "name": "Death Successes", "min": 0, "defaultMax": 3 }` to system.json resources
- New characters will auto-initialize `deathSuccesses` resource via system definition
- Existing characters will use the fallback: `character.resources['deathSuccesses'] ?? { current: 0, max: 3 }`
- Success circles use `var(--color-success)` (green) to visually distinguish from failure circles (red)
- Add a "Stabilized!" message when successes reach max (3)
- Reset button clears both successes and failures
- Success tracking is only shown when character is DOWN (HP = 0)

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-01-1 | `system.json` includes a `deathSuccesses` resource with `defaultMax: 3` | automated |
| AC-01-2 | CombatScreen renders success circles alongside failure circles when character is DOWN | component |
| AC-01-3 | Success circles use `var(--color-success)` for filled state | automated |
| AC-01-4 | Clicking a success circle toggles it (fills up to that index or clears from that index) | component |
| AC-01-5 | "Stabilized!" message appears when success count reaches max (3) | component |
| AC-01-6 | Reset button clears both `deathRolls` and `deathSuccesses` to 0 | integration |
| AC-01-7 | `deathSuccesses.current` is editable in Play Mode via modeGuards | automated |
| AC-01-8 | Existing characters without `deathSuccesses` resource render without error (fallback to 0/3) | integration |

**Guardrails:**
- Use existing `CharacterResource` type and `updateResourceCurrent` pattern
- Do NOT modify CharacterResource interface
- Do NOT change deathRolls behavior — only add deathSuccesses alongside
- Use `var(--color-success)` for success circles, `var(--color-danger)` for failure circles

---

### SS-02: Armor & Helmet Edit Forms
**Score:** 94 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** Deferred item — "Armor/helmet edit forms"

**Intent:** Replace the current "Set Armor" / "Set Helmet" buttons (which create default items with hardcoded values) with proper Drawer-based edit forms that allow users to set name, rating, and features for armor and helmet pieces.

**Current State Analysis:**
- `GearScreen.tsx` lines 136-144: "Set Armor" and "Set Helmet" buttons create items with hardcoded defaults (`name: 'Armor', rating: 2` and `name: 'Helmet', rating: 1`)
- `ArmorPiece` interface: `{ id, name, rating, features, equipped }` — all fields exist but only name and rating are visible in display
- No edit capability exists once armor/helmet is created (only equip toggle)
- The app already uses `Drawer` component for weapon and spell editing — same pattern applies here

**Files Modified:**
- `src/screens/GearScreen.tsx` — add armor/helmet edit Drawer with form fields; add edit buttons; add delete/remove capability

**Implementation Notes:**
- Add two new Drawer instances (one for armor, one for helmet) or a single shared Drawer with a `type` discriminator
- Form fields: Name (text), Rating (number, min 0), Features (text/textarea)
- "Set Armor" / "Set Helmet" buttons become "Add Armor" / "Add Helmet" that open the Drawer with empty form
- Add "Edit" button next to existing armor/helmet display (edit mode only)
- Add "Remove" button to clear armor/helmet (sets to `null`)
- Use `useEffect` to sync form state when Drawer opens (same pattern as MagicScreen spells)
- Equip toggle remains inline (works in both play and edit modes per existing mode guards)

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-02-1 | GearScreen renders an edit Drawer for armor with Name, Rating, and Features fields | component |
| AC-02-2 | GearScreen renders an edit Drawer for helmet with Name, Rating, and Features fields | component |
| AC-02-3 | Clicking "Add Armor" opens the Drawer with empty/default form values | component |
| AC-02-4 | Clicking "Add Helmet" opens the Drawer with empty/default form values | component |
| AC-02-5 | Clicking "Edit" on existing armor opens the Drawer pre-populated with current values | component |
| AC-02-6 | Clicking "Edit" on existing helmet opens the Drawer pre-populated with current values | component |
| AC-02-7 | Saving armor from the Drawer persists name, rating, and features via `updateCharacter` | integration |
| AC-02-8 | Saving helmet from the Drawer persists name, rating, and features via `updateCharacter` | integration |
| AC-02-9 | A "Remove" button exists to set armor/helmet to `null` (edit mode only) | component |
| AC-02-10 | Equip toggle continues to work in both play and edit modes | integration |
| AC-02-11 | No hardcoded armor/helmet defaults remain (no `name: 'Armor', rating: 2` inline creation) | automated |

**Guardrails:**
- Use existing `Drawer` component — same pattern as WeaponEditor/MagicScreen
- Use `useEffect` for form sync — do NOT set state during render
- Keep equip toggle behavior unchanged
- Use `ArmorPiece` type as-is; do NOT modify the interface
- No hardcoded colors — use CSS variables

---

### SS-03: Encumbrance Formula Fix
**Score:** 93 | **Priority:** P1 | **Wave:** 2 | **Dependencies:** none

**Source:** Deferred item — "Encumbrance formula fix"

**Intent:** Correct the encumbrance limit formula in `computeEncumbranceLimit` to match the Dragonbane core rules. The current formula `Math.ceil(str / 2) + 5` includes an unexplained `+ 5` offset. Per the Dragonbane rulebook, the base carrying capacity is `STR / 2` (rounded up), and the `+ 5` appears to be a deviation.

**Current State Analysis:**
- `src/utils/derivedValues.ts` line 38-39: `return Math.ceil(str / 2) + 5;`
- Per Dragonbane rules: Carrying Capacity = half your STR value (rounded up)
- The `+ 5` is not in the core rules and inflates all encumbrance limits

**Design Decision:** The Dragonbane rulebook states carrying capacity is `STR / 2` rounded up. However, this should be verified against the user's specific edition. The fix removes the `+ 5` to match RAW (Rules As Written). If the user intended a house rule, this can be reverted.

**Files Modified:**
- `src/utils/derivedValues.ts` — remove `+ 5` from encumbrance formula

**Fix:**
```typescript
export function computeEncumbranceLimit(character: CharacterRecord): number {
  const str = character.attributes['str'] ?? 10;
  return Math.ceil(str / 2);
}
```

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-03-1 | `computeEncumbranceLimit` returns `Math.ceil(str / 2)` without `+ 5` | automated |
| AC-03-2 | A character with STR 10 has encumbrance limit of 5 (not 10) | unit |
| AC-03-3 | A character with STR 15 has encumbrance limit of 8 (not 13) | unit |
| AC-03-4 | A character with STR 3 (minimum) has encumbrance limit of 2 (not 7) | unit |
| AC-03-5 | GearScreen encumbrance display still shows correct "X / Y" format with updated limit | component |

**Guardrails:**
- Only change the formula — do NOT change the function signature
- Do NOT change GearScreen display logic (it uses `computeEncumbranceLimit` dynamically)
- Do NOT add configurable offsets (keep it simple per RAW)

---

### SS-04: Mode Guard Consistency Refactor
**Score:** 90 | **Priority:** P1 | **Wave:** 2 | **Dependencies:** none

**Source:** Deferred item — "Mode guard consistency refactor"

**Intent:** Refactor GearScreen and MagicScreen to use the centralized `useFieldEditable` hook from `modeGuards.ts` instead of directly reading `settings.mode === 'edit'`. This ensures consistent mode gating behavior across the app and makes future mode logic changes propagate correctly.

**Current State Analysis:**
- `src/utils/modeGuards.ts` provides `useFieldEditable(fieldPath)` hook
- `GearScreen.tsx` line 30: `const isEditMode = settings.mode === 'edit';` — bypasses modeGuards
- `MagicScreen.tsx` line 21: `const isEditMode = settings.mode === 'edit';` — bypasses modeGuards
- Other screens (CombatScreen, SheetScreen, SkillsScreen) don't directly check mode — they delegate to components that use modeGuards
- The direct check works correctly today, but is a consistency issue that could diverge if mode logic evolves

**Design Decision:** Rather than replacing every `isEditMode` usage with individual `useFieldEditable` calls (which would be verbose), create a simpler `useIsEditMode()` hook that returns a boolean. This preserves the convenience while centralizing the logic. Add it to `modeGuards.ts`.

**Files Modified:**
- `src/utils/modeGuards.ts` — add `useIsEditMode()` hook
- `src/screens/GearScreen.tsx` — replace direct mode check with `useIsEditMode()`
- `src/screens/MagicScreen.tsx` — replace direct mode check with `useIsEditMode()`

**Implementation Notes:**
```typescript
// In modeGuards.ts:
export function useIsEditMode(): boolean {
  const { settings } = useAppState();
  return settings.mode === 'edit';
}
```

- GearScreen: replace `const { settings } = useAppState();` and `const isEditMode = settings.mode === 'edit';` with `const isEditMode = useIsEditMode();`
- MagicScreen: same replacement
- Remove `useAppState` import if no longer needed in those files

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-04-1 | `modeGuards.ts` exports a `useIsEditMode()` function returning `boolean` | automated |
| AC-04-2 | GearScreen imports `useIsEditMode` from modeGuards instead of checking `settings.mode` directly | automated |
| AC-04-3 | MagicScreen imports `useIsEditMode` from modeGuards instead of checking `settings.mode` directly | automated |
| AC-04-4 | GearScreen does NOT import `useAppState` (unless used for other purposes) | automated |
| AC-04-5 | MagicScreen does NOT import `useAppState` (unless used for other purposes) | automated |
| AC-04-6 | Edit mode behavior in GearScreen is unchanged (add/remove/edit controls appear in edit mode) | component |
| AC-04-7 | Edit mode behavior in MagicScreen is unchanged (add/edit spell/ability controls appear in edit mode) | component |

**Guardrails:**
- Keep `useFieldEditable` unchanged — `useIsEditMode` is additive
- Do NOT change any edit mode behavior — only centralize the check
- If `useAppState` is used for other purposes in a file, keep the import
- Do NOT remove the `settings.mode` field from context

---

### SS-05: Navigation Improvements
**Score:** 91 | **Priority:** P1 | **Wave:** 1 | **Dependencies:** none

**Source:** Deferred item — "Navigation improvements"

**Intent:** Add Reference and Settings routes to the BottomNav so users can actually navigate to these screens. Currently, routes exist in the router (`/reference`, `/settings`) but there is no navigation path to reach them from the UI — they are orphaned routes.

**Current State Analysis:**
- `BottomNav.tsx` has 5 items: Sheet, Skills, Gear, Magic, Combat
- `routes/index.tsx` defines 8 routes: Library, Sheet, Skills, Gear, Magic, Combat, Reference, Settings
- Reference and Settings screens exist and render, but are unreachable without typing the URL
- Library is accessible as the default/landing route (index redirect)

**Design Decision:** Add Reference and Settings as additional BottomNav items. With 7 items, the nav may become crowded on small screens. Use smaller font or abbreviations if needed. Alternatively, group them as a "More" overflow — but since this is tablet-first and space is adequate, add them directly.

**Files Modified:**
- `src/components/layout/BottomNav.tsx` — add Reference and Settings NavLink items

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-05-1 | BottomNav renders a "Ref" or "Reference" NavLink to `/reference` | component |
| AC-05-2 | BottomNav renders a Settings NavLink (icon or text) to `/settings` | component |
| AC-05-3 | Clicking the Reference nav item navigates to the ReferenceScreen | integration |
| AC-05-4 | Clicking the Settings nav item navigates to the SettingsScreen | integration |
| AC-05-5 | New nav items use the same styling pattern as existing items (`bottom-nav__item` class) | automated |
| AC-05-6 | Active state highlighting works on new nav items (uses `bottom-nav__item--active` class) | component |
| AC-05-7 | All 7 nav items fit without horizontal overflow on tablet viewport (768px+) | manual |

**Guardrails:**
- Use the same `NavLink` + `className` pattern as existing items
- Use abbreviated labels if needed ("Ref" instead of "Reference", gear icon for Settings)
- Do NOT change route definitions — only add navigation links
- Do NOT remove existing nav items
- Test that nav doesn't overflow on tablet viewport

---

## Dependency Graph

```
Wave 1 (all independent, parallelizable):
  SS-01  Death roll success tracking
  SS-02  Armor/helmet edit forms
  SS-05  Navigation improvements

Wave 2 (no hard dependencies; sequenced for verification):
  SS-03  Encumbrance formula fix
  SS-04  Mode guard consistency refactor
```

```
SS-01 ─┐
SS-02 ─┼── Wave 1 ──→ Wave 2: SS-03, SS-04
SS-05 ─┘
```

**Note:** SS-04 has no code dependency on Wave 1 items. It is sequenced to Wave 2 because GearScreen is modified by SS-02 in Wave 1 — running SS-04 after avoids merge conflicts in the same file.

---

## Execution Waves

| Wave | Sub-Specs | Files Touched | Rationale |
|------|-----------|---------------|-----------|
| 1 | SS-01, SS-02, SS-05 | 4 modified | Core gameplay and navigation; SS-01 and SS-05 are independent; SS-02 touches GearScreen |
| 2 | SS-03, SS-04 | 4 modified | Formula fix and mode guard refactor; SS-04 touches GearScreen/MagicScreen after SS-02 completes |

---

## Acceptance Criteria Summary

| Category | Count |
|----------|-------|
| **Total** | 38 |
| Automated (static/grep-verifiable) | 12 |
| Component (render/behavior check) | 16 |
| Integration (persistence/E2E flow) | 7 |
| Unit (logic verification) | 3 |
| Manual (human verification) | 2 |

All 38 criteria are binary pass/fail. Zero criteria require subjective judgment.

---

## Files Inventory

### Modified (7 files)
| File | Sub-Spec | Changes |
|------|----------|---------|
| `src/systems/dragonbane/system.json` | SS-01 | Add `deathSuccesses` resource |
| `src/screens/CombatScreen.tsx` | SS-01 | Add success tracking UI |
| `src/utils/modeGuards.ts` | SS-01, SS-04 | Add `deathSuccesses` to play-mode list; add `useIsEditMode()` hook |
| `src/screens/GearScreen.tsx` | SS-02, SS-04 | Add armor/helmet Drawer edit forms; use `useIsEditMode()` |
| `src/screens/MagicScreen.tsx` | SS-04 | Use `useIsEditMode()` |
| `src/utils/derivedValues.ts` | SS-03 | Fix encumbrance formula |
| `src/components/layout/BottomNav.tsx` | SS-05 | Add Reference + Settings nav items |

### Created (0 files)
No new files required. All changes are modifications to existing files.

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R-01 | Existing characters lack `deathSuccesses` resource in IndexedDB | MEDIUM | HIGH | Fallback pattern: `character.resources['deathSuccesses'] ?? { current: 0, max: 3 }` handles missing resource gracefully |
| R-02 | Encumbrance formula change may surprise users with existing characters | LOW | MEDIUM | Encumbrance limit will decrease (removing +5). No data corruption — just visual change. Document in release notes. |
| R-03 | 7-item BottomNav may be cramped on smaller tablets or phones | MEDIUM | LOW | Tablet-first design (768px+) provides adequate space. Use abbreviated labels. CSS flex distributes space evenly. |
| R-04 | Mode guard refactor could break edit-mode gating if import is wrong | MEDIUM | VERY LOW | `useIsEditMode()` is a trivial wrapper; behavior is identical to current direct check. Verified by AC-04-6/7. |
| R-05 | Armor/helmet Drawer form state could leak between armor and helmet edits | LOW | LOW | Use separate form state or clear form on Drawer open via useEffect with `[open, type]` dependencies. |
| R-06 | Removing hardcoded armor defaults changes creation UX | LOW | LOW | Users now get a form instead of instant creation. Better UX overall — explicit > implicit. |

---

## Traceability Matrix

| Source Item | Description | Sub-Spec | AC Count | Status |
|-------------|-------------|----------|----------|--------|
| DEFERRED-01 | Death roll success tracking | SS-01 | 8 | PENDING |
| DEFERRED-02 | Armor/helmet edit forms | SS-02 | 11 | PENDING |
| DEFERRED-03 | Encumbrance formula fix | SS-03 | 5 | PENDING |
| DEFERRED-04 | Mode guard consistency refactor | SS-04 | 7 | PENDING |
| DEFERRED-05 | Navigation improvements | SS-05 | 7 | PENDING |
| DEFERRED-06 | Refactoring inline styles to CSS modules | — | — | OUT OF SCOPE |
| DEFERRED-07 | CSS media queries for orientation | — | — | OUT OF SCOPE |
| DEFERRED-08 | Toast/notification system | — | — | OUT OF SCOPE |

---

## Verification Strategy

1. **Automated checks (Wave 1 + Wave 2):** After each sub-spec is implemented, verify all "automated" criteria by reading the modified files and confirming the required code patterns exist.
2. **Component checks:** Verify render output contains expected elements (Drawers, circles, NavLinks) by reading the JSX.
3. **Integration checks:** Trace data flow from UI -> updateCharacter -> autosave -> repository to confirm persistence path is intact.
4. **Unit checks:** Verify encumbrance formula with specific STR values by reading the function.
5. **Regression check:** Confirm no existing imports are broken, no existing component APIs changed, no behavior removed.

---

## Known Items NOT Addressed (Documented Deferrals)

These items from the input are intentionally deferred as out-of-scope for this run:

1. **Refactoring inline styles to CSS modules** — Would touch every component file (~30+ files). Requires architectural decision on CSS module tooling (vanilla CSS modules vs. styled-components vs. Tailwind). Should be a dedicated refactor sprint with its own spec.
2. **CSS media queries for orientation** — Enhancement. Current flexbox layout handles the tablet form factor adequately. Orientation-specific layouts need UX research on which screens benefit from landscape vs. portrait layouts.
3. **Toast/notification system** — Enhancement. Requires new ToastContext, ToastContainer component, animation system, and integration across all screens. Current inline error display is functional. Should be its own sub-spec when UX patterns are defined.
