# Skaldbok Bugfix & Completion Run — Scored Specification

**Spec ID:** SPEC-SKALDBOK-BUGFIX-001
**Parent Spec:** SPEC-SKALDBOK-V1
**Run ID:** 2026-03-22T17-15-37-design-doc
**Version:** 2.0.0
**Status:** scored
**Date:** 2026-03-22

---

## Scoring

| Dimension | Score |
|-----------|-------|
| **Completeness** | 95 |
| **Clarity** | 94 |
| **Testability** | 92 |
| **Feasibility** | 96 |
| **Risk Coverage** | 88 |
| **Total (weighted)** | 93 |

---

## Intent Hierarchy

### Level 0 — Mission
Achieve full compliance with SPEC-SKALDBOK-V1 acceptance criteria by fixing all identified spec violations, bugs, and quality gaps.

### Level 1 — Goals
| ID | Goal | Priority |
|----|------|----------|
| G1 | Fix all 4 spec violations identified in the completeness report | P0 |
| G2 | Eliminate runtime bugs that cause data loss or degraded UX | P0 |
| G3 | Close all gaps between specified and implemented behavior | P0 |
| G4 | Harden data persistence against silent failures | P0 |
| G5 | Ensure type system matches spec requirements exactly | P1 |
| G6 | Fix misleading code patterns that could cause future bugs | P1 |
| G7 | Bring overall spec compliance from 88% to ≥98% | P0 |

### Level 2 — Sub-Goals (mapped to sub-specs)
| Goal | Sub-Spec | Description |
|------|----------|-------------|
| G1 | SS-BF-01 | Add missing `metadata` IndexedDB store (REQ-015) |
| G1 | SS-BF-02 | Add Tiny Items + Memento UI to GearScreen (REQ-026) |
| G1, G5 | SS-BF-03 | Add `themesSupported` field to SystemDefinition (REQ-011) |
| G2 | SS-BF-04 | Fix WeaponEditor render-time state mutation |
| G2, G4 | SS-BF-05 | Surface settings save errors to the user |
| G6 | SS-BF-06 | Fix autosave timer cleanup leak |

---

## Scope

### In Scope
- Fix 4 spec violations from completeness report (metadata store, Tiny Items UI, Memento UI, themesSupported field)
- Fix 2 confirmed bugs (WeaponEditor render loop, settings save error swallowing)
- Fix 1 additional code quality bug (autosave timer leak)
- Ensure all fixes preserve existing working functionality
- Minimal diff — change only what is broken or missing

### Out of Scope
- New features beyond SPEC-SKALDBOK-V1
- Refactoring inline styles to CSS modules
- Adding CSS media queries for orientation
- Building a toast/notification system
- Adding death roll success tracking
- Fixing encumbrance formula (+5 deviation)
- Adding armor/helmet edit forms
- Mode guard consistency refactor (GearScreen/MagicScreen)
- Test authoring
- Navigation improvements (BottomNav routes)

---

## Constraints

1. **Correctness over speed** — every fix must be verifiably correct
2. **No shell commands** during implementation
3. **Cross-platform** compatible changes only
4. **Preserve all existing working functionality** — zero regressions
5. **Minimal diff** — fix only what is broken or missing
6. **No `any` types** — maintain strict TypeScript
7. **No hardcoded colors** — use CSS variables via theme system

---

## Trade-Off Hierarchy

1. Data safety & zero regressions over comprehensive refactoring
2. Spec compliance over code elegance
3. Fix correctness over fix speed
4. Minimal changes over architectural improvements

---

## Sub-Specs

### SS-BF-01: IndexedDB Metadata Store
**Score:** 93 | **Priority:** P0 | **Phase:** Wave 1 | **Dependencies:** none

**Source:** REQ-015 — completeness report item #1

**Intent:** Add the missing `metadata` IndexedDB store to the Dexie database schema, enabling schema version tracking and app-level metadata storage independently of settings.

**Files Modified:**
- `src/storage/db/client.ts` — add metadata store to Dexie schema
- `src/storage/index.ts` — export metadata repository

**Files Created:**
- `src/storage/repositories/metadataRepository.ts` — get/set operations

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-001-1 | SkaldbokDatabase class declares a `metadata` table property | automated | ✅ |
| AC-BF-001-2 | Dexie `version(2)` adds metadata store with `id` as primary key | integration | ✅ |
| AC-BF-001-3 | Existing version(1) databases upgrade to version(2) without data loss to characters, systems, appSettings, or referenceNotes stores | integration | ✅ |
| AC-BF-001-4 | `MetadataRecord` interface is exported from types (fields: id, key, value) | automated | ✅ |
| AC-BF-001-5 | metadataRepository exports `get(key)` and `set(key, value)` operations | automated | ✅ |

**Guardrails:**
- ✅ Use additive Dexie versioning (version 2 adds store, version 1 schema unchanged)
- ✅ Keep metadata store schema minimal (id, key, value)
- ❌ Do not modify existing store schemas
- ❌ Do not remove or rename existing stores

---

### SS-BF-02: GearScreen Missing UI Sections (Tiny Items + Memento)
**Score:** 92 | **Priority:** P0 | **Phase:** Wave 1 | **Dependencies:** none

**Source:** REQ-026 — completeness report items #2 and #3

**Intent:** Add Tiny Items and Memento UI sections to GearScreen.tsx so users can view and edit these character fields. The data model already supports both fields; only the UI rendering is missing.

**Files Modified:**
- `src/screens/GearScreen.tsx` — add two new SectionPanel blocks

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-002-1 | GearScreen renders a "Tiny Items" SectionPanel | component | ✅ |
| AC-BF-002-2 | All items in `character.tinyItems` are displayed as a list | component | ✅ |
| AC-BF-002-3 | In Edit Mode, user can add a new tiny item via text input + button | integration | ✅ |
| AC-BF-002-4 | In Edit Mode, user can remove a tiny item (per-item delete) | integration | ✅ |
| AC-BF-002-5 | In Play Mode, tiny items are displayed but add/remove controls are hidden | component | ✅ |
| AC-BF-002-6 | Tiny item changes persist via updateCharacter and survive page reload | integration | ✅ |
| AC-BF-003-1 | GearScreen renders a "Memento" SectionPanel | component | ✅ |
| AC-BF-003-2 | Memento displays the `character.memento` value | component | ✅ |
| AC-BF-003-3 | In Edit Mode, user can edit the memento text via text input | integration | ✅ |
| AC-BF-003-4 | In Play Mode, memento is displayed as read-only text | component | ✅ |
| AC-BF-003-5 | Memento changes persist via updateCharacter and survive page reload | integration | ✅ |

**Guardrails:**
- ✅ Place Tiny Items after Coins, Memento after Tiny Items, both before Encumbrance
- ✅ Use existing SectionPanel, Button, and input styling patterns
- ✅ Respect mode guards (edit-only for structural changes)
- ❌ Do not use drawers/modals for tiny items (simple inline UI)
- ❌ Do not modify CharacterRecord type or Zod schemas (fields already exist)

---

### SS-BF-03: SystemDefinition `themesSupported` Field
**Score:** 94 | **Priority:** P1 | **Phase:** Wave 2 | **Dependencies:** SS-BF-01

**Source:** REQ-011 — completeness report item #4

**Intent:** Add an optional `themesSupported` field to the SystemDefinition TypeScript type and Zod schema. Update Dragonbane system.json to include the field. This enables future systems to declare theme compatibility.

**Files Modified:**
- `src/types/system.ts` — add optional field to interface
- `schemas/system.schema.ts` — add optional field to Zod schema
- `src/systems/dragonbane/system.json` — add themesSupported array

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-004-1 | SystemDefinition interface includes `themesSupported?: string[]` | automated | ✅ |
| AC-BF-004-2 | systemDefinitionSchema Zod schema includes optional `themesSupported` as `z.array(z.string()).optional()` | automated | ✅ |
| AC-BF-004-3 | Dragonbane system.json includes `"themesSupported": ["dark", "parchment", "light"]` | unit | ✅ |
| AC-BF-004-4 | Existing system data without `themesSupported` still passes Zod validation (field is optional) | unit | ✅ |

**Guardrails:**
- ✅ Make the field optional to maintain backward compatibility
- ✅ Use string array to allow arbitrary theme names
- ❌ Do not make themesSupported required (would break existing persisted data)
- ❌ Do not add theme filtering logic (future feature)

---

### SS-BF-04: WeaponEditor Render Loop Fix
**Score:** 95 | **Priority:** P0 | **Phase:** Wave 1 | **Dependencies:** none

**Source:** Bug — completeness report item #5

**Intent:** Refactor WeaponEditor to sync form state from the weapon prop using a `useEffect` hook instead of calling a state setter during render. Eliminates the infinite re-render risk and follows React best practices.

**Bug Analysis:**
```
// Current (BROKEN) — WeaponEditor.tsx lines 41-43
if (open && form.name === '' && weapon) {
  handleOpen();  // calls setForm() during render → infinite loop risk
}
```

**Files Modified:**
- `src/components/fields/WeaponEditor.tsx` — replace render-time call with useEffect

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-005-1 | No state setters (`setForm`, `setState`, etc.) are called in the render body of WeaponEditor (only in event handlers, effects, or callbacks) | automated | ✅ |
| AC-BF-005-2 | Opening WeaponEditor with an existing weapon populates all form fields correctly (name, grip, range, damage, durability, features, skill) | component | ✅ |
| AC-BF-005-3 | Opening WeaponEditor for a new weapon shows empty/default fields | component | ✅ |
| AC-BF-005-4 | Rapidly opening/closing the editor does not cause errors, stale state, or console warnings | manual | ✅ |
| AC-BF-005-5 | Saving an edited weapon persists all changes correctly | integration | ✅ |

**Guardrails:**
- ✅ Use `useEffect` with `[open, weapon]` dependencies for form sync
- ✅ Keep existing form field structure and save logic unchanged
- ❌ Do not call any state setters outside of event handlers or effects
- ❌ Do not change the WeaponEditor props interface (public API)

---

### SS-BF-05: Settings Save Error Surfacing
**Score:** 90 | **Priority:** P0 | **Phase:** Wave 1 | **Dependencies:** none

**Source:** Bug — completeness report item #6

**Intent:** Surface settings save errors to the UI so users are aware when persistence fails. Replace silent `.catch(console.error)` with error state propagation. Use the same error display pattern established by useAutosave.

**Bug Analysis:**
```
// Current (BROKEN) — useAppSettings.ts line 39
settingsRepository.save(updated).catch(console.error);  // inside setState callback
// User sees UI update but change is silently lost on next app load
```

**Files Modified:**
- `src/features/settings/useAppSettings.ts` — add error state, move save out of setState
- `src/context/AppStateContext.tsx` — expose settingsError in context value

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-006-1 | `useAppSettings` returns an `error` field (string \| null) | automated | ✅ |
| AC-BF-006-2 | When `settingsRepository.save()` rejects, `error` state is set to a descriptive message | unit | ✅ |
| AC-BF-006-3 | `AppStateContextValue` includes a `settingsError` field | automated | ✅ |
| AC-BF-006-4 | `settingsRepository.save()` is NOT called inside a `setState` callback | automated | ✅ |
| AC-BF-006-5 | Error is cleared on next successful save | unit | ✅ |
| AC-BF-006-6 | UI state updates optimistically (state changes immediately, error shown only if save fails) | component | ✅ |

**Guardrails:**
- ✅ Use optimistic update: set state first, then save, set error on failure
- ✅ Follow existing error display pattern from useAutosave
- ✅ Clear error on next successful save
- ❌ Do not swallow errors with `console.error` alone
- ❌ Do not add retry logic (keep fix minimal)
- ❌ Do not change settingsRepository interface

---

### SS-BF-06: Autosave Timer Leak Fix
**Score:** 88 | **Priority:** P1 | **Phase:** Wave 1 | **Dependencies:** none

**Source:** Bug — completeness report item #7

**Intent:** Fix the useAutosave hook to properly clear pending timeouts in the first useEffect cleanup function, preventing timer leaks on rapid updates and React StrictMode double-invocation.

**Bug Analysis:**
```
// Current (BROKEN) — useAutosave.ts lines 34-36
return () => {
  // Cleanup: flush on unmount   ← misleading comment, this is a no-op
};
```

**Files Modified:**
- `src/hooks/useAutosave.ts` — add clearTimeout to cleanup, fix comment

**Acceptance Criteria:**

| ID | Criterion | Type | Testable |
|----|-----------|------|----------|
| AC-BF-007-1 | First useEffect cleanup calls `clearTimeout(timerRef.current)` | automated | ✅ |
| AC-BF-007-2 | Comment accurately describes the cleanup purpose (not "flush on unmount") | automated | ✅ |
| AC-BF-007-3 | Rapid character updates do not accumulate stale timers or cause out-of-order saves | unit | ✅ |
| AC-BF-007-4 | Unmount flush (second useEffect) still works correctly | unit | ✅ |

**Guardrails:**
- ✅ Clear the timeout in the useEffect cleanup return function
- ✅ Preserve existing unmount flush behavior (second useEffect)
- ❌ Do not change debounce timing
- ❌ Do not add additional save logic
- ❌ Do not remove the second useEffect for unmount handling

---

## Dependency Graph

```
SS-BF-01 ──────────────────────────────┐
SS-BF-02 (independent)                 │
SS-BF-04 (independent)                 ├──→ SS-BF-03
SS-BF-05 (independent)                 │
SS-BF-06 (independent)                 │
                                       │
Wave 1: [SS-BF-01, 02, 04, 05, 06] ──→ Wave 2: [SS-BF-03]
```

## Execution Waves

| Wave | Sub-Specs | Rationale |
|------|-----------|-----------|
| 1 | SS-BF-01, SS-BF-02, SS-BF-04, SS-BF-05, SS-BF-06 | All independent; can be applied in parallel |
| 2 | SS-BF-03 | Depends on SS-BF-01 (metadata store must exist for schema awareness) |

---

## Acceptance Criteria Summary

| Category | Count |
|----------|-------|
| **Total** | 36 |
| Functional (component/integration) | 20 |
| Technical (automated/unit) | 14 |
| Safety (manual verification) | 2 |

All 36 criteria are testable. Zero criteria require subjective judgment.

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R-BF-001 | Adding metadata store requires Dexie version bump; existing user data could be lost on upgrade | HIGH | LOW | Dexie handles version upgrades transparently; additive migration only adds a store, never touches existing data |
| R-BF-002 | WeaponEditor useEffect fix may change form reset timing, causing brief flash of stale data | LOW | MEDIUM | Use `[open, weapon]` dependencies; reset form immediately when `open` becomes true |
| R-BF-003 | Settings error surfacing may require UI changes to display errors | LOW | LOW | Use existing inline error display patterns from useAutosave; no new components needed |
| R-BF-004 | Autosave timer fix may interact with React StrictMode double-invocation | LOW | LOW | clearTimeout is idempotent; safe to call multiple times |

---

## Files Inventory

### Modified (8 files)
| File | Sub-Specs | Changes |
|------|-----------|---------|
| `src/storage/db/client.ts` | SS-BF-01 | Add metadata store, bump to version(2) |
| `src/storage/index.ts` | SS-BF-01 | Export metadataRepository |
| `src/screens/GearScreen.tsx` | SS-BF-02 | Add Tiny Items + Memento sections |
| `src/types/system.ts` | SS-BF-03 | Add themesSupported field |
| `schemas/system.schema.ts` | SS-BF-03 | Add themesSupported to Zod schema |
| `src/systems/dragonbane/system.json` | SS-BF-03 | Add themesSupported array |
| `src/components/fields/WeaponEditor.tsx` | SS-BF-04 | Replace render-time call with useEffect |
| `src/features/settings/useAppSettings.ts` | SS-BF-05 | Add error state, move save out of setState |
| `src/context/AppStateContext.tsx` | SS-BF-05 | Expose settingsError |
| `src/hooks/useAutosave.ts` | SS-BF-06 | Add clearTimeout to cleanup |

### Created (1 file)
| File | Sub-Spec | Purpose |
|------|----------|---------|
| `src/storage/repositories/metadataRepository.ts` | SS-BF-01 | Metadata get/set operations |

---

## Traceability

| REQ ID | Description | Sub-Spec | Status |
|--------|-------------|----------|--------|
| REQ-015 | IndexedDB stores include metadata | SS-BF-01 | PENDING FIX |
| REQ-026 | Gear screen includes tiny items and memento | SS-BF-02 | PENDING FIX |
| REQ-011 | SystemDefinition includes themesSupported | SS-BF-03 | PENDING FIX |
| — | WeaponEditor no render-time side effects | SS-BF-04 | PENDING FIX |
| — | Settings save errors surfaced to user | SS-BF-05 | PENDING FIX |
| — | Autosave timer properly cleaned up | SS-BF-06 | PENDING FIX |

---

## Known Items NOT Addressed (Documented Deferrals)

These items from the completeness report are intentionally deferred as out-of-scope for this bugfix run:

1. **Mode guard inconsistency** (GearScreen/MagicScreen read mode directly) — cosmetic, no functional impact
2. **Inline styles** — architecture choice, not a bug
3. **Encumbrance formula deviation** (`+5`) — would change game mechanics, needs spec decision
4. **Death roll simplification** — feature enhancement, not a spec violation
5. **No CSS media queries** — enhancement, not a spec violation
6. **No toast system** — enhancement, inline errors are functional
7. **Armor/Helmet minimal editing** — enhancement, current approach works
8. **Navigation routes missing from BottomNav** — enhancement, not a spec violation
9. **Stale verify-report.md and manifest.md** — process artifacts, not code bugs
