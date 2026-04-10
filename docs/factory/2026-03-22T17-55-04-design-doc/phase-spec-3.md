# Phase 3: Verification & Regression Check

**Phase:** 3 of 3
**Spec ID:** SPEC-SKALDBOK-BUGFIX-002
**Run ID:** 2026-03-22T17-55-04-design-doc
**Dependencies:** Phase 1 + Phase 2 complete

---

## Dependency Graph

```
Phase 1 (Wave 1) ──→ Phase 2 (Wave 2) ──→ Phase 3 (Verification)
```

---

## Intent

Perform comprehensive verification of all 36 acceptance criteria across all 6 sub-specs. Run regression checks to confirm no existing functionality is broken. Validate TypeScript compilation and overall code consistency.

---

## Verification Steps

### Step 1: TypeScript Compilation Check

```bash
npx tsc --noEmit
```

**Pass criterion:** Zero type errors. All new types, interfaces, and context fields are correctly threaded.

### Step 2: Automated Acceptance Criteria (17 criteria)

Verify by reading modified files and confirming required code patterns:

| ID | Check | Command |
|----|-------|---------|
| AC-01-1 | metadata table declared | `grep "metadata.*Dexie.Table" src/storage/db/client.ts` |
| AC-01-2 | version(2) adds metadata | `grep "version(2)" src/storage/db/client.ts` |
| AC-01-4 | MetadataRecord type | `grep "export interface MetadataRecord" src/types/metadata.ts` |
| AC-01-5 | Repository get/set | `grep "export.*function" src/storage/repositories/metadataRepository.ts` |
| AC-01-6 | Barrel export | `grep "metadataRepository" src/storage/index.ts` |
| AC-04-1 | themesSupported in type | `grep "themesSupported" src/types/system.ts` |
| AC-04-2 | themesSupported in Zod | `grep "themesSupported" schemas/system.schema.ts` |
| AC-04-3 | themesSupported in JSON | `grep "themesSupported" src/systems/dragonbane/system.json` |
| AC-05-1 | No render-body state setters | Read WeaponEditor.tsx, confirm no setForm outside effects/handlers |
| AC-06-1 | error field returned | `grep "error" src/features/settings/useAppSettings.ts` |
| AC-06-3 | settingsError in context | `grep "settingsError" src/context/AppStateContext.tsx` |
| AC-06-4 | save not in setState | Read useAppSettings.ts, confirm save is outside setState |
| AC-07-1 | clearTimeout in cleanup | `grep "clearTimeout(timerRef.current)" src/hooks/useAutosave.ts` |
| AC-07-2 | Accurate comment | `grep "cancel pending" src/hooks/useAutosave.ts` |

### Step 3: Component Acceptance Criteria (10 criteria)

Verify by reading JSX/TSX and confirming UI structure:

| ID | Check | Method |
|----|-------|--------|
| AC-02-1 | "Tiny Items" SectionPanel in GearScreen | Read GearScreen.tsx |
| AC-02-2 | tinyItems rendered as list | Read GearScreen.tsx |
| AC-02-5 | Play mode hides add/remove | Read GearScreen.tsx mode guards |
| AC-02-7 | Empty item prevention | Read GearScreen.tsx add handler |
| AC-03-1 | "Memento" SectionPanel in GearScreen | Read GearScreen.tsx |
| AC-03-2 | Memento displays character.memento | Read GearScreen.tsx |
| AC-03-4 | Play mode read-only memento | Read GearScreen.tsx mode guards |
| AC-05-2 | WeaponEditor populates fields from weapon | Read WeaponEditor.tsx useEffect |
| AC-05-3 | WeaponEditor shows empty for new weapon | Read WeaponEditor.tsx useEffect |
| AC-06-6 | Optimistic update pattern | Read useAppSettings.ts |

### Step 4: Integration Acceptance Criteria (7 criteria)

Verify by tracing data flow through code:

| ID | Check | Method |
|----|-------|--------|
| AC-01-3 | version(2) upgrade preserves data | Confirm version(1) schema unchanged |
| AC-02-3 | Add tiny item via input + button | Trace updateCharacter call |
| AC-02-4 | Remove tiny item | Trace updateCharacter call |
| AC-02-6 | Tiny items persist via updateCharacter | Confirm autosave pipeline intact |
| AC-03-3 | Edit memento via input | Trace updateCharacter call |
| AC-03-5 | Memento persists via updateCharacter | Confirm autosave pipeline intact |
| AC-05-5 | Edited weapon persists | Confirm save handler unchanged |

### Step 5: Unit Acceptance Criteria (4 criteria)

Verify by reading code logic:

| ID | Check | Method |
|----|-------|--------|
| AC-04-4 | Optional field passes validation | Confirm `.optional()` in Zod schema |
| AC-06-2 | Error set on save rejection | Read try/catch in useAppSettings |
| AC-06-5 | Error cleared on success | Read setError(null) after save |
| AC-07-3 | No stale timer accumulation | Confirm clearTimeout in cleanup |

### Step 6: Manual Acceptance Criteria (1 criterion)

| ID | Check | Method |
|----|-------|--------|
| AC-05-4 | Rapid open/close no errors | Requires manual browser testing |

### Step 7: Regression Checks

```bash
# No existing imports broken
npx tsc --noEmit

# No existing component APIs changed
# Verify: WeaponEditor props interface unchanged
grep "interface.*Props" src/components/fields/WeaponEditor.tsx

# No existing stores modified in version(1)
grep -A5 "version(1)" src/storage/db/client.ts

# No CharacterRecord type changes
# (Tiny Items and Memento fields already exist)

# Settings type — only additive change (error field)
grep "error" src/features/settings/useAppSettings.ts

# AppStateContext — only additive change (settingsError)
grep "settingsError" src/context/AppStateContext.tsx
```

---

## Files Modified Summary (Full Run)

| File | Sub-Spec | Change Type |
|------|----------|-------------|
| `src/types/metadata.ts` | SS-01 | CREATED |
| `src/storage/db/client.ts` | SS-01 | MODIFIED |
| `src/storage/repositories/metadataRepository.ts` | SS-01 | CREATED |
| `src/storage/index.ts` | SS-01 | MODIFIED |
| `src/screens/GearScreen.tsx` | SS-02 | MODIFIED |
| `src/components/fields/WeaponEditor.tsx` | SS-04 | MODIFIED |
| `src/features/settings/useAppSettings.ts` | SS-05 | MODIFIED |
| `src/context/AppStateContext.tsx` | SS-05 | MODIFIED |
| `src/hooks/useAutosave.ts` | SS-06 | MODIFIED |
| `src/types/system.ts` | SS-03 | MODIFIED |
| `schemas/system.schema.ts` | SS-03 | MODIFIED |
| `src/systems/dragonbane/system.json` | SS-03 | MODIFIED |

**Total: 10 modified + 2 created = 12 files**

---

## Overall Acceptance Criteria Summary

| Category | Count | Verification Method |
|----------|-------|---------------------|
| Automated | 17 | grep / static file read |
| Component | 10 | JSX/TSX structure read |
| Integration | 7 | Data flow trace |
| Unit | 4 | Code logic read |
| Manual | 1 | Browser testing |
| **Total** | **37** | |

> **Note:** Count is 37 (not 36 from spec) because AC-01-3 (integration) and AC-04-4 (unit) are counted separately though they could be considered part of automated. The spec says 36 — the extra one is AC-02-7 which was added in v3.0.0.

---

## Phase 3 Completion = Run Complete

When all 36+ acceptance criteria pass and regression checks show no breakage, the run is complete with spec compliance ≥98%.
