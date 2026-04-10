# Verify Report -- 2026-03-31T18-21-40-design-doc

**Overall: PARTIAL**
**Date:** 2026-03-31 23:59

## Spec Compliance

| Sub-Spec | Criterion (summary) | Type | Status | Evidence |
|----------|---------------------|------|--------|----------|
| 1 | PartyPicker.tsx exists, exports PartyPicker with multiSelect prop (REQ-003) | [STRUCTURAL] | PASS | `src/components/fields/PartyPicker.tsx` lines 22-32: component exported with `multiSelect?: boolean` prop |
| 1 | Tapping "Party" selects/deselects all; individual chips toggleable (REQ-001, REQ-002) | [BEHAVIORAL] | PASS | `PartyPicker.tsx` lines 33-46: `toggle('__party__')` selects all or deselects all; individual IDs toggle independently in multiSelect mode |
| 1 | Shopping drawer has Gold/Silver/Copper CounterControl steppers with quantity and total (REQ-004) | [STRUCTURAL] | PASS | `ShoppingDrawer.tsx` lines 161-164: CounterControl for Gold, Silver, Copper, Qty; lines 166-169: total display |
| 1 | BottomNav NAV_TABS = Characters, Session, Reference; no Notes tab (REQ-008) | [STRUCTURAL] | PASS | `BottomNav.tsx` lines 3-7: exactly 3 tabs as specified |
| 1 | CharacterSubNav CHARACTER_TABS does not include Combat (REQ-019) | [STRUCTURAL] | PASS | `CharacterSubNav.tsx` lines 3-8: Sheet, Skills, Gear, Magic only |
| 1 | No /character/combat route; /notes redirects to /session?view=notes (REQ-011, REQ-019) | [STRUCTURAL] | PASS | `routes/index.tsx`: no /character/combat child route; line 24: `/notes` redirects to `/session?view=notes`; line 43: `/combat` redirects to `/character/sheet` |
| 1 | tsc --noEmit passes (REQ-028) | [MECHANICAL] | PASS | `npx tsc --noEmit` ran with zero errors |
| 2 | At least 3 action drawer components under actions/ (REQ-007) | [STRUCTURAL] | PASS | 5 drawers created: SkillCheckDrawer, ShoppingDrawer, LootDrawer, QuoteDrawer, RumorDrawer |
| 2 | GlobalFAB.tsx exists and rendered inside ShellLayout (REQ-005) | [STRUCTURAL] | PASS | `GlobalFAB.tsx` exists; `ShellLayout.tsx` line 41: `<GlobalFAB />` rendered |
| 2 | FAB visible on all screens; toast when no session; action menu when session active (REQ-005, REQ-006) | [BEHAVIORAL] | PASS | `GlobalFAB.tsx` lines 78-84: checks `activeSession`, shows toast or toggles menu; rendered in ShellLayout which wraps all screens |
| 2 | SessionQuickActions still works after refactor (REQ-007) | [BEHAVIORAL] | NEEDS_REVIEW | SessionQuickActions.tsx still exists and is rendered in SessionScreen line 215; extracted drawers are used via GlobalFAB. Human testing needed to confirm all flows. |
| 2 | tsc --noEmit passes (REQ-028) | [MECHANICAL] | PASS | Verified above |
| 3 | SessionScreen contains Notes Grid with filter controls (REQ-009) | [STRUCTURAL] | PASS | `SessionScreen.tsx` lines 398-412: NotesGrid rendered with campaignId, sessionId, showOtherSessions, onToggleOtherSessions |
| 3 | "Show notes from other sessions" toggle filters and persists (REQ-010) | [BEHAVIORAL] | PASS | `NotesGrid.tsx` lines 130-149: checkbox toggle; `SessionScreen.tsx` lines 401-411: reads/writes `showOtherSessionNotes` to `appSettings` keyed by campaignId; `settings.ts` line 24: field defined |
| 3 | /note/:id/edit route exists with full-page editor and Tiptap toolbar (REQ-012, REQ-013) | [STRUCTURAL] | PASS | `routes/index.tsx` lines 25-26: routes defined; `NoteEditorScreen.tsx` line 220-221: `showToolbar={true} minHeight="200px"`; `TiptapNoteEditor.tsx` lines 426-447: toolbar with B, I, H2, H3, bullet list, ordered list, blockquote |
| 3 | Quick Note drawer body has ~200px min-height and visible toolbar (REQ-014) | [BEHAVIORAL] | FAIL | `QuickNoteDrawer.tsx` lines 131-136: `TiptapNoteEditor` is rendered WITHOUT `showToolbar` or `minHeight` props. Defaults to `showToolbar=false` and `minHeight='120px'`. Same for QuickNPCDrawer and QuickLocationDrawer. |
| 3 | @-mention dropdown supports arrow key navigation and Enter to select (REQ-016) | [BEHAVIORAL] | PASS | `TiptapNoteEditor.tsx` lines 108-127: `onKeyDown` handler processes ArrowDown, ArrowUp, Enter keys with index tracking and command execution |
| 3 | TagPicker has text input for custom tags (REQ-017) | [STRUCTURAL] | PASS | `TagPicker.tsx` lines 76-113: text input with "Add custom tag..." placeholder and "+" button; `handleAddCustomTag` normalizes and creates tag |
| 3 | LinkNoteDrawer removed; no "Link Note" button in any screen (REQ-018) | [STRUCTURAL] | PASS | `src/features/notes/LinkNoteDrawer.tsx` deleted; grep for "LinkNote" returns zero matches in src/ |
| 3 | tsc --noEmit passes (REQ-028) | [MECHANICAL] | PASS | Verified above |
| 4 | Death rolls visible on SheetScreen when HP = 0 (REQ-020) | [BEHAVIORAL] | PASS | `SheetScreen.tsx` lines 414-545: `deathRollsPanel` conditionally rendered when `isDown` (hp.current === 0); lines 616-617: rendered inline after resources panel |
| 4 | Dragon/demon mark cycles: unmarked -> dragon -> demon -> clear (REQ-023) | [BEHAVIORAL] | PASS | `SkillsScreen.tsx` lines 45-68: `cycleSkillMark` implements triple-state cycle with distinct visuals (dragon emoji, demon emoji, circle); lines 306-318: rendered in play mode |
| 4 | Manage Party with no campaign shows toast (REQ-024) | [BEHAVIORAL] | PASS | `ManagePartyDrawer.tsx` lines 21-25: useEffect guard fires toast "Create a campaign first" and calls onClose when !activeCampaign |
| 4 | useSessionLog exports logCoinChange with debounce buffer (REQ-022) | [STRUCTURAL] | PASS | `useSessionLog.ts` lines 111-125: `logCoinChange` accumulates changes in `coinBuffer` ref with 3-second setTimeout; lines 98-109: `flushCoinBuffer` writes single log entry |
| 4 | tsc --noEmit passes (REQ-028) | [MECHANICAL] | PASS | Verified above |
| 5 | shareFile() wraps navigator.share() in try/catch and falls back to downloadBlob() (REQ-026) | [STRUCTURAL] | PASS | `delivery.ts` lines 8-13: try/catch around navigator.share(), catch block calls downloadBlob() |
| 5 | Export produces downloaded file without errors (REQ-026, REQ-027) | [BEHAVIORAL] | NEEDS_REVIEW | Code structure is correct (try/catch with fallback). Actual runtime behavior in Chrome/Edge PWA requires manual testing. |
| 5 | tsc --noEmit passes (REQ-028) | [MECHANICAL] | PASS | Verified above |

**Compliance result:** PARTIAL (1 FAIL: REQ-014 Quick Note drawer missing toolbar/min-height props)

## Holdout Validation

| Holdout Criterion (summary) | Type | Status | Evidence |
|-----------------------------|------|--------|----------|
| REQ-015: @-mentions display entity names as styled chips, not UUIDs. Mention data stores `{ id, label }`. | [BEHAVIORAL] | FAIL | `TiptapNoteEditor.tsx` lines 314-341: Mention suggestion items are `{ id: n.id, title: n.title }`. Tiptap's Mention extension command expects `{ id, label }` but receives `{ id, title }`. The `title` field is not mapped to `label`, so the mention node will store `{ id: UUID, label: undefined }` and render the UUID or empty text instead of the entity name. The items should use `label` instead of `title` to properly store display names. |
| REQ-021: Resting creates session log entry with mechanical outcome | [BEHAVIORAL] | PASS | `SheetScreen.tsx` line 163: `logRest(character.name, 'Round Rest', 'Recovered N WP')` called after round rest; line 209: `logRest(character.name, 'Stretch Rest', parts.join(' '))` called after stretch rest; line 405: `logRest(character.name, 'Shift Rest', 'Fully recovered')` called after shift rest. All three rest types log mechanical outcomes. |
| REQ-025: Rapid coin changes produce single session log entry with net change | [BEHAVIORAL] | PASS | `useSessionLog.ts` lines 111-125: `logCoinChange` accumulates deltas in `coinBuffer.current.changes` (keyed by coinType), resets the 3-second timer on each call. Lines 98-109: `flushCoinBuffer` computes net change per coin type and writes a single log entry. Lines 127-131: flush on session end. Lines 134-142: flush on unmount. |

Holdout pass rate is 67%.

## Code Quality

### Code Quality Findings

- [IMPORTANT] `src/features/notes/QuickNoteDrawer.tsx`: TiptapNoteEditor is rendered without `showToolbar={true}` and `minHeight="200px"` props, violating REQ-014. The same applies to QuickNPCDrawer and QuickLocationDrawer.
- [IMPORTANT] `src/components/notes/TiptapNoteEditor.tsx`: Mention suggestion items use `{ id, title }` shape but Tiptap Mention extension expects `{ id, label }`. The `title` field is not mapped to `label`, so mention nodes will not store display names. Fix: change suggestion item shape from `{ id: n.id, title: ... }` to `{ id: n.id, label: ... }` and update the renderer to use `item.label` instead of `item.title`.
- [SUGGESTION] `src/components/notes/TiptapNoteEditor.tsx`: The toolbar is missing a "Link" button. REQ-013 specifies "bold, italic, headings, lists, blockquotes, links" but only 7 buttons are present (B, I, H2, H3, bullet list, ordered list, blockquote) -- no link insertion button.
- [SUGGESTION] `src/components/notes/TagPicker.tsx`: The `onCreateTag` prop for persisting custom tags per-campaign is defined but never wired up in NoteEditorScreen.tsx (line 227-230). Custom tags are toggled via `onToggle` but the `onCreateTag` callback is not passed, so custom tags will not persist across sessions.
- [SUGGESTION] `src/components/shell/GlobalFAB.tsx`: The FAB button bottom position (68px) may overlap with the BottomNav. This depends on the BottomNav height. Needs manual verification on device.
- [SUGGESTION] `src/features/session/actions/ShoppingDrawer.tsx`: The `totalStr` and related variables are computed twice (lines 58-68 and 99-109). The second computation at lines 99-109 is used for display; the first at lines 58-68 is used inside `handleLog`. Minor redundancy.
- [SUGGESTION] `src/screens/NotesScreen.tsx`: This file still exists as a standalone screen with full functionality. Per REQ-011, `/notes` redirects to `/session?view=notes`, but the route redirect handles this. The file is not actively harmful but is dead code since no route points to it anymore.

**Quality result:** PARTIAL (2 IMPORTANT findings, no CRITICAL)

## Integration

### Integration Findings

- [SUGGESTION] `src/components/shell/GlobalFAB.tsx` and `src/features/session/SessionQuickActions.tsx`: Both components maintain independent copies of party member resolution logic and action drawer state. The GlobalFAB creates its own set of action drawers (SkillCheck, Shopping, Loot, Quote, Rumor) separately from SessionQuickActions. This means action drawers can be opened from two different entry points with potentially different state. Not broken, but duplicated logic.
- [SUGGESTION] `src/features/notes/NotesGrid.tsx`: Imports `NoteItem` from `./NoteItem` (relative to `src/features/notes/`). The import path `./NoteItem` is correct since NoteItem.tsx exists in `src/features/notes/`. No issue.
- [SUGGESTION] `src/screens/SessionScreen.tsx` line 37: `useAppState()` is used to read/write `showOtherSessionNotes`. The `updateSettings` function merges at the top level. The `showOtherSessionNotes` merge (lines 404-410) correctly spreads existing values and adds the new campaignId key. No merge conflict risk.

**Integration result:** PASS (no CRITICAL or IMPORTANT issues)

## Traceability Audit

| Metric | Value |
|--------|-------|
| Total REQ-IDs | 33 (28 unique + 5 duplicate REQ-028 rows) |
| Orphan REQs | 0 |
| Incomplete REQs | 2 (REQ-014 FAIL, REQ-015 FAIL) |
| Matrix Completeness | 94% |

NOTE: Matrix completeness is below 100%. Review failed or unverified REQ-IDs in traceability.md.

**Traceability result:** PARTIAL

## Recommendations

1. **[IMPORTANT] Fix QuickNoteDrawer toolbar and min-height (REQ-014):** Pass `showToolbar={true}` and `minHeight="200px"` to TiptapNoteEditor in QuickNoteDrawer.tsx (and optionally in QuickNPCDrawer and QuickLocationDrawer). This is a one-line fix per file.

2. **[IMPORTANT] Fix @-mention label storage (REQ-015):** In TiptapNoteEditor.tsx, change the Mention suggestion items from `{ id: n.id, title: ... }` to `{ id: n.id, label: ... }`. Update `createSuggestionRenderer` to reference `item.label` instead of `item.title`. This ensures mention nodes store `{ id: UUID, label: "Entity Name" }` so names display correctly.

3. **[SUGGESTION] Add Link button to Tiptap toolbar (REQ-013):** The spec lists "links" in the toolbar requirements. Add a link insertion button to the toolbar in TiptapNoteEditor.tsx. This requires the Tiptap Link extension (check if already installed).

4. **[SUGGESTION] Wire up custom tag persistence:** Pass `onCreateTag` to TagPicker in NoteEditorScreen.tsx and persist custom tags per-campaign (e.g., in appSettings or a dedicated store).

5. **[SUGGESTION] Remove dead NotesScreen.tsx:** Since `/notes` now redirects, the full NotesScreen component is unused dead code. Consider removing or converting to a simple redirect component.
