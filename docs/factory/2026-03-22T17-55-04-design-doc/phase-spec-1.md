# Phase 1: Wave 1 — Independent Bugfixes & Features

**Phase:** 1 of 3
**Spec ID:** SPEC-SKALDBOK-BUGFIX-002
**Run ID:** 2026-03-22T17-55-04-design-doc
**Wave:** 1
**Sub-Specs:** SS-01, SS-02, SS-04, SS-05, SS-06
**Dependencies:** None — all items are independent and parallelizable

---

## Dependency Graph

```
(no dependencies — all 5 sub-specs execute independently)

SS-01  IndexedDB metadata store         ──┐
SS-02  GearScreen Tiny Items + Memento  ──┤
SS-04  WeaponEditor render loop fix     ──┼── All complete → Phase 2
SS-05  Settings save error surfacing    ──┤
SS-06  Autosave timer leak fix          ──┘
```

---

## SS-01: IndexedDB Metadata Store

### Intent
Add the missing `metadata` IndexedDB store to Dexie via an additive version(2) migration. Create a metadataRepository. Export from the storage barrel.

### Files

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/types/metadata.ts` | MetadataRecord interface |
| MODIFY | `src/storage/db/client.ts` | Add metadata table, version(2) schema |
| CREATE | `src/storage/repositories/metadataRepository.ts` | get/set operations |
| MODIFY | `src/storage/index.ts` | Re-export metadataRepository |

### Implementation Steps

1. **Create `src/types/metadata.ts`:**
   ```typescript
   export interface MetadataRecord {
     id: string;
     key: string;
     value: string;
   }
   ```

2. **Modify `src/storage/db/client.ts`:**
   - Import `MetadataRecord` from `../../types/metadata`
   - Add `metadata!: Dexie.Table<MetadataRecord, string>` table declaration to `SkaldbokDatabase`
   - Add `this.version(2).stores({ metadata: 'id, &key' })` AFTER the existing version(1) block
   - Do NOT modify the version(1) stores definition

3. **Create `src/storage/repositories/metadataRepository.ts`:**
   - Import `db` from `../db/client`
   - `get(key: string): Promise<string | undefined>` — queries by key, returns value or undefined
   - `set(key: string, value: string): Promise<void>` — upserts: find by key, update or insert with generated id
   - Follow existing repository patterns (DOMException handling)

4. **Modify `src/storage/index.ts`:**
   - Add `export * as metadataRepository from './repositories/metadataRepository';`

### Verification Commands

```bash
# AC-01-1: SkaldbokDatabase declares metadata table
grep -n "metadata.*Dexie.Table" src/storage/db/client.ts

# AC-01-2: version(2) adds metadata; version(1) unchanged
grep -n "version(1)" src/storage/db/client.ts
grep -n "version(2)" src/storage/db/client.ts
# Confirm version(1) stores do NOT contain "metadata"

# AC-01-4: MetadataRecord type exported
grep -n "export interface MetadataRecord" src/types/metadata.ts
grep -n "id: string" src/types/metadata.ts
grep -n "key: string" src/types/metadata.ts
grep -n "value: string" src/types/metadata.ts

# AC-01-5: metadataRepository exports get and set
grep -n "export.*async.*function get" src/storage/repositories/metadataRepository.ts
grep -n "export.*async.*function set" src/storage/repositories/metadataRepository.ts

# AC-01-6: Re-exported from storage barrel
grep -n "metadataRepository" src/storage/index.ts
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-01-1 | SkaldbokDatabase class declares a `metadata` table typed as `Dexie.Table` | ☐ |
| AC-01-2 | Dexie `version(2)` call adds metadata store; version(1) schema is unchanged | ☐ |
| AC-01-3 | Existing version(1) databases upgrade to version(2) without data loss | ☐ |
| AC-01-4 | `MetadataRecord` type exported with fields: `id`, `key`, `value` (all string) | ☐ |
| AC-01-5 | metadataRepository exports `get(key)` and `set(key, value)` | ☐ |
| AC-01-6 | metadataRepository is re-exported from `src/storage/index.ts` | ☐ |

### Guardrails
- ✅ Additive Dexie versioning — version(2) adds store only
- ✅ Keep metadata store schema minimal (`id, &key`)
- ❌ Do NOT modify existing store schemas in version(1)
- ❌ Do NOT remove or rename existing stores

---

## SS-02: GearScreen Missing UI Sections (Tiny Items + Memento)

### Intent
Add Tiny Items and Memento SectionPanel sections to GearScreen.tsx. The data model fields (`tinyItems: string[]`, `memento: string`) already exist on CharacterRecord. Only UI is missing.

### Files

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/screens/GearScreen.tsx` | Add Tiny Items + Memento SectionPanels |

### Implementation Steps

1. **Locate insertion point in GearScreen.tsx:**
   - Find the Coins SectionPanel and the Encumbrance SectionPanel
   - Insert Tiny Items section AFTER Coins, Memento AFTER Tiny Items, both BEFORE Encumbrance

2. **Add Tiny Items state:**
   - Add `const [newTinyItem, setNewTinyItem] = useState('')` for the add-item input

3. **Add Tiny Items SectionPanel:**
   - Title: "Tiny Items"
   - **Edit Mode:** Text input + "Add" button. List of items, each with text and a "Remove" button.
   - **Play Mode:** Read-only list of items, no add/remove controls.
   - Add handler: trim input, reject empty/whitespace, append to `character.tinyItems`, call `updateCharacter(...)`, clear input
   - Remove handler: filter out item by index, call `updateCharacter(...)`
   - Use existing patterns: `SectionPanel`, `Button`, inline styles with CSS variables

4. **Add Memento SectionPanel:**
   - Title: "Memento"
   - **Edit Mode:** Text input bound to `character.memento`, onChange calls `updateCharacter(...)`
   - **Play Mode:** Read-only text display (disabled input or plain text span)

5. **Ensure all updateCharacter calls use spread + updatedAt pattern** consistent with existing code.

### Verification Commands

```bash
# AC-02-1: Tiny Items SectionPanel exists
grep -n "Tiny Items" src/screens/GearScreen.tsx

# AC-02-2: tinyItems displayed as list
grep -n "tinyItems" src/screens/GearScreen.tsx

# AC-02-3/4: Add/remove controls in edit mode
grep -n "newTinyItem\|addTinyItem\|removeTinyItem" src/screens/GearScreen.tsx

# AC-02-5: Mode gating for controls
grep -n "mode.*edit.*Tiny\|edit.*mode.*Tiny" src/screens/GearScreen.tsx

# AC-02-7: Empty item prevention
grep -n "trim\(\)" src/screens/GearScreen.tsx

# AC-03-1: Memento SectionPanel exists
grep -n "Memento" src/screens/GearScreen.tsx

# AC-03-2/3: Memento input bound to character.memento
grep -n "character.memento\|memento" src/screens/GearScreen.tsx

# No hardcoded colors:
grep -n "#[0-9a-fA-F]\{3,6\}" src/screens/GearScreen.tsx
# Should return no matches (or only existing ones)
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-02-1 | GearScreen renders a "Tiny Items" SectionPanel | ☐ |
| AC-02-2 | All items in `character.tinyItems` are displayed as a list | ☐ |
| AC-02-3 | In Edit Mode, user can add a new tiny item via text input + add button | ☐ |
| AC-02-4 | In Edit Mode, user can remove a specific tiny item | ☐ |
| AC-02-5 | In Play Mode, tiny items displayed but add/remove controls hidden | ☐ |
| AC-02-6 | Tiny item changes persist via updateCharacter and survive page reload | ☐ |
| AC-02-7 | Adding an empty/whitespace-only tiny item is prevented | ☐ |
| AC-03-1 | GearScreen renders a "Memento" SectionPanel | ☐ |
| AC-03-2 | Memento displays the `character.memento` value as text | ☐ |
| AC-03-3 | In Edit Mode, user can edit the memento text via text input | ☐ |
| AC-03-4 | In Play Mode, memento is displayed as read-only text | ☐ |
| AC-03-5 | Memento changes persist via updateCharacter and survive page reload | ☐ |

### Guardrails
- ✅ Place Tiny Items after Coins, Memento after Tiny Items, both before Encumbrance
- ✅ Use existing SectionPanel, Button, and input styling patterns
- ✅ Respect mode guards (edit-only for structural changes)
- ✅ No hardcoded colors — use CSS variables
- ❌ Do NOT use Drawer/Modal for tiny items (simple inline UI)
- ❌ Do NOT modify CharacterRecord type or Zod schemas (fields already exist)

---

## SS-04: WeaponEditor Render Loop Fix

### Intent
Remove the render-time side effect in WeaponEditor that calls `setForm()` during render. Replace with a `useEffect` that syncs form state from the weapon prop.

### Files

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/components/fields/WeaponEditor.tsx` | Replace render-time conditional with useEffect |

### Implementation Steps

1. **Locate the render-time conditional** in WeaponEditor.tsx:
   ```typescript
   if (open && form.name === '' && weapon) {
     handleOpen();  // calls setForm() → state update during render
   }
   ```

2. **Remove the render-time conditional block entirely.**

3. **Add a useEffect** (ensure `useEffect` is imported):
   ```typescript
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
       setForm(EMPTY_FORM); // or equivalent default form
     }
   }, [open, weapon]);
   ```

4. **Verify no other state setters are called in the render body** (only in event handlers, effects, or callbacks).

### Verification Commands

```bash
# AC-05-1: No state setters in render body (no setForm/setState outside useEffect/handlers)
# Search for setForm calls — all should be inside useEffect, event handlers, or callbacks
grep -n "setForm\|setState" src/components/fields/WeaponEditor.tsx

# AC-05-1: useEffect exists with correct dependencies
grep -n "useEffect" src/components/fields/WeaponEditor.tsx

# Confirm render-time conditional is removed
grep -n "handleOpen()" src/components/fields/WeaponEditor.tsx
# Should NOT appear in render body (may appear in JSX onClick — that's fine)
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-05-1 | No state setters called in render body of WeaponEditor | ☐ |
| AC-05-2 | Opening WeaponEditor with existing weapon populates all form fields | ☐ |
| AC-05-3 | Opening WeaponEditor for new weapon shows empty/default fields | ☐ |
| AC-05-4 | Rapidly opening/closing editor causes no errors or stale state | ☐ |
| AC-05-5 | Saving an edited weapon persists all changes correctly | ☐ |

### Guardrails
- ✅ Use `useEffect` with `[open, weapon]` dependencies
- ✅ Keep existing form field structure and save logic unchanged
- ❌ Do NOT call any state setters outside of event handlers or effects in the render body
- ❌ Do NOT change the WeaponEditor props interface

---

## SS-05: Settings Save Error Surfacing

### Intent
Surface settings save errors to the UI instead of swallowing them. Add error state to useAppSettings, move save out of setState callback, expose `settingsError` through AppStateContext.

### Files

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/features/settings/useAppSettings.ts` | Add error state, restructure save |
| MODIFY | `src/context/AppStateContext.tsx` | Expose settingsError in context |

### Implementation Steps

1. **Modify `src/features/settings/useAppSettings.ts`:**
   - Add `const [error, setError] = useState<string | null>(null)` state
   - Restructure `updateSettings`:
     - Compute new settings value
     - Call `setSettings(updated)` optimistically (immediate state update)
     - Outside setState: `try { await settingsRepository.save(updated); setError(null); } catch (err) { setError('Failed to save settings: ' + message); }`
   - Return `{ settings, updateSettings, error }` (additive — existing fields unchanged)

2. **Modify `src/context/AppStateContext.tsx`:**
   - Update `AppStateContextValue` type to include `settingsError: string | null`
   - Thread `error` from useAppSettings into context value as `settingsError`
   - Provide `settingsError` in the context provider value

### Verification Commands

```bash
# AC-06-1: useAppSettings returns error field
grep -n "error" src/features/settings/useAppSettings.ts

# AC-06-2: Error set on save rejection
grep -n "catch\|Failed to save" src/features/settings/useAppSettings.ts

# AC-06-3: AppStateContextValue includes settingsError
grep -n "settingsError" src/context/AppStateContext.tsx

# AC-06-4: save NOT inside setState callback
grep -n "settingsRepository.save" src/features/settings/useAppSettings.ts
# Verify it's NOT nested inside a setState call

# AC-06-5: Error cleared on success
grep -n "setError(null)" src/features/settings/useAppSettings.ts
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-06-1 | `useAppSettings` returns an `error` field typed as `string \| null` | ☐ |
| AC-06-2 | When `settingsRepository.save()` rejects, `error` is set to a descriptive message | ☐ |
| AC-06-3 | `AppStateContextValue` type includes `settingsError: string \| null` | ☐ |
| AC-06-4 | `settingsRepository.save()` is NOT called inside a `setState` callback | ☐ |
| AC-06-5 | Error cleared (`null`) on next successful save | ☐ |
| AC-06-6 | UI state updates optimistically — settings change immediately | ☐ |

### Guardrails
- ✅ Optimistic update: setState first, then save, set error on failure
- ✅ Follow error display pattern from useAutosave
- ✅ Clear error on next successful save
- ❌ Do NOT swallow errors with only `console.error`
- ❌ Do NOT add retry logic (minimal fix)
- ❌ Do NOT change settingsRepository interface

---

## SS-06: Autosave Timer Leak Fix

### Intent
Fix useAutosave's first useEffect cleanup to clear pending timeouts.

### Files

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `src/hooks/useAutosave.ts` | Add clearTimeout to cleanup, fix comment |

### Implementation Steps

1. **Locate the first useEffect cleanup** in `src/hooks/useAutosave.ts` (lines ~34-36):
   ```typescript
   return () => {
     // Cleanup: flush on unmount   ← misleading comment; body is empty
   };
   ```

2. **Replace with:**
   ```typescript
   return () => {
     // Cleanup: cancel pending debounce timer on dependency change or unmount
     clearTimeout(timerRef.current);
   };
   ```

3. **Verify the second useEffect** (unmount flush) is UNCHANGED.

### Verification Commands

```bash
# AC-07-1: clearTimeout in cleanup
grep -n "clearTimeout(timerRef.current)" src/hooks/useAutosave.ts

# AC-07-2: Comment is accurate
grep -n "cancel pending debounce\|cancel pending timer" src/hooks/useAutosave.ts

# AC-07-4: Second useEffect still present and unchanged
grep -c "useEffect" src/hooks/useAutosave.ts
# Should be 2 (or same count as before)
```

### Acceptance Criteria

| ID | Criterion | Pass? |
|----|-----------|-------|
| AC-07-1 | First useEffect cleanup calls `clearTimeout(timerRef.current)` | ☐ |
| AC-07-2 | Comment accurately describes cleanup purpose | ☐ |
| AC-07-3 | Rapid character updates do not accumulate stale timers | ☐ |
| AC-07-4 | Unmount flush behavior (second useEffect) still works correctly | ☐ |

### Guardrails
- ✅ Add clearTimeout in cleanup return
- ✅ Fix misleading comment
- ✅ Preserve second useEffect for unmount handling
- ❌ Do NOT change debounce timing
- ❌ Do NOT add additional save logic
- ❌ Do NOT remove the second useEffect

---

## Phase 1 Completion Criteria

All 31 acceptance criteria across SS-01, SS-02, SS-04, SS-05, SS-06 must pass before proceeding to Phase 2.

| Sub-Spec | AC Count | Status |
|----------|----------|--------|
| SS-01 | 6 | ☐ |
| SS-02 | 12 | ☐ |
| SS-04 | 5 | ☐ |
| SS-05 | 6 | ☐ |
| SS-06 | 4 | ☐ |
| **Total** | **33** | ☐ |

> **Note:** AC counts adjusted — SS-02 includes both Tiny Items (7) and Memento (5) = 12 total, not the 36 total which includes Phase 2.
