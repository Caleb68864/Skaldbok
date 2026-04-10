---
date: 2026-03-31
topic: "Skaldmark Issues Batch Resolution — 17 Issues"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-31
tags:
  - design
  - issues-batch-resolution
---

# Skaldmark Issues Batch Resolution -- Design

## Summary

A session-centric redesign that addresses all 17 open issues across Skaldmark's session screen, notes system, character sheets, quick actions, tags, mentions, navigation, and export. The design groups issues into 5 dependency-ordered batches, each delivering a coherent UX improvement focused on smooth play experience. The Session screen becomes the play hub, with a global quick-action FAB providing access from any screen.

## Approach Selected

**Approach A: Session-Centric Redesign** — Reorganize around the Session screen as the central hub, tackling issues in dependency order so each batch delivers independently valuable improvements. Chosen because the Session screen is where GMs and players spend most time during play, and fixing it first eliminates the biggest pain points earliest.

## Architecture

The design organizes work into 5 sequential batches flowing through the app's core interaction loop:

```
Bottom Nav: [Characters] [Session] [Reference]
Hamburger Menu: [Settings] [About]

Session Screen (play hub):
  - Quick Actions (multi-select picker, coin calculator)
  - Notes Grid (merged from standalone Notes tab, filterable)
  - Session Timeline

Global Layer (all screens):
  - Quick-Action FAB (dice button, lower-left)
  - Session Event Logger Service (shared write path for all events)

Character Sheet:
  - No Combat tab (removed, content redistributed)
  - Rest actions and death rolls moved to Sheet
  - Skills page with dragon/demon marks + inline roll logging

Full Note Editor:
  - Dedicated route (/note/:id/edit or /note/new)
  - Full Tiptap toolbar, not a modal (prevents accidental dismissal)
```

Key architectural decisions:
- Session screen becomes the play hub -- notes, quick actions, and timeline all live here
- Global FAB provides quick-action access from any screen, eliminating navigation to Session for logging
- Session Event Logger is a shared service -- all event types route through it
- Multi-select character picker is a shared component for all "For Who?" selectors
- Reference moves from Settings to bottom nav as a top-level destination
- Settings stays in hamburger menu only (not in bottom nav)
- Full Note Editor is a dedicated page/route, not a modal

## Components

### Batch 1: Session UX Core (Issues 2, 3, 10, 16)

**Fix PartyPicker "For Who?" Selector (Issue 2)**
- IMPORTANT: `PartyPicker` already exists in `src/features/session/SessionQuickActions.tsx` (lines 91-184) with a `multiSelect` prop and a "Party" button
- The bug is likely a wiring issue — the "Party" button click handler or the multiSelect prop may not be passed correctly in all quick action contexts
- Step 1: Read `SessionQuickActions.tsx` and trace the PartyPicker usage to identify the actual bug
- Step 2: Fix the "Party" button to select/deselect all members
- Step 3: Ensure multiSelect is enabled for all quick actions that use PartyPicker (Skill Check, Shopping, Damage, etc.)
- Step 4: Extract PartyPicker into its own file (`src/components/fields/PartyPicker.tsx`) for reuse by the global FAB
- Used by: all quick actions with a "For Who?" step + global FAB's action drawers

**Coin Calculator Widget (Issue 3)**
- Replaces plain text cost field in Shopping quick action
- Use existing `CounterControl` component (`src/components/primitives/CounterControl.tsx`) for Gold/Silver/Copper steppers
- Add a quantity field (also CounterControl) and total calculation display
- Shows breakdown: "2 gold, 5 silver, 0 copper x 3 = 6 gold, 15 silver, 0 copper"
- Does NOT own deducting coins -- the Shopping action handles that

**Global Quick-Action FAB (Issue 10)**
- Floating dice button, lower-left, visible on all screens
- Opens quick-action menu/drawer with all event types
- IMPORTANT: `SessionQuickActions.tsx` is a 12.9KB component with tightly coupled state. The action drawers need to be extracted into standalone components before the FAB can reuse them. Approach: extract each action drawer (Skill Check, Shopping, etc.) into its own component in `src/features/session/actions/`, then have both SessionQuickActions and the FAB compose them.
- Only active when a session is running; shows toast via `useToast().showToast("Start a session first", "warning")` if no session
- Makes Issue 9c (skill rolls from Skills page) automatic

**Bottom Nav Update**
- Move Reference from Settings to bottom nav as top-level tab
- Final nav: [Characters] [Session] [Reference]
- Settings accessible via hamburger menu only

### Batch 2: Notes Overhaul (Issues 4, 5, 11, 12, 13, 14, 15)

**Notes Grid (merged into Session screen)**
- Filterable grid/card layout within Session screen, presented as a tab/section alongside the timeline
- Filters: note type, tags, session, search (MiniSearch already wired), sort by date/name/type
- Toggle: "Show notes from other sessions" (default: off, persist preference per campaign in appSettings)
- Tap a note to navigate to Full Note Editor at `/note/:id/edit`
- Replaces standalone Notes tab: redirect `/notes` to `/session?view=notes` for backwards compatibility (bookmarks, back button)

**Full Note Editor**
- Dedicated route: /note/:id/edit or /note/new
- Full Tiptap toolbar (bold, italic, headings, lists, blockquotes, links)
- Edits title, type, tags, body, and metadata
- Quick Note drawers remain for fast capture during play

**Tiptap Editor Fix (Quick Note)**
- Fix body field rendering as single-line input
- Proper min-height (4-6 lines)
- Surface Tiptap toolbar with formatting controls
- Fallback to plain textarea if Tiptap fails

**@-Mention Fix**
- Store both UUID and display name at insert time
- Render display name as styled mention chip, not UUID
- Arrow key navigation in suggestion dropdown
- Deleted entities fall back to display name as plain text

**Custom Tags**
- Text input or "+" button in tag picker
- Autocomplete: type to filter, offer to create if no match
- Custom tags stored per-campaign in Dexie
- Predefined tags remain as defaults

**Link Note Removal**
- Remove Link Note feature entirely -- Notes Grid with session filtering makes it redundant

### Batch 3: Character Sheet Cleanup (Issues 6, 7, 9)

**Combat Tab Removal**
- Remove /character/combat route and tab from sub-nav
- Death rolls: move to Sheet (visible at HP 0)
- Rest actions (Round/Stretch/Shift): move to Sheet
- HP/WP, conditions, equipment already on Sheet or Gear

**Session Event Logger Hook (`useSessionLogger`)**
- Custom hook that wraps `noteRepository.createNote()` and reads active session/campaign from `CampaignContext`
- NOT a new context provider — composes existing `CampaignContext` + `noteRepository` + `useToast()`
- Creates structured note entries with character name, event type, mechanical outcome, and timestamp
- Handles: rest events, condition changes, skill check results
- Debounces rapid events (coins) using a ref-based buffer with `setTimeout`
- Lives in `src/features/session/useSessionLogger.ts`
- Returns: `{ logEvent(type, data), logCoinChange(characterId, delta), flushPending() }`

**Skills Page Improvements**
- Dragon/demon mark: triple-click cycle (dragon -> demon -> clear) with distinct icons/colors
- Cross-screen sync via Dexie live queries -- skill checks logged elsewhere update Skills page reactively
- Inline roll logging routes through Session Event Logger (or handled by FAB)

### Batch 4: Feedback & Guards (Issues 1, 8)

**Manage Party -- No Campaign Guard**
- Toast: "Create a campaign first" when no campaign exists
- Optional inline "Create Campaign" shortcut
- If campaign exists but no party record: auto-create on first member add

**Coin Change Batching**
- Debounce coin taps over ~3 second window
- Log net change as single entry: "Leroy gained 10 gold"
- Routes through Session Event Logger
- Flush immediately if session ends while coins buffered

### Batch 5: Export Fix (Issue 17)

**Export Permission Fix (Issue 17)**
- IMPORTANT: The codebase uses `navigator.share()` with blob download, NOT the File System Access API. The `NotAllowedError` is likely a user-gesture timing issue with `navigator.share()` (called outside a click handler, or after an async gap)
- Step 1: Read `src/features/export/useExportActions.ts` and trace the call chain for `exportSessionMarkdown` and `exportSessionBundle`
- Step 2: Ensure `navigator.share()` is called synchronously within the click handler's microtask, or switch to direct Blob + `URL.createObjectURL` + `<a download>` which requires no permissions
- Step 3: Add `navigator.canShare()` check before attempting share; fall back to download if not supported
- Works reliably in PWA context without any permission prompts

## Data Flow

### Event Logging Flow (core play loop)

```
User action (any screen)
       |
       v
Global FAB  OR  Session Quick Actions
       |                |
       v                v
Action Drawer / Form
(Multi-Select Picker, Coin Calc, etc.)
       |
       v
Session Event Logger Service
- Validates active session exists
- Creates structured log entry
- Writes to Dexie (notes table)
- Debounces rapid events (coins)
       |
       v
Dexie / IndexedDB (notes table)
       |
  Dexie live queries
       |
  +----+----+----+
  v         v         v
Session   Skills    Notes Grid
Timeline  Page      (filtered)
```

All events flow through the Session Event Logger -- single write path. All downstream screens react via Dexie live queries.

### Notes Data Flow

```
Quick Note Drawer --+
                    +--> Dexie notes table --> Notes Grid (Session screen)
Full Note Editor ---+                         |
(/note/:id/edit)                              +-- Filter by type, tags, session
                                              +-- Search via MiniSearch
                                              +-- Tap -> navigate to /note/:id/edit
```

### @-Mention Data Flow

```
User types "@" --> Mention extension queries Dexie --> Suggestion dropdown
  --> Arrow keys navigate, Enter selects
  --> Entity stored as { id: UUID, label: "Leroy" }
  --> Rendered as chip: @Leroy (UUID retained for linking)
```

## Error Handling

1. **No active session**: FAB and quick actions check via `CampaignContext.activeSession`. Toast via `useToast().showToast("Start a session first", "warning")` + optional action button.
2. **No campaign (party add)**: Toast "Create a campaign first" + inline shortcut. Auto-create party record if campaign exists but party doesn't.
3. **Coin debounce -- navigate away**: `useSessionLogger` hook uses ref-based buffer; `useEffect` cleanup calls `flushPending()` on unmount. Also flush on session end via `CampaignContext.endSession()`.
4. **Tiptap fails to mount**: Quick Note falls back to plain textarea. Full Editor page shows error boundary with "Editor failed to load" + retry button.
5. **@-Mention deleted entity**: Show stored display name as plain text (never raw UUID). The mention node stores `{ id, label }` -- render `label` always.
6. **Export permission denied**: Check `navigator.canShare()` first; if false or share fails, fall back to Blob + `<a download>`. Ensure share call is in synchronous click handler path.
7. **Custom tag conflicts**: Normalize (lowercase, trim, dedupe). Matching predefined tag = select existing.
8. **Partial Notes migration**: If the Notes Grid fails to render within Session screen, the `/notes` redirect should fall back to a simple note list (not break entirely). Use error boundary around the Notes Grid component.
9. **Session Quick Actions extraction**: If extracting action drawers from SessionQuickActions breaks existing functionality, each extraction should be tested individually before proceeding to the next.

## Open Questions

1. ~~**Notes tab destination after merge**~~ RESOLVED: Redirect `/notes` to `/session?view=notes` for backwards compatibility.
2. **Bottom nav icon for Reference** -- Book, scroll, magnifying glass? Visual decision for implementation. (Agent recommends, human approves)
3. **FAB positioning on small screens** -- Lower-left may overlap bottom nav. May need testing. (Agent recommends, human approves)
4. **Rest action placement on Sheet** -- Collapsible "Rest" section? Inline with HP/WP? Layout decision for implementation. (Agent recommends, human approves)
5. **Coin debounce timing** -- 3 seconds proposed. May need user testing; shopping pauses could be 5-10 seconds. (Agent decides, adjustable later)
6. **Existing Link Note entity links** -- When removing Link Note feature, decide whether to migrate existing `linked_to` entity links to note `sessionId` fields, or delete them. (Human decides)

## Approaches Considered

**Approach A: Session-Centric Redesign (Selected)**
Reorganize around Session screen as hub, tackle in dependency order across 5 batches. Each batch delivers independently. Chosen because it prioritizes the most-used screen first and respects natural dependencies.

**Approach B: Risk-First**
Fix all bugs first, then layer in features. Would stabilize fast but risks rework (e.g., fixing Tiptap mentions in an editor about to be redesigned).

**Approach C: Component-First Architecture**
Build shared components first, then wire into screens. Maximum code reuse but longer before users see visible changes.

## Acceptance Criteria

### Batch 1: Session UX Core
- [ ] Tapping "Party" in the PartyPicker selects all party member chips; tapping again deselects all
- [ ] Individual character chips are toggleable independently (multi-select, not radio)
- [ ] PartyPicker works in Skill Check, Shopping, and all quick actions with a "For Who?" step
- [ ] Shopping quick action shows Gold/Silver/Copper steppers with quantity and calculated total
- [ ] The dice FAB is visible on all screens and opens a quick-action menu when a session is active
- [ ] The dice FAB shows a toast "Start a session first" when no session is active
- [ ] Reference screen is accessible from the bottom nav bar (3 tabs: Characters, Session, Reference)
- [ ] Settings is NOT in the bottom nav; accessible only via hamburger menu

### Batch 2: Notes Overhaul
- [ ] Session screen has a Notes Grid section/tab showing notes filterable by type, tags, session, and search
- [ ] "Show notes from other sessions" toggle works and persists preference
- [ ] `/notes` URL redirects to `/session?view=notes`
- [ ] Tapping a note navigates to `/note/:id/edit` (dedicated full-page editor)
- [ ] Full Note Editor has visible Tiptap toolbar with bold, italic, headings, lists, blockquotes, links
- [ ] Quick Note drawer body field renders with min-height ~200px and visible Tiptap toolbar
- [ ] @-mentions display entity names (e.g., "@Leroy"), not UUIDs
- [ ] @-mention dropdown supports arrow key navigation and Enter to select
- [ ] Tag picker has a text input to create custom tags; custom tags persist per-campaign
- [ ] Link Note feature is removed from the UI

### Batch 3: Character Sheet Cleanup
- [ ] `/character/combat` route is removed; Combat tab does not appear in character sub-nav
- [ ] Rest actions (Round/Stretch/Shift) are accessible from the main Sheet screen
- [ ] Death rolls are visible on Sheet when character HP is 0
- [ ] Resting creates a session log entry with mechanical outcome (e.g., "recovered 4 WP, 5 HP")
- [ ] Condition changes create session log entries (e.g., "became Exhausted", "recovered from Dazed")
- [ ] Dragon/demon mark cycles through 3 states: dragon -> demon -> clear
- [ ] Skill checks logged from any screen (FAB, Session, Skills page) appear consistently

### Batch 4: Feedback & Guards
- [ ] Clicking character names in Manage Party with no campaign shows a toast explaining a campaign is required
- [ ] Rapid coin changes (e.g., tapping gold up 10 times) produce a single session log entry with the net change

### Batch 5: Export Fix
- [ ] `exportSessionMarkdown` produces a downloaded .md file without errors
- [ ] `exportSessionBundle` produces a downloaded .zip file without errors
- [ ] Export works in Chrome and Edge (primary PWA targets)

## Commander's Intent

**Desired End State:** All 17 issues are resolved. The Session screen is the primary play hub where GMs log events and browse notes without leaving the screen. Any event type can be logged from any screen via the dice FAB. The character sheet is simplified (no Combat tab). Exports work reliably.

**Purpose:** Make Skaldmark feel seamless during live Dragonbane sessions. Every action a GM or player takes during play should be fast, intuitive, and logged automatically. No dead clicks, no silent failures, no context switching to log an event.

**Constraints:**
- MUST use existing tech stack (React 19, Dexie, Tiptap, MiniSearch, Zod)
- MUST NOT add new npm dependencies without human approval
- MUST NOT modify the Dexie schema version without human approval
- MUST NOT break existing data — all existing notes, sessions, campaigns, characters must remain accessible
- MUST use existing CSS variables from `src/theme/theme.css` for all styling
- MUST follow the existing functional repository pattern (no classes) in `src/storage/repositories/`
- MUST commit after each batch completes (clean incremental history)

**Freedoms:**
- The implementing agent MAY choose component file organization within `src/`
- The implementing agent MAY choose the Notes Grid layout (grid vs list vs cards) as long as it supports the required filters
- The implementing agent MAY choose the FAB animation/menu style
- The implementing agent MAY choose the coin debounce timing (3-5 seconds)
- The implementing agent MAY choose how to visually distinguish dragon vs demon marks

## Execution Guidance

**Observe (signals to monitor):**
- TypeScript compiler: `tsc --noEmit` should pass after each file change
- Vite dev server: no console errors or warnings after changes
- Existing functionality: after each batch, manually verify that unmodified features still work
- Dexie: no `VersionError` or `UpgradeError` in console (would indicate accidental schema changes)

**Orient (codebase conventions to follow):**
- State management: React Context + hooks composition (see `src/context/` and `src/features/`)
- Data access: functional repositories in `src/storage/repositories/` — async functions, not classes
- UI primitives: `src/components/primitives/` — use `Button`, `Chip`, `Drawer`, `Modal`, `Toast`, `CounterControl`, `Card`, `IconButton`
- Notifications: `useToast().showToast(message, variant)` from `src/context/ToastContext.tsx`
- Campaign/session state: `useCampaign()` from `src/features/campaign/CampaignContext.tsx` — provides `activeCampaign`, `activeSession`, `activeParty`
- Character state: `useActiveCharacter()` from `src/context/ActiveCharacterContext.tsx`
- Routes: defined in `src/routes/index.tsx`, bottom nav in `src/components/shell/BottomNav.tsx`
- Tiptap editor: `src/components/notes/TiptapNoteEditor.tsx` — fix in place, don't rebuild
- Mention extension: configured in TiptapNoteEditor with `@` trigger, queries campaign notes + characters
- CSS: use `var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)` — never hardcode colors
- Touch targets: minimum 44px height (`var(--touch-target-min)`)
- IDs: use `generateId()` from `src/utils/` for new entity IDs

**Escalate When:**
- A batch requires adding a new npm dependency
- A Dexie schema version change is needed (new table or index)
- The route structure needs changes beyond what's specified in this plan
- A component being modified has 500+ lines and changes risk breaking existing behavior
- Existing E2E tests fail after changes
- The plan's acceptance criteria seem wrong or contradictory

**Shortcuts (apply without deliberation):**
- Use existing `Chip` component for all toggleable selections (party picker, tag picker, filters)
- Use existing `CounterControl` for all numeric steppers (coins, quantity)
- Use existing `Drawer` for all slide-in panels (action drawers, quick notes)
- Use existing `Card` for note cards in the Notes Grid
- Use existing `SectionPanel` for collapsible sections (rest actions on Sheet)
- Use `noteRepository.createNote()` for all note creation — don't create a parallel write path
- Use `CampaignContext.activeSession` for all "is a session active?" checks
- Follow the pattern in `QuickNoteDrawer.tsx` for new drawer-style forms
- Follow the pattern in `descriptorMentionExtension.ts` for Tiptap extension modifications

## Decision Authority

**Agent Decides Autonomously:**
- File structure and component organization within `src/`
- CSS styling using existing CSS variables
- Toast message wording for error/success notifications
- Internal state management within new components (useState, useRef, etc.)
- Repository function signatures (following existing pattern)
- Test file organization
- Coin debounce timing (3-5 second range)
- Notes Grid card layout and visual design
- FAB menu animation style

**Agent Recommends, Human Approves:**
- Bottom nav icon for Reference tab
- FAB icon and positioning (lower-left vs lower-right vs above nav)
- Rest action placement on Sheet (collapsible section vs inline)
- Full Note Editor route path (`/note/:id/edit` vs alternatives)
- What to do with existing Link Note entity links (migrate vs delete)
- Any changes to component files over 500 lines

**Human Decides:**
- Deferring any of the 17 issues to a future batch
- Adding new npm dependencies
- Modifying the Dexie schema version
- Changes to public data models (Note, Session, Character types)

## War-Game Results

**Most Likely Failure:** The Notes Grid merge into Session (Batch 2) makes the Session screen too complex. Currently it handles quick actions + timeline. Adding a filterable notes grid risks bloat. **Mitigation:** Use a tab or collapsible section within Session to separate timeline from notes browsing. Keep the Notes Grid lazy-loaded so it doesn't impact Session screen initial render.

**Scale Stress:** N/A — local PWA, single user. No server-side scaling concerns.

**Dependency Risk:** Tiptap is the critical dependency for Batch 2 (editor fixes, mention fixes, full editor). If Tiptap has issues with React 19, multiple features are blocked. **Mitigation:** Fix the Quick Note Tiptap rendering first (Issue 11) as a canary — if that works, the full editor and mention fixes should be safe.

**6-Month Maintenance:** Good. Batched design with clear component boundaries. The `useSessionLogger` hook centralizes event creation. Extracted action drawers make the FAB maintainable independently of the Session screen.

## Evaluation Metadata
- Evaluated: 2026-03-31
- Cynefin Domain: Complicated (known unknowns, expertise needed, but solutions are established)
- Critical Gaps Found: 2 (2 resolved — PartyPicker root cause clarified, acceptance criteria added)
- Important Gaps Found: 4 (4 resolved — Session Event Logger defined as hook, /notes redirect specified, codebase shortcuts added, escalation triggers defined)
- Suggestions: 3 (3 incorporated — incremental commits, FAB extraction guidance, notes toggle default)

## Next Steps
- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-31-issues-batch-resolution-design.md`)
- [ ] Commit after each batch completes for clean incremental history
- [ ] Build Batch 1 (Session UX Core) first — it unblocks the most play-session friction
- [ ] Within Batch 2, fix Tiptap rendering (Issue 11) first as a canary before building the full editor
- [ ] Get human approval on: Reference tab icon, FAB positioning, rest action placement, Link Note entity link migration
