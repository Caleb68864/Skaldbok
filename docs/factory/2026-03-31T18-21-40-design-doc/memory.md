
<!-- MISSION: DO NOT COMPACT -->
Project: forge-factory
Run: 2026-03-31T18-21-40-design-doc
Phase: forge
Objective: Implement and verify sub-specs per acceptance criteria
Constraints: Correctness over speed. No shell commands. Cross-platform.
<!-- MISSION: DO NOT COMPACT -->

## Stage Outputs

### Stage 2: Forge
- Artifact: spec.md
- Score: 26/30 (Outcome: 5, Scope: 5, Decision guidance: 4, Edges: 4, Criteria: 4, Decomposition: 4)
- Sub-specs: 5 sub-specs identified
- REQ-IDs: 28 requirements extracted (traceability.md seeded)
- Refinement passes: 1 (refined: decomposition — consolidated Batch 3+4 into single sub-spec to reduce worker spawns)
- Key decisions:
  - Rest actions already exist on SheetScreen — sub-spec 4 focuses on death rolls, session logging, and dragon/demon marks rather than re-implementing rest
  - Grouped Batch 3 (Character Sheet Cleanup) and Batch 4 (Feedback & Guards) into a single sub-spec since they share files (SheetScreen, useSessionLog) and are both small
  - PartyPicker extraction and Combat tab removal placed in sub-spec 1 to unblock sub-spec 2 (FAB needs extracted PartyPicker) and sub-spec 3 (Notes Grid replaces Notes tab)
  - Export fix kept as independent sub-spec 5 since it touches only delivery.ts and has no dependencies
  - 3 holdout criteria selected from BEHAVIORAL pool: @-mention display (REQ-015), rest logging (REQ-021), coin debounce behavior (REQ-025)

### Stage 3: Prep
- Artifact: phase-specs/ (6 files: 5 sub-spec files + index.md)
- Sub-specs refined: Session UX Core, Global FAB and Action Drawer Extraction, Notes Overhaul, Character Sheet Cleanup and Session Logger Enhancements, Export Permission Fix
- Interface contracts: PartyPicker component (sub-spec 1 -> sub-spec 2), useSessionLog extensions (sub-spec 4 adds logCoinChange/logRest consumed by SheetScreen and action drawers), GlobalFAB (sub-spec 2 -> ShellLayout), NoteEditorScreen route (sub-spec 3 -> routes/index.tsx)
- Patterns found: Drawer primitive for slide-up panels, CounterControl for steppers, Chip for toggleable selections, SectionPanel for collapsible sections, inline styles with CSS variables throughout, functional repositories in src/storage/repositories/, useAutosave hook for debounced persistence
- No test framework detected (no vitest/jest config, no .test/.spec files in src/). E2E tests exist in tests/e2e_full_test.py (Python/Playwright).
- Build command: npx tsc --noEmit
- Test command: not configured (no unit test runner)
- All file paths verified via Glob — no path mismatches found between spec.md and actual codebase.
- Traceability: all 28 REQ-IDs assigned to sub-specs, no orphans.

### Stage 3.5: Pre-Flight Analysis
- Artifact: preflight-report.md
- Status: ADVISORY_ONLY
- Critical issues: 0 (none)
- Advisory issues: 6 (AppSettings missing showOtherSessionNotes field, extraction scope underspecified for 14 action types, demonMarked field conditional language, Shopping action replacement scope, ManagePartyDrawer guard flash, SessionScreen size post-Notes Grid)
- File conflicts: 0 HIGH risk (none)

### Wave 1 Changes
- Files created: src/components/fields/PartyPicker.tsx
- Files modified: src/features/session/SessionQuickActions.tsx, src/components/shell/BottomNav.tsx, src/components/shell/CharacterSubNav.tsx, src/routes/index.tsx, src/utils/export/delivery.ts
- Key interfaces/exports: ResolvedMember (interface), PartyPicker (component) exported from PartyPicker.tsx

### Wave 2 Changes
- Files created: src/features/session/actions/SkillCheckDrawer.tsx, src/features/session/actions/ShoppingDrawer.tsx, src/features/session/actions/LootDrawer.tsx, src/features/session/actions/QuoteDrawer.tsx, src/features/session/actions/RumorDrawer.tsx, src/components/shell/GlobalFAB.tsx, src/features/notes/NotesGrid.tsx, src/screens/NoteEditorScreen.tsx
- Files modified: src/components/shell/ShellLayout.tsx, src/types/settings.ts, src/screens/SessionScreen.tsx, src/components/notes/TiptapNoteEditor.tsx, src/components/notes/TagPicker.tsx, src/screens/NotesScreen.tsx
- Files deleted: src/features/notes/LinkNoteDrawer.tsx
- Key interfaces/exports: GlobalFAB (component), NotesGrid (component), NoteEditorScreen (default export), showToolbar/minHeight props on TiptapNoteEditor, showOtherSessionNotes on AppSettings

### Wave 3 Changes
- Files created: none
- Files modified: src/features/session/useSessionLog.ts, src/types/character.ts, src/screens/SkillsScreen.tsx, src/screens/SheetScreen.tsx, src/features/campaign/ManagePartyDrawer.tsx
- Key interfaces/exports: logRest, logCoinChange added to useSessionLog return; demonMarked?: boolean added to CharacterSkill

### Stage 4: Run
- Sub-specs executed: 5
- Results: 5 PASS, 0 PARTIAL, 0 FAIL
- Waves: 3
- Files changed: src/components/fields/PartyPicker.tsx, src/features/session/SessionQuickActions.tsx, src/components/shell/BottomNav.tsx, src/components/shell/CharacterSubNav.tsx, src/routes/index.tsx, src/utils/export/delivery.ts, src/features/session/actions/SkillCheckDrawer.tsx, src/features/session/actions/ShoppingDrawer.tsx, src/features/session/actions/LootDrawer.tsx, src/features/session/actions/QuoteDrawer.tsx, src/features/session/actions/RumorDrawer.tsx, src/components/shell/GlobalFAB.tsx, src/features/notes/NotesGrid.tsx, src/screens/NoteEditorScreen.tsx, src/components/shell/ShellLayout.tsx, src/types/settings.ts, src/screens/SessionScreen.tsx, src/components/notes/TiptapNoteEditor.tsx, src/components/notes/TagPicker.tsx, src/screens/NotesScreen.tsx, src/features/session/useSessionLog.ts, src/types/character.ts, src/screens/SkillsScreen.tsx, src/screens/SheetScreen.tsx, src/features/campaign/ManagePartyDrawer.tsx (deleted: src/features/notes/LinkNoteDrawer.tsx)
- Issues: none

### Stage 5: Verify
- Artifact: verify-report.md
- Overall result: PARTIAL
- Spec compliance: PARTIAL -- 27 criteria checked, 25 passed, 1 failed, 1 needs review
- Code quality: PARTIAL -- 7 findings (0 CRITICAL, 2 IMPORTANT, 5 SUGGESTION)
- Integration: PASS -- 3 findings (all SUGGESTION)
- Holdout validation: 67% pass rate (2/3 passed; REQ-015 failed)
- Key issues: (1) QuickNoteDrawer missing showToolbar/minHeight props (REQ-014), (2) @-mention suggestion items use `title` instead of `label` field causing UUIDs to be stored in mention nodes (REQ-015)
