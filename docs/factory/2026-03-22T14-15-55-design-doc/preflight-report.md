# Pre-Flight Report -- 2026-03-22T14-15-55-design-doc

**Date:** 2026-03-22 16:45
**Phase Specs Analyzed:** 19
**Status:** CLEAR

## Summary

Greenfield project -- no existing source files to analyze. All 19 sub-specs create new files or modify files created by earlier sub-specs within the same run. No conflicts with existing code are possible.

## Critical Issues

No critical issues found.

## Advisory Issues

No advisory issues found.

## File Conflict Map

| File | Sub-Specs Touching | Conflict Risk |
|------|-------------------|---------------|
| src/app/AppProviders.tsx | 1, 2, 7 | none |
| src/app/App.tsx | 1, 7 | none |
| src/main.tsx | 1, 3 | none |
| vite.config.ts | 1, 3 | none |
| src/components/layout/TopBar.tsx | 1, 10, 17 | none |
| src/context/AppStateContext.tsx | 7, 10 | none |
| src/screens/SheetScreen.tsx | 1, 9, 10, 16 | none |
| src/screens/GearScreen.tsx | 1, 12, 16 | none |
| src/screens/CharacterLibraryScreen.tsx | 1, 8, 15 | none |
| src/screens/MagicScreen.tsx | 1, 13 | none |
| src/screens/CombatScreen.tsx | 1, 14 | none |
| src/screens/SkillsScreen.tsx | 1, 11 | none |
| src/screens/ReferenceScreen.tsx | 1, 18 | none |
| src/screens/SettingsScreen.tsx | 1, 18 | none |
| src/theme/theme.css | 2, 10, 19 | none |
| src/hooks/useAutosave.ts | 9, 19 | none |
| index.html | 1, 19 | none |

All multi-touch files follow a strict dependency order (earlier sub-specs create, later sub-specs modify), so no concurrent modification conflicts arise.

## Interface Contract Verification

| Provider (Sub-Spec) | Consumer (Sub-Spec) | Contract | Status |
|---------------------|---------------------|----------|--------|
| 1 (Scaffold) | 2 (Themes) | AppProviders.tsx exists for ThemeProvider wrapping | MATCH |
| 1 (Scaffold) | 3 (PWA) | vite.config.ts and src/main.tsx exist for modification | MATCH |
| 4 (Types) | 5 (Dragonbane Data) | SystemDefinition type and characterRecordSchema for validation | MATCH |
| 4 (Types) | 6 (Storage) | CharacterRecord, SystemDefinition, AppSettings types | MATCH |
| 4 (Types) | 15 (Import/Export) | characterRecordSchema Zod schema for import validation | MATCH |
| 2 (Themes) | 7 (AppState) | ThemeProvider and useTheme() hook | MATCH |
| 5 (Dragonbane Data) | 7 (AppState) | dragonbaneSystem export from src/systems/dragonbane/index.ts | MATCH |
| 6 (Storage) | 7 (AppState) | characterRepository, systemRepository, settingsRepository | MATCH |
| 6 (Storage) | 8 (Library) | characterRepository (getAll, getById, save, remove) | MATCH |
| 7 (AppState) | 8 (Library) | useActiveCharacter() hook (setCharacter, clearCharacter) | MATCH |
| 7 (AppState) | 9 (Sheet) | useActiveCharacter() (character, updateCharacter) | MATCH |
| 2 (Themes) | 9 (Sheet) | CounterControl, Chip, SectionPanel, Card primitives | MATCH |
| 7 (AppState) | 10 (Mode) | useAppState() with settings.mode and updateSettings() | MATCH |
| 9 (Sheet) | 10 (Mode) | Field components with disabled props | MATCH |
| 5 (Dragonbane Data) | 11 (Skills) | System definition with skillCategories array | MATCH |
| 10 (Mode) | 11 (Skills) | useFieldEditable() or mode from context | MATCH |
| 10 (Mode) | 12 (Gear) | Mode guards for Play/Edit distinction | MATCH |
| 10 (Mode) | 13 (Magic) | Mode guards for Play/Edit distinction | MATCH |
| 9 (Sheet) | 14 (Combat) | ResourceTracker concept, useAutosave hook | MATCH |
| 10 (Mode) | 14 (Combat) | Mode context (Combat ignores mode, always interactive) | MATCH |
| 6 (Storage) | 15 (Import/Export) | characterRepository.save(), characterRepository.getById() | MATCH |
| 8 (Library) | 15 (Import/Export) | CharacterLibraryScreen for adding import/export buttons | MATCH |
| 9 (Sheet) | 16 (Derived Values) | Sheet screen with derived value stubs to replace | MATCH |
| 10 (Mode) | 16 (Derived Values) | Mode guards for Edit-only override editing | MATCH |
| 2 (Themes) | 17 (Device Utils) | IconButton primitive for toggle buttons | MATCH |
| 7 (AppState) | 17 (Device Utils) | useAppState() for persisting wake lock preference | MATCH |
| 6 (Storage) | 18 (Reference/Settings) | referenceNoteRepository (getAll, save, remove) | MATCH |
| 7 (AppState) | 18 (Reference/Settings) | useAppState() for settings | MATCH |
| 1-18 (All) | 19 (Polish) | All screens and components exist for polish pass | MATCH |

## Verdict

CLEAR: Greenfield project. All sub-specs can proceed as written. Dependency ordering is sound, interface contracts are structurally consistent across all 19 phase specs, and no file conflicts exist.
