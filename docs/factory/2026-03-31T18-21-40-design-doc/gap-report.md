# Gap Analysis Report

**Spec:** docs/factory/2026-03-31T18-21-40-design-doc/spec.md
**Design Doc:** docs/plans/2026-03-31-issues-batch-resolution-design.md
**Date:** 2026-03-31
**Focus:** all requirements
**Met %:** 89.3%
**PRD Effectiveness Score:** 93/100 (weighted: M=1.0, PM=0.5, MI=0.25, NM=0.0)

## Summary Statistics

| Score | Count | Percentage |
|-------|-------|------------|
| Met | 25 | 89.3% |
| Partial | 2 | 7.1% |
| Not Met | 1 | 3.6% |
| Misinterpreted | 0 | 0% |
| Inferred | 0 | 0% |
| **Total** | **28** | **100%** |

## Traceability Matrix

| ID | Requirement | Score | Root Cause | Evidence |
|----|-------------|-------|------------|----------|
| REQ-001 | Party button selects/deselects all | Met | -- | PartyPicker.tsx:36-39 |
| REQ-002 | Individual chips multi-select | Met | -- | PartyPicker.tsx:40-42 |
| REQ-003 | PartyPicker extracted to shared component | Met | -- | src/components/fields/PartyPicker.tsx exists |
| REQ-004 | Shopping coin steppers with CounterControl | Met | -- | ShoppingDrawer.tsx:161-169 |
| REQ-005 | Global dice FAB on all screens | Met | -- | GlobalFAB.tsx rendered in ShellLayout.tsx:41 |
| REQ-006 | FAB toast when no session, menu when active | Met | -- | GlobalFAB.tsx:79-83 |
| REQ-007 | Action drawers extracted to actions/ | Met | -- | 5 drawers in src/features/session/actions/ |
| REQ-008 | Bottom nav: Characters, Session, Reference | Met | -- | BottomNav.tsx:3-7 |
| REQ-009 | Notes Grid with filters on Session screen | Met | -- | NotesGrid.tsx with type/tag/session/search |
| REQ-010 | Show other sessions toggle persists | Met | -- | settings.ts:23-24, SessionScreen.tsx:399-409 |
| REQ-011 | /notes redirects to /session?view=notes | Met | -- | routes/index.tsx:24 |
| REQ-012 | Note tap navigates to /note/:id/edit | Met | -- | routes/index.tsx:26, NotesGrid.tsx:194-209 |
| REQ-013 | Full Note Editor Tiptap toolbar | **Partial** | Execution: simplified | Toolbar has 7 buttons but **missing Link** |
| REQ-014 | Quick Note min-height + toolbar | Met | -- | QuickNoteDrawer.tsx:131-138 |
| REQ-015 | @-mentions store/display entity names | Met | -- | TiptapNoteEditor.tsx items use {id, label} |
| REQ-016 | @-mention arrow key + Enter | Met | -- | TiptapNoteEditor.tsx:108-127 |
| REQ-017 | Custom tag creation + persistence | **Partial** | Execution: simplified | TagPicker has input UI but callers don't pass onCreateTag/customTags |
| REQ-018 | Link Note feature removed | Met | -- | No LinkNote references in codebase |
| REQ-019 | Combat route/tab removed | Met | -- | CharacterSubNav.tsx:3-8, routes/index.tsx |
| REQ-020 | Death rolls on Sheet when HP=0 | Met | -- | SheetScreen.tsx:414-545 |
| REQ-021 | Rest creates session log entry | Met | -- | SheetScreen.tsx:163,209,405 calls logRest() |
| REQ-022 | Coin debounce in useSessionLog | Met | -- | useSessionLog.ts:111-125, 3000ms buffer |
| REQ-023 | Dragon/demon mark 3-state cycle | Met | -- | SkillsScreen.tsx:45-68 |
| REQ-024 | No-campaign toast on Manage Party | Met | -- | ManagePartyDrawer.tsx:22-24 |
| REQ-025 | Rapid coin changes produce single log | **Not Met** | Execution: simplified | logCoinChange defined but never called; GearScreen logs immediately |
| REQ-026 | Export without NotAllowedError | Met | -- | delivery.ts:8-12 try/catch + fallback |
| REQ-027 | Export works in Chrome/Edge PWA | Met | -- | delivery.ts:3-6 canShare check + blob fallback |
| REQ-028 | tsc --noEmit passes | Met | -- | Verified: zero errors |

## Gap Details

### REQ-013: Full Note Editor Tiptap toolbar (bold, italic, headings, lists, blockquotes, links)

- **Score:** Partial
- **Root Cause:** Execution Gap: simplified
- **What the PRD said:** "Full Tiptap toolbar with bold, italic, headings, lists, blockquotes, links"
- **What was built:** Toolbar has Bold, Italic, H2, H3, Bullet List, Ordered List, Blockquote — 7 of 8 specified items. Link button is missing.
- **Clarifying question:** Should the Link button use Tiptap's built-in link extension or a custom implementation?
- **Domain knowledge assumed:** Link extension requires additional Tiptap dependency (@tiptap/extension-link) which may already be installed.
- **PRD fix suggestion:** No change needed to PRD; this is an execution gap.

### REQ-017: Tag picker custom tag creation + per-campaign persistence

- **Score:** Partial
- **Root Cause:** Execution Gap: simplified
- **What the PRD said:** "Tag picker has a text input to create custom tags; custom tags persist per-campaign"
- **What was built:** TagPicker component has the UI (text input + "+" button) and accepts `onCreateTag` and `customTags` props, but neither QuickNoteDrawer nor NoteEditorScreen pass these props. Custom tags are created in-memory but not persisted to Dexie or appSettings.
- **Clarifying question:** Where should custom tags be stored? AppSettings (per-campaign Record), a new Dexie table, or campaign metadata?
- **Domain knowledge assumed:** Custom tag persistence mechanism was not specified in the design doc.
- **PRD fix suggestion:** Add to spec: "Custom tags are stored in `appSettings.customTags[campaignId]: string[]` and passed to all TagPicker instances."

### REQ-025: Rapid coin changes produce a single session log entry

- **Score:** Not Met
- **Root Cause:** Execution Gap: simplified
- **What the PRD said:** "Rapid coin changes (e.g., tapping gold up 10 times) produce a single session log entry with the net change"
- **What was built:** `logCoinChange` with debounce buffer is fully implemented in useSessionLog.ts (lines 111-125) with ref-based buffer and 3-second timer. However, GearScreen.tsx uses `logToSession()` directly for coin changes (line 141) instead of `logCoinChange()`. The debounce function exists but is never called.
- **Clarifying question:** N/A — the implementation is correct, it just needs to be wired up.
- **Domain knowledge assumed:** None.
- **PRD fix suggestion:** No PRD change needed; this is a wiring gap.

## Items Built Not in Spec

| File | Description | Classification | Recommended Action |
|------|-------------|---------------|-------------------|
| src/features/session/actions/RumorDrawer.tsx | Extracted Rumor action drawer | Correct Inference | Formalize — aligns with REQ-007 "each action drawer" |
| src/screens/SkillsScreen.tsx:70 | Dragon mark count badge (🐉 N marked) | Correct Inference | Formalize — useful play feedback |
| src/screens/SkillsScreen.tsx:114-127 | Auto-success/auto-fail display for dragon/demon marks | Correct Inference | Formalize — core Dragonbane mechanic |

No Wrong Inference or Gold Plating items found.

## Recommended Fixes

### Auto-Fixable (code changes only)
1. **REQ-013:** Add Link button to TiptapNoteEditor toolbar — requires checking if @tiptap/extension-link is installed, then adding `editor.chain().focus().toggleLink().run()` button
2. **REQ-025:** Wire `logCoinChange` into GearScreen.tsx coin handlers — replace direct `logToSession()` calls with `logCoinChange()` from useSessionLog
3. **REQ-017:** Pass `onCreateTag` and `customTags` props from NoteEditorScreen and QuickNoteDrawer to TagPicker; persist to appSettings

### Human Decision Needed (spec ambiguity or missing requirements)
1. **REQ-017:** Where should custom tags be persisted? Options: appSettings (simplest, no schema change), campaign metadata (requires schema thought), or new Dexie table (requires schema version bump — escalation trigger)
