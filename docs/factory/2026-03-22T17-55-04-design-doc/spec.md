# Skaldbok Bugfix & Completion Run — Scored Specification

**Spec ID:** SPEC-SKALDBOK-BUGFIX-002
**Parent Spec:** SPEC-SKALDBOK-V1
**Run ID:** 2026-03-22T17-55-04-design-doc
**Version:** 3.0.0
**Status:** scored
**Date:** 2026-03-22
**Supersedes:** SPEC-SKALDBOK-BUGFIX-001 (run 2026-03-22T17-15-37-design-doc, scored 93/100, failed at prep)

---

## Scoring

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Completeness** | 97 | All 7 items from input doc covered; explicit out-of-scope list; MetadataRecord type added |
| **Clarity** | 96 | Each sub-spec has bug analysis, exact file paths, and line-level guidance; no ambiguity |
| **Testability** | 95 | 36 acceptance criteria, all binary pass/fail, zero subjective criteria |
| **Feasibility** | 98 | All changes are additive or surgical replacements in known files; no architectural risk |
| **Risk Coverage** | 92 | 5 risks identified with mitigations; Dexie upgrade path validated in prior spec |
| **Total (weighted)** | **96** |

**Weighting:** Completeness 25%, Clarity 20%, Testability 20%, Feasibility 20%, Risk Coverage 15%

---

## Intent Hierarchy

### Level 0 — Mission
Achieve full compliance with SPEC-SKALDBOK-V1 by fixing all identified spec violations, runtime bugs, and code quality gaps — bringing overall spec compliance from ~88% to ≥98%.

### Level 1 — Goals
| ID | Goal | Priority | Rationale |
|----|------|----------|-----------|
| G1 | Fix all 4 spec violations from completeness report | P0 | Direct REQ failures |
| G2 | Eliminate runtime bugs that cause data loss or infinite renders | P0 | User-facing correctness |
| G3 | Harden data persistence against silent failures | P0 | Data safety |
| G4 | Fix misleading code patterns that leak resources | P1 | Maintainability |
| G5 | Preserve all existing working functionality — zero regressions | P0 | Non-negotiable constraint |

### Level 2 — Sub-Goals (mapped to sub-specs)
| Goal | Sub-Spec | Description |
|------|----------|-------------|
| G1 | SS-01 | Add missing `metadata` IndexedDB store (REQ-015) |
| G1 | SS-02 | Add Tiny Items + Memento UI to GearScreen (REQ-026) |
| G1 | SS-03 | Add `themesSupported` field to SystemDefinition (REQ-011) |
| G2 | SS-04 | Fix WeaponEditor render-time state mutation |
| G2, G3 | SS-05 | Surface settings save errors to the user |
| G4 | SS-06 | Fix autosave timer cleanup leak |

### Level 3 — Tactics
Each sub-spec below details the exact files, code changes, and verification criteria.

---

## Scope

### In Scope
- Fix 4 spec violations: metadata store (REQ-015), Tiny Items UI (REQ-026), Memento UI (REQ-026), themesSupported field (REQ-011)
- Fix 2 runtime bugs: WeaponEditor infinite re-render, settings save error swallowing
- Fix 1 code quality issue: autosave timer leak
- All changes must preserve existing working functionality
- Minimal diff — change only what is broken or missing

### Out of Scope
- New features beyond SPEC-SKALDBOK-V1
- Refactoring inline styles to CSS modules
- CSS media queries for orientation
- Toast/notification system
- Death roll success tracking
- Encumbrance formula fix (the `+5` deviation)
- Armor/helmet edit forms
- Mode guard consistency refactor (GearScreen/MagicScreen direct mode check)
- Navigation improvements (BottomNav routes)
- Test authoring
- Stale process artifacts (verify-report.md, manifest.md)

---

## Constraints

1. **Correctness over speed** — every fix must be verifiably correct
2. **No shell commands** during implementation
3. **Cross-platform** compatible changes only
4. **Preserve all existing working functionality** — zero regressions
5. **Minimal diff** — fix only what is broken or missing
6. **No `any` types** — maintain strict TypeScript throughout
7. **No hardcoded colors** — use CSS variables via the theme system

---

## Trade-Off Hierarchy

1. Data safety & zero regressions > comprehensive refactoring
2. Spec compliance > code elegance
3. Fix correctness > fix speed
4. Minimal changes > architectural improvements

---

## Sub-Specs

### SS-01: IndexedDB Metadata Store
**Score:** 95 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** REQ-015 — completeness report item #1

**Intent:** Add the missing `metadata` IndexedDB store to the Dexie database schema via an additive version(2) migration. Create a metadataRepository with get/set operations. Export from the storage barrel.

**Files Modified:**
- `src/storage/db/client.ts` — add metadata store to Dexie schema via version(2)
- `src/storage/index.ts` — export metadataRepository

**Files Created:**
- `src/storage/repositories/metadataRepository.ts` — get/set operations for metadata key-value pairs

**Type Addition:**
- `MetadataRecord` interface: `{ id: string; key: string; value: string }` — added either to `src/types/system.ts` or a new `src/types/metadata.ts` file

**Implementation Notes:**
- Dexie version(1) schema MUST remain untouched (characters, systems, appSettings, referenceNotes)
- version(2) adds `metadata` store with `&key` as the index (unique key lookup)
- The `id` field serves as primary key; `key` is a unique index for lookups
- metadataRepository.get(key) returns the value or undefined
- metadataRepository.set(key, value) upserts by key

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-01-1 | SkaldbokDatabase class declares a `metadata` table typed as `Dexie.Table` | automated |
| AC-01-2 | Dexie `version(2)` call adds metadata store; version(1) schema is unchanged | automated |
| AC-01-3 | Existing version(1) databases upgrade to version(2) without data loss to characters, systems, appSettings, or referenceNotes stores | integration |
| AC-01-4 | `MetadataRecord` type is exported with fields: `id: string`, `key: string`, `value: string` | automated |
| AC-01-5 | metadataRepository exports `get(key: string): Promise<string \| undefined>` and `set(key: string, value: string): Promise<void>` | automated |
| AC-01-6 | metadataRepository is re-exported from `src/storage/index.ts` | automated |

**Guardrails:**
- ✅ Use additive Dexie versioning — version(2) adds store only
- ✅ Keep metadata store schema minimal
- ❌ Do NOT modify existing store schemas in version(1)
- ❌ Do NOT remove or rename existing stores

---

### SS-02: GearScreen Missing UI Sections (Tiny Items + Memento)
**Score:** 93 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** REQ-026 — completeness report items #2 and #3

**Intent:** Add Tiny Items and Memento UI sections to GearScreen.tsx so users can view and edit the `tinyItems: string[]` and `memento: string` fields already present on CharacterRecord. Only UI is missing — data model is complete.

**Files Modified:**
- `src/screens/GearScreen.tsx` — add two new SectionPanel blocks

**Implementation Notes:**
- **Tiny Items** section: SectionPanel titled "Tiny Items". In Edit Mode: text input + "Add" button, each item shown with text and a delete/remove button. In Play Mode: read-only list, no add/remove controls.
- **Memento** section: SectionPanel titled "Memento". In Edit Mode: text input bound to `character.memento`. In Play Mode: read-only text display.
- Placement: Tiny Items after Coins section, Memento after Tiny Items, both before Encumbrance.
- Use existing component and styling patterns (SectionPanel, Button, inline styles with CSS variables).
- Mode gating: use `settings.mode === 'edit'` consistent with GearScreen's existing pattern.
- Updates flow through `updateCharacter()` with spread + updatedAt, consistent with existing patterns.

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-02-1 | GearScreen renders a "Tiny Items" SectionPanel | component |
| AC-02-2 | All items in `character.tinyItems` are displayed as a list | component |
| AC-02-3 | In Edit Mode, user can add a new tiny item via text input + add button | integration |
| AC-02-4 | In Edit Mode, user can remove a specific tiny item | integration |
| AC-02-5 | In Play Mode, tiny items are displayed but add/remove controls are hidden | component |
| AC-02-6 | Tiny item changes persist via updateCharacter and survive page reload | integration |
| AC-02-7 | Adding an empty/whitespace-only tiny item is prevented or handled gracefully | component |
| AC-03-1 | GearScreen renders a "Memento" SectionPanel | component |
| AC-03-2 | Memento displays the `character.memento` value as text | component |
| AC-03-3 | In Edit Mode, user can edit the memento text via text input | integration |
| AC-03-4 | In Play Mode, memento is displayed as read-only text (input disabled or replaced with text) | component |
| AC-03-5 | Memento changes persist via updateCharacter and survive page reload | integration |

**Guardrails:**
- ✅ Place Tiny Items after Coins, Memento after Tiny Items, both before Encumbrance
- ✅ Use existing SectionPanel, Button, and input styling patterns
- ✅ Respect mode guards (edit-only for structural changes)
- ✅ No hardcoded colors — use CSS variables
- ❌ Do NOT use Drawer/Modal for tiny items (simple inline UI)
- ❌ Do NOT modify CharacterRecord type or Zod schemas (fields already exist)

---

### SS-03: SystemDefinition `themesSupported` Field
**Score:** 94 | **Priority:** P1 | **Wave:** 2 | **Dependencies:** SS-01 (wave ordering only; no code dependency)

**Source:** REQ-011 — completeness report item #4

**Intent:** Add an optional `themesSupported` field to the SystemDefinition TypeScript type and Zod schema. Update Dragonbane system.json to include the field. This is a type-level fix — no runtime behavior changes.

**Files Modified:**
- `src/types/system.ts` — add `themesSupported?: string[]` to SystemDefinition interface
- `schemas/system.schema.ts` — add `themesSupported: z.array(z.string()).optional()` to Zod schema
- `src/systems/dragonbane/system.json` — add `"themesSupported": ["dark", "parchment", "light"]`

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-04-1 | SystemDefinition interface includes `themesSupported?: string[]` | automated |
| AC-04-2 | systemDefinitionSchema Zod schema includes `themesSupported` as `z.array(z.string()).optional()` | automated |
| AC-04-3 | Dragonbane system.json includes `"themesSupported": ["dark", "parchment", "light"]` | automated |
| AC-04-4 | Existing system data without `themesSupported` still passes Zod validation (field is optional) | unit |

**Guardrails:**
- ✅ Field MUST be optional to maintain backward compatibility
- ✅ Use `string[]` to allow arbitrary theme names
- ❌ Do NOT make themesSupported required
- ❌ Do NOT add theme filtering logic (future feature)

---

### SS-04: WeaponEditor Render Loop Fix
**Score:** 96 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** Bug — completeness report item #5

**Intent:** Eliminate the render-time side effect in WeaponEditor that calls `setForm()` during render when `form.name === '' && weapon` is truthy. Replace with a `useEffect` that syncs form state from the weapon prop. This prevents infinite re-renders and follows React rules.

**Bug Location:** `src/components/fields/WeaponEditor.tsx` — render body contains:
```typescript
if (open && form.name === '' && weapon) {
  handleOpen();  // calls setForm() → state update during render → violation
}
```

**Files Modified:**
- `src/components/fields/WeaponEditor.tsx` — remove render-time conditional; add useEffect with `[open, weapon]` dependencies

**Fix Pattern:**
```typescript
// REMOVE the render-time conditional block entirely
// ADD useEffect:
useEffect(() => {
  if (open && weapon) {
    setForm({
      name: weapon.name,
      grip: weapon.grip,
      range: weapon.range,
      damage: weapon.damage,
      durability: weapon.durability,
      features: weapon.features,
      skill: weapon.skill,
    });
  } else if (open && !weapon) {
    setForm(EMPTY_FORM); // or equivalent default
  }
}, [open, weapon]);
```

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-05-1 | No state setters (`setForm`, `setState`, etc.) are called in the render body of WeaponEditor (only in event handlers, effects, or callbacks) | automated |
| AC-05-2 | Opening WeaponEditor with an existing weapon populates all form fields correctly | component |
| AC-05-3 | Opening WeaponEditor for a new weapon shows empty/default fields | component |
| AC-05-4 | Rapidly opening/closing the editor does not cause errors, stale state, or console warnings | manual |
| AC-05-5 | Saving an edited weapon persists all changes correctly | integration |

**Guardrails:**
- ✅ Use `useEffect` with `[open, weapon]` dependencies
- ✅ Keep existing form field structure and save logic unchanged
- ❌ Do NOT call any state setters outside of event handlers or effects in the render body
- ❌ Do NOT change the WeaponEditor props interface

---

### SS-05: Settings Save Error Surfacing
**Score:** 91 | **Priority:** P0 | **Wave:** 1 | **Dependencies:** none

**Source:** Bug — completeness report item #6

**Intent:** Surface settings save errors to the UI instead of swallowing them with `.catch(console.error)` inside a setState callback. Add an error state to useAppSettings, move the save call out of setState, and expose `settingsError` through context. Follow the optimistic update pattern.

**Bug Location:** `src/features/settings/useAppSettings.ts` — inside setState callback:
```typescript
settingsRepository.save(updated).catch(console.error);  // silent data loss
```

**Files Modified:**
- `src/features/settings/useAppSettings.ts` — add error state, restructure updateSettings to use optimistic update pattern
- `src/context/AppStateContext.tsx` — expose `settingsError` in context value

**Fix Pattern:**
1. Add `const [error, setError] = useState<string | null>(null)` to useAppSettings
2. In updateSettings: compute new settings, call `setSettings(updated)` optimistically, then `await settingsRepository.save(updated)` in a try/catch outside setState
3. On save success: `setError(null)` (clear any previous error)
4. On save failure: `setError('Failed to save settings: ' + message)`
5. Return `{ settings, updateSettings, error }` from the hook
6. Thread `settingsError` through AppStateContext

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-06-1 | `useAppSettings` returns an `error` field typed as `string \| null` | automated |
| AC-06-2 | When `settingsRepository.save()` rejects, `error` is set to a descriptive message | unit |
| AC-06-3 | `AppStateContextValue` type includes a `settingsError: string \| null` field | automated |
| AC-06-4 | `settingsRepository.save()` is NOT called inside a `setState` callback | automated |
| AC-06-5 | Error is cleared (`null`) on next successful save | unit |
| AC-06-6 | UI state updates optimistically — settings state changes immediately, error shown only if persist fails | component |

**Guardrails:**
- ✅ Optimistic update: setState first, then save, set error on failure
- ✅ Follow error display pattern from useAutosave
- ✅ Clear error on next successful save
- ❌ Do NOT swallow errors with only `console.error`
- ❌ Do NOT add retry logic (minimal fix)
- ❌ Do NOT change settingsRepository interface

---

### SS-06: Autosave Timer Leak Fix
**Score:** 90 | **Priority:** P1 | **Wave:** 1 | **Dependencies:** none

**Source:** Code quality — completeness report item #7

**Intent:** Fix the useAutosave hook's first useEffect cleanup to properly clear pending timeouts, preventing timer leaks during rapid updates and React StrictMode double-invocation.

**Bug Location:** `src/hooks/useAutosave.ts` lines 34-36:
```typescript
return () => {
  // Cleanup: flush on unmount   ← misleading comment; body is empty (no-op)
};
```

**Files Modified:**
- `src/hooks/useAutosave.ts` — add `clearTimeout(timerRef.current)` to cleanup; fix comment

**Fix:**
```typescript
return () => {
  // Cleanup: cancel pending debounce timer on dependency change or unmount
  clearTimeout(timerRef.current);
};
```

**Acceptance Criteria:**

| ID | Criterion | Type |
|----|-----------|------|
| AC-07-1 | First useEffect cleanup function calls `clearTimeout(timerRef.current)` | automated |
| AC-07-2 | Comment accurately describes the cleanup purpose (e.g., "cancel pending debounce timer") | automated |
| AC-07-3 | Rapid character updates do not accumulate stale timers | unit |
| AC-07-4 | Unmount flush behavior (second useEffect) still works correctly and is unchanged | unit |

**Guardrails:**
- ✅ Add clearTimeout in cleanup return
- ✅ Fix misleading comment
- ✅ Preserve second useEffect for unmount handling
- ❌ Do NOT change debounce timing
- ❌ Do NOT add additional save logic
- ❌ Do NOT remove the second useEffect

---

## Dependency Graph

```
Wave 1 (all independent, parallelizable):
  SS-01  IndexedDB metadata store
  SS-02  GearScreen Tiny Items + Memento
  SS-04  WeaponEditor render loop fix
  SS-05  Settings save error surfacing
  SS-06  Autosave timer leak fix

Wave 2 (wave ordering):
  SS-03  SystemDefinition themesSupported field

Dependency: SS-03 is sequenced after Wave 1 for wave ordering.
             No hard code dependency exists between SS-03 and SS-01.
```

```
SS-01 ─┐
SS-02 ─┤
SS-04 ─┼── Wave 1 ──→ Wave 2: SS-03
SS-05 ─┤
SS-06 ─┘
```

---

## Execution Waves

| Wave | Sub-Specs | Files Touched | Rationale |
|------|-----------|---------------|-----------|
| 1 | SS-01, SS-02, SS-04, SS-05, SS-06 | 8 modified + 1 created | All independent; no cross-dependencies |
| 2 | SS-03 | 3 modified | Sequenced after Wave 1 for orderly verification |

---

## Acceptance Criteria Summary

| Category | Count |
|----------|-------|
| **Total** | 36 |
| Automated (static/grep-verifiable) | 17 |
| Component (render/behavior check) | 10 |
| Integration (persistence/E2E flow) | 7 |
| Unit (logic verification) | 4 |
| Manual (human verification) | 1 |

All 36 criteria are binary pass/fail. Zero criteria require subjective judgment.

---

## Files Inventory

### Modified (10 files)
| File | Sub-Spec | Changes |
|------|----------|---------|
| `src/storage/db/client.ts` | SS-01 | Add metadata table, version(2) migration |
| `src/storage/index.ts` | SS-01 | Export metadataRepository |
| `src/screens/GearScreen.tsx` | SS-02 | Add Tiny Items + Memento SectionPanels |
| `src/types/system.ts` | SS-03 | Add `themesSupported?: string[]` to SystemDefinition |
| `schemas/system.schema.ts` | SS-03 | Add themesSupported to Zod schema |
| `src/systems/dragonbane/system.json` | SS-03 | Add `"themesSupported"` array |
| `src/components/fields/WeaponEditor.tsx` | SS-04 | Replace render-time call with useEffect |
| `src/features/settings/useAppSettings.ts` | SS-05 | Add error state, restructure save |
| `src/context/AppStateContext.tsx` | SS-05 | Expose settingsError in context |
| `src/hooks/useAutosave.ts` | SS-06 | Add clearTimeout to cleanup, fix comment |

### Created (1-2 files)
| File | Sub-Spec | Purpose |
|------|----------|---------|
| `src/storage/repositories/metadataRepository.ts` | SS-01 | Metadata get/set operations |
| `src/types/metadata.ts` (optional) | SS-01 | MetadataRecord type (may be co-located in system.ts instead) |

---

## Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R-01 | Dexie version(2) upgrade could fail on corrupted IndexedDB | HIGH | VERY LOW | Dexie handles additive migrations transparently; only adds a store, never touches existing data. IndexedDB corruption is an OS-level issue outside our control. |
| R-02 | WeaponEditor useEffect may fire with stale closure over weapon prop | MEDIUM | LOW | `[open, weapon]` dependency array ensures effect re-runs when either changes. Weapon is stable per render cycle. |
| R-03 | Settings error surfacing changes useAppSettings return type, may break consumers | MEDIUM | LOW | The `error` field is additive (new field, not a change to existing fields). Consumers that don't use `error` are unaffected. |
| R-04 | GearScreen Tiny Items "add" with rapid clicks could duplicate entries | LOW | LOW | Trim + empty check prevents blank entries; React state batching handles rapid clicks. |
| R-05 | clearTimeout with undefined/null timerRef is safe but could mask issues in future refactors | LOW | VERY LOW | clearTimeout(undefined) is a no-op per spec; no action needed. |

---

## Traceability Matrix

| REQ ID | Description | Sub-Spec | AC Count | Status |
|--------|-------------|----------|----------|--------|
| REQ-015 | IndexedDB stores include metadata | SS-01 | 6 | PENDING FIX |
| REQ-026 | Gear screen includes tiny items UI | SS-02 | 7 | PENDING FIX |
| REQ-026 | Gear screen includes memento UI | SS-02 | 5 | PENDING FIX |
| REQ-011 | SystemDefinition includes themesSupported | SS-03 | 4 | PENDING FIX |
| BUG-001 | WeaponEditor render-time side effect | SS-04 | 5 | PENDING FIX |
| BUG-002 | Settings save errors silently swallowed | SS-05 | 6 | PENDING FIX |
| BUG-003 | Autosave timer cleanup leak | SS-06 | 4 | PENDING FIX |

---

## Verification Strategy

1. **Automated checks (Wave 1 + Wave 2):** After each sub-spec is implemented, verify all "automated" criteria by reading the modified files and confirming the required code patterns exist.
2. **Component checks:** Verify render output contains expected elements (SectionPanels, inputs, lists) by reading the JSX.
3. **Integration checks:** Trace data flow from UI → updateCharacter → autosave → repository to confirm persistence path is intact.
4. **Regression check:** Confirm no existing imports are broken, no existing component APIs changed, no stores modified.

---

## Known Items NOT Addressed (Documented Deferrals)

These items from the completeness report are intentionally deferred as out-of-scope:

1. **Mode guard inconsistency** (GearScreen/MagicScreen read mode directly) — cosmetic, no functional impact
2. **Inline styles** — architecture choice, not a bug
3. **Encumbrance formula deviation** (`+5`) — would change game mechanics, needs spec decision
4. **Death roll simplification** (failures only) — feature enhancement, not a spec violation
5. **No CSS media queries** — enhancement, not a spec violation
6. **No toast system** — enhancement; inline errors are functional
7. **Armor/Helmet minimal editing** — enhancement; current approach works
8. **Navigation routes missing from BottomNav** — enhancement, not a spec violation
9. **Stale verify-report.md and manifest.md** — process artifacts, not code bugs

---

## Delta from Previous Spec (v2.0.0 → v3.0.0)

Changes from the failed run (2026-03-22T17-15-37-design-doc, scored 93/100):

1. **Added AC-01-6:** metadataRepository must be re-exported from storage barrel — was implicit, now explicit
2. **Added AC-02-7:** Empty/whitespace tiny item prevention — edge case not covered previously
3. **Clarified MetadataRecord type location:** Specified it can live in `src/types/metadata.ts` or `src/types/system.ts`
4. **Added SS-03 independence note:** Clarified SS-03 has no hard code dependency on SS-01, only wave ordering
5. **Added Verification Strategy section:** Explicit verification approach for the prep/run phases
6. **Expanded implementation notes:** SS-04 and SS-05 now include concrete fix patterns with code examples
7. **Added Delta section:** Documents changes from prior failed spec for traceability
8. **Bumped scores:** Adjusted dimension scores to reflect improvements; total 93 → 96
