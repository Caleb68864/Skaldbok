## Bugfix & Completion Run for Skaldbok PWA

This is a bugfix/completion run to address all issues identified in the completeness report and fix bugs found in the codebase.

### Source Documents
- Completeness report: docs/factory/2026-03-22T14-15-55-design-doc/completeness-report.md
- Previous failed run spec (scored 93/100, failed at prep stage): docs/factory/2026-03-22T17-15-37-design-doc/spec.md

### Priority 1: Spec Violations (P0)

1. **Missing `metadata` IndexedDB store (REQ-015)** — The Dexie schema only has characters, systems, appSettings, referenceNotes. Need to add a `metadata` store with version(2) additive migration. Create metadataRepository with get/set operations. Files: src/storage/db/client.ts, src/storage/repositories/metadataRepository.ts, src/storage/index.ts

2. **Missing Tiny Items UI on GearScreen (REQ-026)** — CharacterRecord has `tinyItems: string[]` and blank template has `"tinyItems": []`, but GearScreen has no UI for it. Need a "Tiny Items" SectionPanel with list display, add/remove in Edit Mode, read-only in Play Mode. File: src/screens/GearScreen.tsx

3. **Missing Memento UI on GearScreen (REQ-026)** — CharacterRecord has `memento: string` but GearScreen has no UI. Need a "Memento" SectionPanel with text input in Edit Mode, read-only in Play Mode. File: src/screens/GearScreen.tsx

4. **Missing `themesSupported` field on SystemDefinition (REQ-011)** — Add optional `themesSupported?: string[]` to the TypeScript type and Zod schema. Update dragonbane system.json with `"themesSupported": ["dark", "parchment", "light"]`. Files: src/types/system.ts, schemas/system.schema.ts, src/systems/dragonbane/system.json

### Priority 2: Bugs (P0)

5. **WeaponEditor render-time side effect** — WeaponEditor.tsx calls `handleOpen()` (which calls setForm) during render when `form.name === '' && weapon` is truthy. This violates React rules and can cause infinite re-renders. Fix: move form sync to a `useEffect` with `[open, weapon]` dependencies. File: src/components/fields/WeaponEditor.tsx

6. **Settings save errors silently swallowed** — useAppSettings.ts calls `settingsRepository.save(updated).catch(console.error)` inside a setState callback. User never learns of storage failures. Fix: add error state, move save out of setState, expose settingsError in context. Files: src/features/settings/useAppSettings.ts, src/context/AppStateContext.tsx

### Priority 3: Code Quality (P1)

7. **Autosave timer cleanup leak** — useAutosave.ts first useEffect cleanup (lines 34-36) is a no-op with misleading "flush on unmount" comment. Fix: add `clearTimeout(timerRef.current)` to cleanup, fix comment. File: src/hooks/useAutosave.ts

### Constraints
- Correctness over speed
- Minimal diff — fix only what is broken or missing
- No `any` types
- No hardcoded colors — use CSS variables
- Preserve all existing working functionality — zero regressions
- Cross-platform compatible

### Out of Scope
- New features beyond original spec
- Refactoring inline styles to CSS modules
- CSS media queries for orientation
- Toast/notification system
- Death roll success tracking
- Encumbrance formula fix
- Armor/helmet edit forms
- Mode guard consistency refactor
- Navigation improvements
- Test authoring
