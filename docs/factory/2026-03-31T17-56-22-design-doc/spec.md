# Forge Spec — Skaldmark Issues Batch Resolution (17 Issues)

**Run:** 2026-03-31T17-56-22-design-doc
**Phase:** forge
**Branch:** 2026/03/31-1649-caleb-feat-forge-input-20260331-160300
**HEAD:** 4d610852dd60
**Spec Score:** 91 / 100

---

## Intent Hierarchy

```
Commander's Intent
└─ Desired End State: All 17 issues resolved; Session screen is the primary play hub
   ├─ Purpose: Make Skaldmark seamless during live Dragonbane sessions — fast, intuitive,
   │            auto-logged, no dead clicks, no silent failures, no context switching
   └─ Constraints
       ├─ MUST use existing stack: React 19, Dexie, Tiptap, MiniSearch, Zod
       ├─ MUST NOT add new npm dependencies without human approval
       ├─ MUST NOT modify Dexie schema version without human approval
       ├─ MUST NOT break existing data (notes, sessions, campaigns, characters)
       ├─ MUST use CSS variables from src/theme/theme.css (no hardcoded colors)
       ├─ MUST follow functional repository pattern (no classes)
       └─ MUST commit after each batch completes

Batch 1: Session UX Core  (Issues 2, 3, 10, 16)
├─ Fix PartyPicker "For Who?" selector
├─ Add Coin Calculator Widget to Shopping action
├─ Add Global Quick-Action FAB
└─ Update Bottom Nav (add Reference, remove Settings)

Batch 2: Notes Overhaul  (Issues 4, 5, 11, 12, 13, 14, 15)
├─ Notes Grid merged into Session screen
├─ Full Note Editor as dedicated route
├─ Fix Tiptap Quick Note body rendering
├─ Fix @-Mention display and keyboard navigation
├─ Add Custom Tags
└─ Remove Link Note feature

Batch 3: Character Sheet Cleanup  (Issues 6, 7, 9)
├─ Remove Combat tab
├─ Implement useSessionLogger hook
└─ Skills Page improvements (dragon/demon marks)

Batch 4: Feedback & Guards  (Issues 1, 8)
├─ Manage Party — no-campaign guard
└─ Coin Change Batching / debounce

Batch 5: Export Fix  (Issue 17)
└─ Fix navigator.share() NotAllowedError
```

---

## Scoring Rationale

| Dimension | Score | Notes |
|-----------|-------|-------|
| Completeness | 19/20 | All 17 issues addressed; one open question remains human-gated (Link Note entity migration) |
| Clarity | 18/20 | Codebase pointers are precise; a few layout details deferred to agent |
| Testability | 18/20 | All ACs are concrete and binary; 3 ACs mention "human approves" visual decisions |
| Risk Coverage | 18/20 | War-game addresses top risks; Tiptap/React 19 canary strategy sound |
| Dependency Order | 18/20 | Batches are well-sequenced; Batch 3 logger hook is correctly before Batch 4 events |
| **Total** | **91/100** | Ready to implement |

---

## Sub-Specs

---

### SPEC-B1-1 — PartyPicker "For Who?" Fix (Issue 2)

**Intent:** The multiSelect behavior exists in code but is not wired correctly in all quick-action contexts. Fix the wiring, not the component logic.

**Key Files:**
- `src/features/session/SessionQuickActions.tsx` (lines 91–184 contain PartyPicker)
- Extraction target: `src/components/fields/PartyPicker.tsx`

**Implementation Steps:**
1. Read `SessionQuickActions.tsx`; trace PartyPicker's `multiSelect` prop and "Party" button `onClick` to find the bug
2. Fix "Party" button to toggle-all (select all if any unselected; deselect all if all selected)
3. Verify `multiSelect={true}` is passed for Skill Check, Shopping, Damage, and all "For Who?" quick actions
4. Extract PartyPicker into `src/components/fields/PartyPicker.tsx`; update import in SessionQuickActions
5. Export PartyPicker for reuse by the FAB action drawers (SPEC-B1-3)

**Acceptance Criteria:**
- [ ] B1-1-AC1: Tapping "Party" in PartyPicker selects all party member chips; tapping again deselects all
- [ ] B1-1-AC2: Individual character chips are toggleable independently (multi-select, not radio behavior)
- [ ] B1-1-AC3: PartyPicker with multiSelect works in Skill Check, Shopping, and all quick actions with a "For Who?" step
- [ ] B1-1-AC4: PartyPicker lives at `src/components/fields/PartyPicker.tsx` and is importable by other features

**Escalate If:** PartyPicker has >500 lines after extraction, or the bug is in a shared primitive that would affect other features.

---

### SPEC-B1-2 — Coin Calculator Widget (Issue 3)

**Intent:** Replace the plain text cost field in the Shopping quick action with a structured coin picker that computes totals.

**Key Files:**
- `src/components/primitives/CounterControl.tsx` — use this for Gold/Silver/Copper steppers and quantity
- `src/features/session/SessionQuickActions.tsx` — Shopping action drawer to modify
- Extraction target: `src/features/session/actions/CoinCalculator.tsx`

**Implementation Steps:**
1. Create `src/features/session/actions/CoinCalculator.tsx` with:
   - CounterControl for Quantity (min 1)
   - CounterControl for Gold, Silver, Copper (min 0)
   - Computed total display: `"{qty}x {g}g {s}s {c}c = {total_g}g {total_s}s {total_c}c"`
   - Normalize totals (50 copper → 1 silver; 10 silver → 1 gold)
2. Replace plain cost input in Shopping drawer with `<CoinCalculator>`
3. CoinCalculator exposes `value: { gold, silver, copper }` for the Shopping action to deduct

**Acceptance Criteria:**
- [ ] B1-2-AC1: Shopping quick action shows Gold/Silver/Copper steppers and a quantity stepper
- [ ] B1-2-AC2: Total calculation updates in real time and normalizes coin denominations
- [ ] B1-2-AC3: CoinCalculator does NOT deduct coins itself — Shopping action owns that logic

**Escalate If:** CounterControl doesn't support the needed min/max/step props.

---

### SPEC-B1-3 — Global Quick-Action FAB (Issue 10)

**Intent:** A floating dice button, visible on all screens, that opens the full quick-action menu when a session is active.

**Key Files:**
- `src/features/session/SessionQuickActions.tsx` — extract action drawers before FAB can compose them
- Extraction targets: `src/features/session/actions/{SkillCheckDrawer,ShoppingDrawer,DamageDrawer,...}.tsx`
- New files: `src/components/shell/QuickActionFAB.tsx`
- `src/components/shell/BottomNav.tsx` or root layout — mount FAB here so it appears on all screens
- `src/context/ToastContext.tsx` — `useToast().showToast(message, variant)` for no-session toast
- `src/features/campaign/CampaignContext.tsx` — `useCampaign().activeSession` for guard

**Implementation Steps:**
1. Extract each action drawer from `SessionQuickActions.tsx` into `src/features/session/actions/`:
   - One file per drawer type; test each extraction individually before proceeding
2. Refactor SessionQuickActions to compose extracted drawers (behavior unchanged)
3. Create `QuickActionFAB.tsx`:
   - Fixed position, lower-left (CSS: `position: fixed; bottom: calc(var(--space-4) + 56px); left: var(--space-4)` to clear bottom nav)
   - Dice icon button, min 44px touch target
   - On press with active session: open quick-action menu/drawer listing all event types
   - On press without active session: `showToast("Start a session first", "warning")`
4. Mount FAB in the root layout (or shell) outside the route outlet, so it persists across navigation
5. FAB automatically covers Issue 9c (skill roll logging from Skills page) via action drawers

**Acceptance Criteria:**
- [ ] B1-3-AC1: Dice FAB is visible on all screens (Characters, Session, Reference, character detail, etc.)
- [ ] B1-3-AC2: Tapping FAB with an active session opens the quick-action menu/drawer
- [ ] B1-3-AC3: Tapping FAB with no active session shows toast "Start a session first" (warning variant)
- [ ] B1-3-AC4: All action drawers remain fully functional via Session screen (no regression)
- [ ] B1-3-AC5: FAB does not obscure critical UI elements on small screens (verify at 375px width)

**Escalate If:** SessionQuickActions exceeds 500 lines and extraction risks breaking existing functionality — extract one drawer at a time and verify before continuing.

---

### SPEC-B1-4 — Bottom Nav Update (Issue 16)

**Intent:** Promote Reference to a top-level bottom nav destination; demote Settings to hamburger-only.

**Key Files:**
- `src/components/shell/BottomNav.tsx`
- `src/routes/index.tsx`

**Implementation Steps:**
1. Update BottomNav to: `[Characters] [Session] [Reference]` (3 tabs)
2. Remove Settings from bottom nav; ensure it remains accessible via hamburger menu
3. Add Reference route to bottom nav with appropriate icon (recommend: book/scroll icon using existing icon set — **human approves final icon**)

**Acceptance Criteria:**
- [ ] B1-4-AC1: Bottom nav shows exactly 3 tabs: Characters, Session, Reference
- [ ] B1-4-AC2: Settings is NOT in bottom nav; accessible via hamburger menu only
- [ ] B1-4-AC3: Reference tab navigates to the Reference screen

**Open:** Reference tab icon — agent recommends, human approves.

---

### SPEC-B2-1 — Notes Grid in Session Screen (Issues 4, 15)

**Intent:** Merge the standalone Notes tab into the Session screen as a filterable Notes Grid section, with a toggle to show notes from other sessions.

**Key Files:**
- `src/features/session/SessionScreen.tsx` (or equivalent) — add Notes Grid tab/section
- `src/features/notes/NotesGrid.tsx` (new)
- `src/routes/index.tsx` — add `/notes` → `/session?view=notes` redirect
- `src/storage/repositories/noteRepository.ts` — existing query functions
- App settings (Dexie) — persist "show other sessions" toggle per campaign

**Implementation Steps:**
1. Create `src/features/notes/NotesGrid.tsx`:
   - Card layout using existing `Card` component
   - Filters: note type, tags, session, text search (MiniSearch already wired)
   - Sort: by date (desc default), name, type
   - "Show notes from other sessions" toggle (default off); persist in `appSettings` per campaign
   - Tap a note card → navigate to `/note/:id/edit`
   - Lazy-load (don't impact Session screen initial render)
2. Add Notes Grid as a tab or collapsible section in Session screen alongside timeline
3. Add route redirect: `/notes` → `/session?view=notes`
4. Wrap NotesGrid in an error boundary with a simple fallback list

**Acceptance Criteria:**
- [ ] B2-1-AC1: Session screen has a Notes Grid section/tab showing filterable notes
- [ ] B2-1-AC2: Notes can be filtered by type, tags, session, and searched by text
- [ ] B2-1-AC3: "Show notes from other sessions" toggle works and persists preference per campaign
- [ ] B2-1-AC4: `/notes` URL redirects to `/session?view=notes`
- [ ] B2-1-AC5: Tapping a note card navigates to `/note/:id/edit`
- [ ] B2-1-AC6: Notes Grid is lazy-loaded; Session screen initial render is not degraded

---

### SPEC-B2-2 — Full Note Editor (Issue 5)

**Intent:** Replace the modal-based note editing with a dedicated full-page editor route that can't be accidentally dismissed.

**Key Files:**
- `src/routes/index.tsx` — add `/note/:id/edit` and `/note/new` routes
- `src/features/notes/NoteEditorPage.tsx` (new)
- `src/components/notes/TiptapNoteEditor.tsx` — reuse existing editor

**Implementation Steps:**
1. Create `/note/:id/edit` and `/note/new` routes in `src/routes/index.tsx`
2. Create `src/features/notes/NoteEditorPage.tsx`:
   - Full Tiptap toolbar (bold, italic, headings, lists, blockquotes, links)
   - Fields: title, type (selector), tags (tag picker from SPEC-B2-5), body (TiptapNoteEditor)
   - Save: writes via `noteRepository.createNote()` or update equivalent
   - Back navigation returns to previous screen (or `/session?view=notes`)
   - Error boundary: "Editor failed to load" + retry button

**Acceptance Criteria:**
- [ ] B2-2-AC1: `/note/:id/edit` and `/note/new` routes exist and render the full editor
- [ ] B2-2-AC2: Full Note Editor shows Tiptap toolbar with bold, italic, headings, lists, blockquotes, links
- [ ] B2-2-AC3: Title, type, tags, and body are all editable and saved correctly
- [ ] B2-2-AC4: Editor uses dedicated page/route (not a modal); cannot be accidentally dismissed

**Open:** Final route path — `/note/:id/edit` recommended; human approves if different.

---

### SPEC-B2-3 — Tiptap Quick Note Fix (Issue 11)

**Intent:** Fix the Quick Note drawer body field so it renders as a multi-line editor, not a single-line input.

**Key Files:**
- `src/components/notes/TiptapNoteEditor.tsx` — fix in place; do not rebuild
- `src/features/session/QuickNoteDrawer.tsx` (or equivalent)

**Implementation Steps:**
1. Read `TiptapNoteEditor.tsx`; identify why it renders single-line (likely missing `min-height` CSS or wrong editor config)
2. Apply `min-height: 200px` (or `~4–6 lines` equivalent using `var(--space-*)`)
3. Ensure Tiptap toolbar is visible in the Quick Note context
4. Add fallback: if Tiptap fails to mount, render plain `<textarea>` with same min-height

**Acceptance Criteria:**
- [ ] B2-3-AC1: Quick Note drawer body field renders with min-height ~200px
- [ ] B2-3-AC2: Tiptap toolbar is visible in the Quick Note drawer
- [ ] B2-3-AC3: If Tiptap fails to mount, a plain textarea fallback is shown

**Note:** Fix this first within Batch 2 as a canary for Tiptap/React 19 compatibility.

---

### SPEC-B2-4 — @-Mention Fix (Issue 12)

**Intent:** Mentions should display the entity's name, not a raw UUID. Arrow-key navigation must work in the suggestion dropdown.

**Key Files:**
- `src/components/notes/TiptapNoteEditor.tsx`
- `src/extensions/descriptorMentionExtension.ts` (or equivalent) — follow its pattern

**Implementation Steps:**
1. At insert time, store `{ id: UUID, label: "EntityName" }` in the mention node attributes
2. Render mention nodes as styled chips showing `label` (e.g., `@Leroy`), never the UUID
3. If referenced entity is deleted, render `label` as plain text (not a chip, no UUID visible)
4. Fix arrow key (↑/↓) navigation in suggestion dropdown; Enter selects focused suggestion

**Acceptance Criteria:**
- [ ] B2-4-AC1: @-mentions display the entity's name (e.g., "@Leroy"), not a UUID
- [ ] B2-4-AC2: @-mention dropdown supports ↑/↓ arrow key navigation and Enter to select
- [ ] B2-4-AC3: Mentions to deleted entities show the stored display name as plain text (no UUID)

---

### SPEC-B2-5 — Custom Tags (Issue 13)

**Intent:** Allow GMs to create custom tags inline in the tag picker; custom tags persist per campaign.

**Key Files:**
- Tag picker component (identify location in codebase)
- Dexie campaign settings (per-campaign storage for custom tags — no schema version change if using existing settings blob)

**Implementation Steps:**
1. Add text input or "+" button in tag picker
2. Typing filters existing tags (predefined + custom); if no match, offer "Create '{input}'" option
3. On create: normalize (lowercase, trim, dedupe); if it matches a predefined tag, select that instead
4. Store custom tags per-campaign in Dexie (within existing campaign/settings structure if possible — do not bump schema version)
5. Predefined tags remain as defaults alongside custom tags

**Acceptance Criteria:**
- [ ] B2-5-AC1: Tag picker has a text input to filter and create custom tags
- [ ] B2-5-AC2: Custom tags persist per-campaign across app restarts
- [ ] B2-5-AC3: Typing a name matching a predefined tag selects the existing tag (no duplicate)

**Escalate If:** Storing custom tags requires a new Dexie table or schema version bump — human must approve.

---

### SPEC-B2-6 — Remove Link Note Feature (Issue 14)

**Intent:** Remove the Link Note UI. The Notes Grid with session filtering makes it redundant.

**Key Files:**
- Identify Link Note entry points in the codebase (search for "LinkNote" or "link_note" or "linked_to")
- `src/routes/index.tsx` — remove route if one exists

**Implementation Steps:**
1. Search codebase for Link Note UI entry points and remove them
2. Remove any Link Note route
3. Do NOT delete existing `linked_to` data from Dexie — data preservation required
4. **Human decides** what to do with existing entity links (migrate to `sessionId` vs leave as orphaned data)

**Acceptance Criteria:**
- [ ] B2-6-AC1: Link Note feature is not accessible from any screen or menu
- [ ] B2-6-AC2: Existing note data (including linked_to fields) is not deleted

**Open:** Migration of existing Link Note entity links — human decision required before implementation.

---

### SPEC-B3-1 — Combat Tab Removal (Issue 6)

**Intent:** Simplify the character sheet by removing the Combat tab; redistribute its content to Sheet and other relevant tabs.

**Key Files:**
- `src/routes/index.tsx` — remove `/character/combat` route
- Character sub-nav component — remove Combat tab
- `src/features/character/SheetPage.tsx` (or equivalent) — add rest actions and death rolls

**Implementation Steps:**
1. Identify all content currently on the Combat tab
2. Move Death Rolls UI: display on Sheet when character HP = 0 (conditional render)
3. Move Rest Actions (Round/Stretch/Shift): add to Sheet as a collapsible section (**human approves placement**)
4. HP/WP, conditions, equipment: verify they are already on Sheet or Gear (no move needed per design)
5. Remove `/character/combat` route and Combat tab from sub-nav

**Acceptance Criteria:**
- [ ] B3-1-AC1: `/character/combat` route returns 404 or redirects; Combat tab absent from character sub-nav
- [ ] B3-1-AC2: Rest actions (Round/Stretch/Shift) are accessible from the main Sheet screen
- [ ] B3-1-AC3: Death rolls UI is visible on Sheet when character HP is 0

**Open:** Rest action placement (collapsible section vs inline) — agent recommends, human approves.

---

### SPEC-B3-2 — useSessionLogger Hook (Issue 7, prerequisite for B3-3, B4-2)

**Intent:** Centralize all session event creation in a single reusable hook; all screens write events through this hook.

**Key Files:**
- New: `src/features/session/useSessionLogger.ts`
- `src/features/campaign/CampaignContext.tsx` — provides `activeCampaign`, `activeSession`
- `src/storage/repositories/noteRepository.ts` — `createNote()` is the write path
- `src/context/ToastContext.tsx` — for error toasts

**Implementation Steps:**
1. Create `src/features/session/useSessionLogger.ts`:
   ```ts
   // Composes CampaignContext + noteRepository + useToast
   // Returns: { logEvent(type, data), logCoinChange(characterId, delta), flushPending() }
   ```
2. `logEvent`: creates a structured note entry with character name, event type, mechanical outcome, timestamp; uses `noteRepository.createNote()`
3. `logCoinChange`: debounces rapid coin events using a `useRef` buffer + `setTimeout` (3–5 second window); calls `flushPending()` on unmount via `useEffect` cleanup
4. `flushPending`: writes any buffered coin events immediately
5. Hook is NOT a new Context provider; it composes existing contexts

**Acceptance Criteria:**
- [ ] B3-2-AC1: `useSessionLogger` hook is importable from `src/features/session/useSessionLogger.ts`
- [ ] B3-2-AC2: `logEvent` creates a note entry in Dexie with correct type, character, outcome, timestamp
- [ ] B3-2-AC3: `logCoinChange` buffers rapid calls and writes a single net-change entry after debounce
- [ ] B3-2-AC4: Navigating away flushes any pending coin events (useEffect cleanup)
- [ ] B3-2-AC5: Hook does not create a new Context provider

---

### SPEC-B3-3 — Skills Page Improvements (Issue 9)

**Intent:** Add dragon/demon mark cycling to skill entries; ensure skill-check logs are consistent regardless of source.

**Key Files:**
- `src/features/character/SkillsPage.tsx` (or equivalent)
- `useSessionLogger` (from SPEC-B3-2)

**Implementation Steps:**
1. Dragon/demon mark: implement triple-tap cycle on each skill — dragon → demon → clear → dragon
   - Distinct icon/color for each state (agent chooses visual treatment using existing CSS vars)
   - Persist state in character data via existing character repository
2. Cross-screen sync: use Dexie live queries on the skills page — skill check logs written elsewhere update Skills page reactively
3. Inline roll logging: if user logs a skill check from Skills page, route through `useSessionLogger.logEvent()`

**Acceptance Criteria:**
- [ ] B3-3-AC1: Dragon/demon mark cycles through 3 states: dragon → demon → clear (triple-tap)
- [ ] B3-3-AC2: Dragon and demon marks use visually distinct icons/colors
- [ ] B3-3-AC3: Skill check logs from FAB, Session screen, and Skills page appear consistently in the session timeline

---

### SPEC-B4-1 — Manage Party No-Campaign Guard (Issue 1)

**Intent:** Prevent confusing state when a user tries to add party members before creating a campaign.

**Key Files:**
- Manage Party screen / party member add flow
- `src/features/campaign/CampaignContext.tsx` — `useCampaign().activeCampaign`
- `src/context/ToastContext.tsx`

**Implementation Steps:**
1. At party member add entry point: check `activeCampaign`
2. If no campaign: show toast "Create a campaign first" (warning); optionally show inline "Create Campaign" shortcut
3. If campaign exists but no party record: auto-create party record on first member add

**Acceptance Criteria:**
- [ ] B4-1-AC1: Attempting to add a party member with no campaign shows toast "Create a campaign first"
- [ ] B4-1-AC2: With a campaign but no party record, the party record is auto-created on first member add

---

### SPEC-B4-2 — Coin Change Batching (Issue 8)

**Intent:** Rapid coin-tap sequences (e.g., gold +10 fast) produce a single session log entry, not 10.

**Key Files:**
- Coin change UI (Shopping action, character sheet coin fields)
- `useSessionLogger.logCoinChange()` (from SPEC-B3-2)

**Implementation Steps:**
1. All coin change UI components call `logCoinChange(characterId, delta)` on each tap
2. `useSessionLogger` debounces over 3–5 second window (agent chooses; adjustable)
3. On flush: writes `"{CharacterName} gained/lost {net} gold [silver] [copper]"` as a single log entry
4. On session end (via `CampaignContext.endSession()`): flush any pending coin events immediately

**Acceptance Criteria:**
- [ ] B4-2-AC1: Tapping gold up 10 times rapidly produces a single session log entry with the net change
- [ ] B4-2-AC2: Ending a session while coins are buffered flushes the buffer before session closes

---

### SPEC-B5-1 — Export Permission Fix (Issue 17)

**Intent:** Fix `NotAllowedError` on export. The issue is `navigator.share()` called outside a synchronous click handler. Switch to Blob + `<a download>` as the reliable fallback.

**Key Files:**
- `src/features/export/useExportActions.ts` — trace `exportSessionMarkdown` and `exportSessionBundle`

**Implementation Steps:**
1. Read `useExportActions.ts`; trace the full call chain for both export functions
2. Identify where `navigator.share()` is called relative to the click handler (async gap = permission denied)
3. Fix option A: ensure `navigator.share()` is in the synchronous microtask of the click handler
4. Fix option B (recommended): use `navigator.canShare()` check first; if false or if share throws `NotAllowedError`, fall back to `URL.createObjectURL` + `<a download>` (no permission required, works reliably in PWA)
5. Apply the same fix to both `exportSessionMarkdown` (.md download) and `exportSessionBundle` (.zip download)

**Acceptance Criteria:**
- [ ] B5-1-AC1: `exportSessionMarkdown` produces a downloaded `.md` file without errors
- [ ] B5-1-AC2: `exportSessionBundle` produces a downloaded `.zip` file without errors
- [ ] B5-1-AC3: Export works in Chrome and Edge (primary PWA targets) without permission prompts
- [ ] B5-1-AC4: `navigator.canShare()` is checked before attempting share; Blob download fallback is in place

---

## Cross-Cutting Acceptance Criteria

- [ ] CROSS-AC1: `tsc --noEmit` passes after each batch
- [ ] CROSS-AC2: No new npm dependencies are added without human approval
- [ ] CROSS-AC3: No Dexie schema version bump without human approval
- [ ] CROSS-AC4: All existing notes, sessions, campaigns, and characters remain accessible after each batch
- [ ] CROSS-AC5: All CSS uses `var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)` — no hardcoded colors
- [ ] CROSS-AC6: All touch targets are minimum 44px (`var(--touch-target-min)`)
- [ ] CROSS-AC7: A clean git commit is made after each batch completes

---

## Escalation Triggers

Pause and request human input if:
- Any batch requires a new npm dependency
- A Dexie schema version change is needed (new table or index)
- Route structure changes exceed what is specified here
- A file being modified is >500 lines and changes risk breaking existing behavior
- Existing E2E tests fail after changes
- Acceptance criteria appear wrong or contradictory
- The Link Note entity link migration decision is needed before proceeding with SPEC-B2-6

---

## Open Questions (Pending Human Approval)

| # | Question | Default if Not Answered |
|---|----------|------------------------|
| OQ-1 | Bottom nav icon for Reference tab | Book icon from existing icon set |
| OQ-2 | FAB icon and positioning (lower-left recommended) | Lower-left, dice icon |
| OQ-3 | Rest action placement on Sheet (collapsible section recommended) | Collapsible "Rest" section above HP/WP |
| OQ-4 | Full Note Editor route path | `/note/:id/edit` and `/note/new` |
| OQ-5 | What to do with existing Link Note entity links | Leave as orphaned data (do not delete or migrate) |

---

## Execution Order

```
Batch 1 ──► Batch 2 ──► Batch 3 ──► Batch 4 ──► Batch 5
  B1-1          B2-3*        B3-2†         B4-1         B5-1
  B1-2          B2-4         B3-1          B4-2‡
  B1-3          B2-5         B3-3
  B1-4          B2-1
                B2-2
                B2-6

* B2-3 (Tiptap fix) first within Batch 2 — canary for Tiptap/React 19
† B3-2 (useSessionLogger) before B3-3 and B4-2
‡ B4-2 depends on B3-2 (useSessionLogger.logCoinChange)
```

---

*Spec generated by forge agent — 2026-03-31T17-56-22*
