# Spec: Skaldmark Issues Batch Resolution — 17 Issues

## Meta
- Client: Logic Nebraska (internal)
- Project: Skaldmark
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldmark
- Date: 2026-03-31
- Author: Forge Dark Factory
- Quality Score: 26/30
  - Outcome: 5/5
  - Scope: 5/5
  - Decision guidance: 4/5
  - Edges: 4/5
  - Criteria: 4/5
  - Decomposition: 4/5
- Status: draft

## Outcome
All 17 open issues are resolved across 5 themed sub-specs. The Session screen becomes the primary play hub with integrated Notes Grid, quick actions, and timeline. A global dice FAB provides quick-action access from any screen. The character sheet is simplified (Combat tab removed, rest actions consolidated on Sheet). Notes system is overhauled with a full-page editor, custom tags, and fixed @-mentions. Exports work reliably without permission errors. The work is complete when all acceptance criteria pass and `tsc --noEmit` succeeds with no errors.

## Intent
Trade-Off Hierarchy:
1. Correctness and data safety over speed of delivery — never break existing data
2. Play-session usability over code elegance — optimize for the GM mid-session
3. Incremental working state over big-bang delivery — each sub-spec must leave the app functional

Decision Boundaries — stop and escalate if:
- A change requires modifying the Dexie schema version (new table or index)
- A new npm dependency would need to be added
- A component being modified exceeds 500 lines and changes risk breaking existing behavior
- Existing E2E tests fail after changes
- The acceptance criteria seem wrong or contradictory
Decide autonomously for everything else.

## Context
Skaldmark is a Dragonbane TTRPG companion PWA built with React 19, Dexie (IndexedDB), Tiptap, MiniSearch, and Zod. The app is organized around screens (`src/screens/`), features (`src/features/`), and shared components (`src/components/`). State management uses React Context + hooks. Data access uses functional repositories in `src/storage/repositories/`.

Key existing code:
- **SessionQuickActions** (`src/features/session/SessionQuickActions.tsx`, ~400 lines): Contains PartyPicker, RollModifiers, TagPicker, and all action drawer logic in a single file. The PartyPicker already supports multiSelect with a "Party" button.
- **useSessionLog** (`src/features/session/useSessionLog.ts`): Existing hook that wraps `createNote()` for session logging. Already supports skill checks, spell casts, HP changes, death rolls.
- **SheetScreen** (`src/screens/SheetScreen.tsx`): Already has rest actions (Round/Stretch/Shift Rest) with modals. Rest is already a panel in the Sheet's draggable panel order.
- **CombatScreen** (`src/screens/CombatScreen.tsx`): Contains HP/WP counters, death rolls, conditions, equipment, rest actions (duplicated from SheetScreen), and round tracker.
- **BottomNav** (`src/components/shell/BottomNav.tsx`): Currently 3 tabs: Session, Notes, Character.
- **CharacterSubNav** (`src/components/shell/CharacterSubNav.tsx`): 5 tabs including Combat.
- **TiptapNoteEditor** (`src/components/notes/TiptapNoteEditor.tsx`): Has @-mention and #descriptor support. Mention popup lacks arrow key navigation. Editor renders without toolbar.
- **TagPicker** (`src/components/notes/TagPicker.tsx`): Static list of predefined tags, no custom tag input.
- **NotesScreen** (`src/screens/NotesScreen.tsx`): Standalone notes list with search, grouped by type. Has LinkNoteDrawer integration.
- **delivery.ts** (`src/utils/export/delivery.ts`): `shareFile()` already has `canShare()` check and `downloadBlob()` fallback. The NotAllowedError is likely a timing issue with async gap before `navigator.share()`.
- **ManagePartyDrawer** (`src/features/campaign/ManagePartyDrawer.tsx`): No campaign guard silently returns on `handleAddMember` — no toast feedback.

Already implemented (verification only):
- Rest actions on SheetScreen (Round/Stretch/Shift) — already present
- Death rolls visible on SheetScreen when HP=0 — needs verification (currently on CombatScreen, may need to be added to SheetScreen)

## Requirements
1. REQ-001: Tapping "Party" in PartyPicker selects all party members; tapping again deselects all.
2. REQ-002: Individual character chips in PartyPicker are toggleable independently (multi-select, not radio).
3. REQ-003: PartyPicker is extracted to `src/components/fields/PartyPicker.tsx` as a shared component.
4. REQ-004: Shopping quick action shows Gold/Silver/Copper steppers (using CounterControl) with quantity and calculated total.
5. REQ-005: A global dice FAB is visible on all screens when inside the ShellLayout.
6. REQ-006: The FAB opens a quick-action menu when a session is active; shows a toast when no session is active.
7. REQ-007: Each action drawer is extracted from SessionQuickActions into its own component under `src/features/session/actions/`.
8. REQ-008: Bottom nav shows 3 tabs: Characters, Session, Reference. Notes tab is removed. Settings is accessible only via hamburger menu.
9. REQ-009: Session screen has a Notes Grid section showing notes filterable by type, tags, session, and search.
10. REQ-010: "Show notes from other sessions" toggle works and persists preference per campaign in appSettings.
11. REQ-011: `/notes` URL redirects to `/session?view=notes`.
12. REQ-012: Tapping a note in Notes Grid navigates to `/note/:id/edit` (dedicated full-page editor route).
13. REQ-013: Full Note Editor has visible Tiptap toolbar with bold, italic, headings, lists, blockquotes, links.
14. REQ-014: Quick Note drawer body field renders with min-height ~200px and visible Tiptap toolbar.
15. REQ-015: @-mentions display entity names (not UUIDs) and store both UUID and display name at insert time.
16. REQ-016: @-mention dropdown supports arrow key navigation and Enter to select.
17. REQ-017: Tag picker has a text input to create custom tags; custom tags persist per-campaign.
18. REQ-018: Link Note feature (LinkNoteDrawer and its UI triggers) is removed from the codebase.
19. REQ-019: `/character/combat` route is removed; Combat tab does not appear in CharacterSubNav.
20. REQ-020: Death rolls are visible on SheetScreen when character HP is 0.
21. REQ-021: Resting creates a session log entry with mechanical outcome via useSessionLog.
22. REQ-022: useSessionLogger hook (or extended useSessionLog) supports coin change debouncing with ref-based buffer and ~3-5 second window.
23. REQ-023: Dragon/demon mark on Skills page cycles through 3 states: dragon, demon, clear (triple-click cycle).
24. REQ-024: Manage Party drawer shows a toast "Create a campaign first" when no campaign exists, instead of silently doing nothing.
25. REQ-025: Rapid coin changes produce a single session log entry with the net change after debounce window.
26. REQ-026: `exportSessionMarkdown` and `exportSessionBundle` produce downloaded files without NotAllowedError.
27. REQ-027: Export works in Chrome and Edge PWA contexts without permission prompts.
28. REQ-028: `tsc --noEmit` passes after all changes.

## Sub-Specs

### 1. Session UX Core — PartyPicker, Coin Calculator, Bottom Nav (Batch 1 partial)
**Scope:** Extract PartyPicker into shared component, fix Shopping quick action with coin calculator using CounterControl, update BottomNav to show Characters/Session/Reference (removing Notes tab), update routes to remove `/notes` standalone and add redirect.
**Files likely touched:**
- `src/features/session/SessionQuickActions.tsx` (extract PartyPicker, update Shopping action)
- `src/components/fields/PartyPicker.tsx` (create)
- `src/components/shell/BottomNav.tsx` (update tabs)
- `src/routes/index.tsx` (update routes, add `/notes` redirect to `/session?view=notes`)
- `src/components/shell/CharacterSubNav.tsx` (remove Combat tab)
- `src/screens/CombatScreen.tsx` (remove or deprecate)
**Acceptance Criteria:**
- `[STRUCTURAL]` `src/components/fields/PartyPicker.tsx` exists and exports a `PartyPicker` component with `multiSelect` prop. (REQ-003)
- `[BEHAVIORAL]` Tapping "Party" chip selects all members; tapping again deselects all. Individual chips are independently toggleable. (REQ-001, REQ-002)
- `[STRUCTURAL]` Shopping action drawer contains Gold/Silver/Copper CounterControl steppers with quantity field and total display. (REQ-004)
- `[STRUCTURAL]` BottomNav `NAV_TABS` array contains exactly: Characters (`/character/sheet`), Session (`/session`), Reference (`/reference`). No Notes tab. (REQ-008)
- `[STRUCTURAL]` CharacterSubNav `CHARACTER_TABS` does not include Combat. (REQ-019)
- `[STRUCTURAL]` Routes file has no `/character/combat` route. A redirect from `/notes` to `/session?view=notes` exists. (REQ-011, REQ-019)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)
**Dependencies:** none

### 2. Global FAB and Action Drawer Extraction (Batch 1 completion)
**Scope:** Extract each action drawer from SessionQuickActions into standalone components under `src/features/session/actions/`. Create the global dice FAB component visible on all screens within ShellLayout. FAB opens quick-action menu when session is active, shows toast when not.
**Files likely touched:**
- `src/features/session/SessionQuickActions.tsx` (refactor to compose extracted drawers)
- `src/features/session/actions/SkillCheckDrawer.tsx` (create)
- `src/features/session/actions/ShoppingDrawer.tsx` (create)
- `src/features/session/actions/RestDrawer.tsx` (create)
- `src/features/session/actions/LootDrawer.tsx` (create)
- `src/features/session/actions/QuoteDrawer.tsx` (create)
- `src/features/session/actions/RumorDrawer.tsx` (create)
- `src/components/shell/GlobalFAB.tsx` (create)
- `src/components/shell/ShellLayout.tsx` (add GlobalFAB)
**Acceptance Criteria:**
- `[STRUCTURAL]` At least 3 action drawer components exist under `src/features/session/actions/`. (REQ-007)
- `[STRUCTURAL]` `src/components/shell/GlobalFAB.tsx` exists and is rendered inside `ShellLayout`. (REQ-005)
- `[BEHAVIORAL]` FAB is visible on all screens within ShellLayout. When no session is active, tapping FAB shows a toast "Start a session first". When a session is active, tapping FAB opens an action menu. (REQ-005, REQ-006)
- `[BEHAVIORAL]` SessionQuickActions still works correctly after refactor — all existing quick action flows function identically. (REQ-007)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)
**Dependencies:** sub-spec 1

### 3. Notes Overhaul — Grid, Full Editor, Tiptap Fix, @-Mentions, Tags, Link Note Removal (Batch 2)
**Scope:** Integrate Notes Grid into Session screen as a tab/section. Create Full Note Editor as dedicated route (`/note/:id/edit` and `/note/new`). Fix TiptapNoteEditor to show toolbar and proper min-height. Fix @-mention to store and display entity names, add arrow key navigation. Add custom tag creation to TagPicker. Remove LinkNoteDrawer and its triggers.
**Files likely touched:**
- `src/screens/SessionScreen.tsx` (add Notes Grid tab/section)
- `src/screens/NoteEditorScreen.tsx` (create — full note editor page)
- `src/routes/index.tsx` (add `/note/:id/edit` and `/note/new` routes)
- `src/components/notes/TiptapNoteEditor.tsx` (add toolbar, fix min-height, fix mention rendering)
- `src/components/notes/TagPicker.tsx` (add custom tag input)
- `src/features/notes/LinkNoteDrawer.tsx` (remove)
- `src/screens/NotesScreen.tsx` (convert to redirect or remove)
- `src/features/notes/descriptorMentionExtension.ts` (may need updates for mention display)
- `src/features/notes/useDescriptorSuggestions.ts` (may need updates)
**Acceptance Criteria:**
- `[STRUCTURAL]` SessionScreen contains a Notes Grid section with filter controls (type, tags, search). (REQ-009)
- `[BEHAVIORAL]` "Show notes from other sessions" toggle filters notes and persists preference. (REQ-010)
- `[STRUCTURAL]` Route `/note/:id/edit` exists and renders a full-page note editor with Tiptap toolbar (bold, italic, headings, lists, blockquotes, links). (REQ-012, REQ-013)
- `[BEHAVIORAL]` Quick Note drawer body field renders at ~200px min-height with visible Tiptap toolbar. (REQ-014)
<!-- HOLDOUT `[BEHAVIORAL]` @-mentions display entity names as styled chips, not UUIDs. Mention data stores `{ id, label }`. (REQ-015) -->
- `[BEHAVIORAL]` @-mention dropdown supports arrow key navigation (Up/Down) and Enter to select. (REQ-016)
- `[STRUCTURAL]` TagPicker has a text input or "+" button for creating custom tags. (REQ-017)
- `[STRUCTURAL]` LinkNoteDrawer is removed. No "Link Note" button appears in any screen. (REQ-018)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)
**Dependencies:** sub-spec 1 (for route updates and bottom nav changes)

### 4. Character Sheet Cleanup and Session Logger Enhancements (Batch 3 + Batch 4)
**Scope:** Ensure death rolls are visible on SheetScreen when HP=0. Add session logging to rest actions. Implement dragon/demon mark triple-click cycle on Skills page. Add "no campaign" guard toast to ManagePartyDrawer. Extend useSessionLog with coin change debouncing. Implement coin change batching for shopping actions.
**Files likely touched:**
- `src/screens/SheetScreen.tsx` (add death rolls section if missing, wire rest actions to session logger)
- `src/screens/SkillsScreen.tsx` (update dragon/demon mark toggle to triple-click cycle)
- `src/features/campaign/ManagePartyDrawer.tsx` (add no-campaign toast guard)
- `src/features/session/useSessionLog.ts` (add coin change debouncing with ref-based buffer)
- `src/components/shell/ShellLayout.tsx` or `src/components/shell/CampaignHeader.tsx` (add no-campaign guard before opening ManagePartyDrawer)
**Acceptance Criteria:**
- `[BEHAVIORAL]` Death rolls section is visible on SheetScreen when character HP is 0, with failure/success tracking. (REQ-020)
<!-- HOLDOUT `[BEHAVIORAL]` Resting (Round/Stretch/Shift) on SheetScreen creates a session log entry with mechanical outcome (e.g., "recovered 4 WP"). (REQ-021) -->
- `[BEHAVIORAL]` Dragon/demon mark on Skills page cycles: unmarked -> dragon -> demon -> clear on successive clicks. Distinct visual for each state. (REQ-023)
- `[BEHAVIORAL]` Opening Manage Party with no campaign shows toast "Create a campaign first" instead of silently opening an empty drawer. (REQ-024)
- `[STRUCTURAL]` useSessionLog exports a `logCoinChange` function with debounce buffer (~3-5 seconds). (REQ-022)
<!-- HOLDOUT `[BEHAVIORAL]` Rapid coin changes within the debounce window produce a single session log entry with net change. (REQ-025) -->
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)
**Dependencies:** sub-spec 1 (CombatScreen removal), sub-spec 2 (useSessionLog may be extended)

### 5. Export Permission Fix (Batch 5)
**Scope:** Fix the NotAllowedError in export functions. Ensure `navigator.share()` is called in synchronous click handler path, or fall back to `downloadBlob()`. Add try/catch around `navigator.share()` with fallback.
**Files likely touched:**
- `src/utils/export/delivery.ts` (fix `shareFile` to handle async timing, add error fallback)
- `src/features/export/useExportActions.ts` (ensure share call is in synchronous click handler path)
**Acceptance Criteria:**
- `[STRUCTURAL]` `shareFile()` in `delivery.ts` wraps `navigator.share()` in try/catch and falls back to `downloadBlob()` on any error. (REQ-026)
- `[BEHAVIORAL]` Clicking "Export Session" or "Export + Notes (ZIP)" on SessionScreen produces a downloaded file without errors in Chrome and Edge. (REQ-026, REQ-027)
- `[MECHANICAL]` `npx tsc --noEmit` passes with no errors. (REQ-028)
**Dependencies:** none

## Edge Cases
- **No active session + FAB tap**: Show toast "Start a session first" via `useToast().showToast()`. Do not open action menu.
- **No campaign + Manage Party**: Show toast "Create a campaign first". If campaign exists but no party, auto-create party on first member add (already implemented in ManagePartyDrawer).
- **Coin debounce — navigate away**: `useSessionLog` cleanup (`useEffect` return) calls `flushPending()` to write buffered coin changes before unmount.
- **Coin debounce — session ends**: Flush pending coin changes when `activeSession` changes to null.
- **Tiptap fails to mount**: Quick Note falls back to plain textarea (already implemented). Full Note Editor shows error boundary with retry button.
- **@-mention with deleted entity**: Show stored display name as plain text (never raw UUID). Mention node stores `{ id, label }` — render `label` always.
- **Custom tag conflicts**: Normalize (lowercase, trim) before storing. If input matches existing predefined tag, select existing rather than creating duplicate.
- **Export navigator.share() fails**: Catch error and fall back to `downloadBlob()` which uses `<a download>` pattern requiring no permissions.
- **Notes redirect from bookmarks**: `/notes` redirects to `/session?view=notes` so existing bookmarks still work.
- **CombatScreen removal — existing links**: Legacy route `/combat` and `/character/combat` redirect to `/character/sheet`.

## Out of Scope
- Adding new npm dependencies
- Modifying Dexie schema version
- Server-side changes (this is a local PWA)
- Combat timeline redesign (CombatTimeline component stays, just not accessible via a dedicated Combat tab)
- Inline skill roll logging from Skills page (handled by FAB — no Skills page changes needed beyond dragon/demon marks)
- Migration of existing Link Note entity links (deferred to human decision per Open Question 6)
- Mobile responsiveness testing beyond basic touch targets
- Dark/light theme changes
- PrintableSheet changes

## Constraints
**Musts:**
- Use existing tech stack (React 19, Dexie, Tiptap, MiniSearch, Zod)
- Use existing CSS variables from `src/theme/theme.css`
- Follow existing functional repository pattern in `src/storage/repositories/`
- All existing notes, sessions, campaigns, characters must remain accessible
- Minimum 44px touch targets (`var(--touch-target-min)`)
- Use `generateId()` from `src/utils/ids.ts` for new entity IDs

**Must-Nots:**
- Must not add new npm dependencies without human approval
- Must not modify the Dexie schema version
- Must not break existing data
- Must not introduce class-based repositories

**Preferences:**
- Prefer composing existing hooks (`useCampaignContext`, `useToast`, `useNoteActions`) over creating new context providers
- Prefer `Chip` component for toggleable selections, `CounterControl` for numeric steppers, `Drawer` for slide-in panels, `Card` for note cards, `SectionPanel` for collapsible sections
- Prefer `noteRepository.createNote()` for all note creation — do not create parallel write paths
- Prefer extracting components into `src/features/session/actions/` for action drawers, `src/components/fields/` for shared field components

**Escalation Triggers:**
- Component being modified exceeds 500 lines and changes risk breaking behavior
- E2E tests fail after changes
- Route structure needs changes beyond what's specified
- Dexie VersionError or UpgradeError appears in console

## Verification
1. Run `npx tsc --noEmit` — must pass with zero errors.
2. Start the dev server (`npm run dev`) and verify:
   - Bottom nav shows Characters, Session, Reference (no Notes tab)
   - Character sub-nav shows Sheet, Skills, Gear, Magic (no Combat tab)
   - `/notes` redirects to `/session?view=notes`
   - `/character/combat` redirects to `/character/sheet`
   - Session screen shows Notes Grid with filters when session is active
   - Tapping a note navigates to `/note/:id/edit` full editor with toolbar
   - Dice FAB is visible on all screens; shows toast when no session active
   - Shopping action has Gold/Silver/Copper steppers with quantity and total
   - @-mentions show entity names, arrow keys navigate dropdown
   - Tag picker allows creating custom tags
   - Export Session and Export + Notes produce downloads without errors
   - Rest actions on Sheet create session log entries
   - Manage Party with no campaign shows toast
3. No console errors for Dexie VersionError or UpgradeError.
