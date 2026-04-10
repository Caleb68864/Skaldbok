
<!-- MISSION: DO NOT COMPACT -->
Project: forge-factory
Run: 2026-03-22T14-15-55-design-doc
Phase: forge
Objective: Implement and verify sub-specs per acceptance criteria
Constraints: Correctness over speed. No shell commands. Cross-platform.
<!-- MISSION: DO NOT COMPACT -->

## Stage Outputs

### Stage 2: Forge
- Artifact: spec.md
- Score: 27/30 (Outcome: 5, Scope: 5, Decision guidance: 5, Edges: 4, Criteria: 4, Decomposition: 4)
- Sub-specs: 19 sub-specs identified
- REQ-IDs: 44 requirements extracted (traceability.md seeded)
- Refinement passes: 1 (refined: edges — added browser IndexedDB unsupport case and concurrent tap coalescing)
- Key decisions: Decomposed along the design document's natural phase boundaries; kept sub-specs 1-6 as pure infrastructure with no UI behavior; sub-specs 7-14 are vertical feature slices; sub-specs 15-18 are cross-cutting concerns; sub-spec 19 is a dedicated polish sweep. Selected 5 holdout criteria (BEHAVIORAL and STRUCTURAL) across sub-specs 7, 11, 14, 16, 18. No forge/config/defaults.json found so used sensible defaults (min_criteria_for_holdout: 10, holdout_percent: 15, max_holdout: 5).

### Wave 6 Changes
- Files created: src/utils/modeGuards.ts
- Files modified: src/screens/SheetScreen.tsx (mode guards wired), src/components/layout/TopBar.tsx (already done in wave 4)
- Key interfaces/exports: isFieldEditableInPlayMode(fieldPath)->boolean, useFieldEditable(fieldPath)->boolean (reads mode from AppState)

### Wave 5 Changes
- Files created: src/hooks/useAutosave.ts, src/components/fields/AttributeField.tsx, src/components/fields/ConditionToggleGroup.tsx, src/components/fields/ResourceTracker.tsx, src/utils/migrations.ts, src/utils/importExport.ts
- Files modified: src/screens/SheetScreen.tsx (full implementation), src/screens/CharacterLibraryScreen.tsx (added import/export)
- Key interfaces/exports: useAutosave(char,saveFn,debounceMs)->{isSaving,lastSaved,error}; AttributeField, ConditionToggleGroup, ResourceTracker field components; migrateCharacter/migrateSystem (schema migrations); exportCharacter/importCharacter (file download/upload)

### Wave 4 Changes
- Files created: src/features/characters/characterMappers.ts, src/features/characters/useCharacterActions.ts, src/hooks/useFullscreen.ts, src/hooks/useWakeLock.ts
- Files modified: src/screens/CharacterLibraryScreen.tsx (full implementation), src/screens/ReferenceScreen.tsx (full CRUD), src/screens/SettingsScreen.tsx (theme/mode/data), src/components/layout/TopBar.tsx (mode toggle + fullscreen + wake lock)
- Key interfaces/exports: createBlankCharacter(systemId), useCharacterActions()->{createCharacter,duplicateCharacter,deleteCharacter}; useFullscreen()->{isFullscreen,toggleFullscreen,isSupported}; useWakeLock()->{isActive,toggleWakeLock,isSupported}

### Wave 3 Changes
- Files created: src/features/settings/useAppSettings.ts, src/features/systems/useSystemDefinition.ts, src/context/AppStateContext.tsx, src/context/ActiveCharacterContext.tsx
- Files modified: src/app/AppProviders.tsx (AppStateProvider+ActiveCharacterProvider), src/app/App.tsx (loading gate)
- Key interfaces/exports: useAppSettings() -> {settings,updateSettings,isLoading}; useSystemDefinition(id) -> {system,isLoading,error}; AppStateProvider+useAppState() -> {settings,updateSettings,isLoading,toggleMode}; ActiveCharacterProvider+useActiveCharacter() -> {character,setCharacter,updateCharacter,clearCharacter,isLoading}

### Wave 2 Changes
- Files created: src/theme/themes.ts, src/theme/ThemeProvider.tsx, src/theme/theme.css, src/components/primitives/Button.tsx, src/components/primitives/IconButton.tsx, src/components/primitives/Card.tsx, src/components/primitives/Chip.tsx, src/components/primitives/CounterControl.tsx, src/components/primitives/SectionPanel.tsx, src/components/primitives/Drawer.tsx, src/components/primitives/Modal.tsx, src/pwa/registerPwa.ts, src/pwa/vite-env.d.ts, src/vite-env.d.ts, src/systems/dragonbane/system.json, src/systems/dragonbane/index.ts, sample-data/dragonbane.blank.character.json, src/utils/ids.ts, src/utils/dates.ts, src/storage/db/client.ts, src/storage/repositories/characterRepository.ts, src/storage/repositories/systemRepository.ts, src/storage/repositories/settingsRepository.ts, src/storage/repositories/referenceNoteRepository.ts, src/storage/index.ts, public/favicon.svg, public/icons/icon-192.png, public/icons/icon-512.png
- Files modified: vite.config.ts (PWA plugin), src/app/AppProviders.tsx (ThemeProvider added), src/main.tsx (registerPwa call)
- Key interfaces/exports: ThemeName/'dark'|'parchment'|'light', ThemeProvider+useTheme, DEFAULT_THEME='dark', Button/IconButton/Card/Chip/CounterControl/SectionPanel/Drawer/Modal primitives; dragonbaneSystem (SystemDefinition JSON); db (Dexie client), characterRepository/systemRepository/settingsRepository/referenceNoteRepository; generateId, nowISO

### Wave 1 Changes
- Files created: package.json, tsconfig.json, tsconfig.app.json, tsconfig.node.json, vite.config.ts, index.html, src/main.tsx, src/app/App.tsx, src/app/AppProviders.tsx, src/app/AppLayout.tsx, src/routes/index.tsx, src/screens/CharacterLibraryScreen.tsx, src/screens/SheetScreen.tsx, src/screens/SkillsScreen.tsx, src/screens/GearScreen.tsx, src/screens/MagicScreen.tsx, src/screens/CombatScreen.tsx, src/screens/ReferenceScreen.tsx, src/screens/SettingsScreen.tsx, src/components/layout/TopBar.tsx, src/components/layout/BottomNav.tsx, src/types/common.ts, src/types/system.ts, src/types/character.ts, src/types/settings.ts, src/types/index.ts, schemas/system.schema.ts, schemas/character.schema.ts, schemas/settings.schema.ts
- Files modified: none
- Key interfaces/exports: AppProviders (BrowserRouter wrapper), App (useRoutes), AppLayout (TopBar+Outlet+BottomNav), routes array, 8 placeholder screens; ID/Timestamped/Versioned common types; SystemDefinition/AttributeDefinition/ConditionDefinition/ResourceDefinition/SkillDefinition/SkillCategory; CharacterRecord and all sub-types; AppSettings/ModeName; systemDefinitionSchema, characterRecordSchema, appSettingsSchema (Zod)

### Stage 3: Prep
- Artifact: phase-specs/ (19 files + index.md)
- Sub-specs refined: Project Scaffold and Routing, Theme System and Design Tokens, PWA Configuration and Offline Shell, TypeScript Types and Zod Schemas, Bundled Dragonbane System and Blank Character, IndexedDB Storage Layer and Repositories, App State Context and Startup Hydration, Character Library Screen, Sheet Screen with Live Character Data, Play Mode and Edit Mode System, Skills Screen, Gear Screen and Item Editors, Magic Screen, Combat Screen, Import/Export and Migration Scaffold, Derived Values and Override System, Fullscreen Wake Lock and Device Utilities, Reference Notes and Settings Screens, Responsive Layout Touch Targets and Polish
- Interface contracts: Sub-spec 4 (Types) provides type foundations for sub-specs 5, 6, 15; Sub-spec 7 (AppState) is the integration hub consuming ThemeProvider (2), dragonbaneSystem (5), repositories (6); ActiveCharacterContext is shared state backbone for screens 8-14; Sub-spec 10 (Mode System) provides useFieldEditable() hook consumed by screens 11-14, 16; CounterControl/Card/Drawer/Modal primitives (2) used across all feature screens
- Patterns found: Greenfield project -- no existing code patterns. Established conventions: named function exports, CSS modules for scoping, CSS variables for all colors, Dexie for IndexedDB, React context + hooks for state, Drawer/Modal for complex editors, min 44x44px touch targets
- Build command: npm run build
- Test command: not configured (manual verification for V1, per spec Out of Scope)

### Stage 5: Verify
- Artifact: verify-report.md
- Overall result: PARTIAL
- Spec compliance: PARTIAL — 68 criteria checked, 61 passed, 7 failed, 2 needs_review
- Code quality: FAIL — 9 findings (2 CRITICAL, 3 IMPORTANT, 4 SUGGESTION)
- Integration: FAIL — 5 findings (2 CRITICAL, 1 IMPORTANT, 2 SUGGESTION)
- Traceability: PARTIAL — 83% matrix completeness, 0 orphans, 8 incomplete REQ-IDs
- Holdout: PARTIAL — 3/5 passed (60%)
- Key issues: CombatScreen (sub-spec 14) is entirely unimplemented (7-line placeholder); derivedValues.ts (sub-spec 16) does not exist, leaving derived value computation and overrides unbuilt

## Issues Log
- Stage 5 CRITICAL: CombatScreen is a 7-line placeholder with zero implementation — sub-spec 14 entirely missing (src/screens/CombatScreen.tsx)
- Stage 5 CRITICAL: derivedValues.ts does not exist — sub-spec 16 (Derived Values and Override System) entirely missing, SheetScreen has hardcoded stubs
