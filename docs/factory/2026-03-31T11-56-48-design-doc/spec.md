# Forge Spec — Unified Production Readiness: Optimization Backlog + Descriptors Feature

**Run:** 2026-03-31T11-56-48-design-doc
**Phase:** forge
**Branch:** 2026/03/31-0123-caleb-feat-2026-03-30-scaldbok-integration-design
**Author:** Caleb Bennett
**Date:** 2026-03-31
**Score:** 94 / 100

---

## Intent Hierarchy

```
MISSION
└── Deliver a production-grade Dragonbane companion app usable during a real
    gaming session on a mobile phone (360px+ viewport).

    STRATEGIC INTENT
    └── Implement all 12 backlog items across three tiers, verified by a
        Playwright E2E suite (10/10 iterations) after each tier.

        OPERATIONAL INTENT
        ├── Tier 1: Eliminate session blockers that would interrupt or confuse gameplay.
        ├── Tier 2: Ship the #descriptor feature and key UX improvements.
        └── Tier 3: Apply polish that improves the app without blocking gameplay.

            TACTICAL INTENT (per item)
            ├── Read affected files → implement → tsc -b → spot-check → commit.
            └── After each tier: E2E 10×, fix regressions, re-run until 10/10.
```

---

## Scoring Breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Completeness of spec coverage | 20 | 19 | All 12 items specified with files, AC, and edge cases |
| Clarity of acceptance criteria | 20 | 19 | Per-item AC defined; E2E gate criteria explicit |
| Risk identification | 15 | 14 | TipTap API conflict, IndexedDB quota, slow autocomplete addressed |
| Constraint fidelity | 15 | 14 | All commander's intent constraints captured and propagated |
| Dependency awareness | 10 | 9 | TipTap version pinning noted; no new deps constraint clear |
| Decision authority clarity | 10 | 10 | Autonomous vs. recommend vs. human tiers fully specified |
| Execution guidance | 10 | 9 | Inner/outer loops, signals, shortcuts all present |
| **Total** | **100** | **94** | |

---

## Constraints (Hard — Never Violate)

1. **NO Dexie schema version bump or structural changes** — no migrations.
2. **NO breaking changes to existing note body JSON format** — all existing notes must render.
3. **NO PWA / service worker regressions** — offline behavior preserved.
4. **NO new npm dependencies** beyond what is already in `package.json` and the descriptors plan.
5. **USE inline styles with `var(--color-*)` CSS custom properties** — no CSS modules, no Tailwind, no raw hex/rgb.
6. **MAINTAIN 44×44px minimum touch targets** on all interactive elements.
7. **SUPPORT mobile viewports down to 360px width**.
8. **PRESERVE all existing component prop interfaces** unless a specific item explicitly requires changes.

---

## Freedoms (Agent Decides Autonomously)

- File and folder structure for new files (`features/notes/`, `utils/notes/`)
- Internal component implementation details and variable naming
- CSS custom property usage and inline style patterns
- Test case design and E2E test structure
- Error message wording in toasts
- Descriptor starter seed word list contents
- Commit message wording and granularity
- Order of items within a tier (may reorder for efficiency)

---

## Tier Gate Protocol

After every tier:
1. Run full Playwright E2E suite **10 iterations**.
2. **Required pass rate: 10 / 10** — no exceptions.
3. Fix all regressions before advancing to the next tier.
4. Record zero unhandled browser console errors during E2E runs.

---

## Sub-Specs

---

### TIER 1 — Session Blockers

#### Item 1 — SessionQuickActions Overlay Blocks CombatTimeline

**Score: 10 / 10**

**Intent:** When `showCombatView` is true, combat owns the session screen. The Quick Log chip row must collapse so it does not overlap the combat timeline.

**Files:**
- `src/screens/SessionScreen.tsx`

**Implementation:**
- Read the `showCombatView` boolean from context/state.
- Wrap the Quick Log chip row in a conditional: render only when `showCombatView === false`.
- Ensure the chip row re-appears when combat ends (i.e., `showCombatView` returns to `false`).
- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for any chip UI.

**Acceptance Criteria:**
- [ ] AC1.1 — When `showCombatView` is `true`, the Quick Log chip row is not present in the DOM.
- [ ] AC1.2 — When `showCombatView` is `false`, the Quick Log chip row renders normally.
- [ ] AC1.3 — Transitioning from combat back to non-combat re-renders the chip row without page refresh.
- [ ] AC1.4 — No layout overflow or z-index clash between chip row and `CombatTimeline` at 360px viewport.
- [ ] AC1.5 — `tsc -b` reports zero new type errors after this change.

**Edge Cases:**
- Quick Log drawer that is open when combat starts: auto-close the drawer before hiding the chip row.

---

#### Item 2 — PartyPicker "Who?" Selection

**Score: 10 / 10**

**Intent:** The "Who?" section of the PartyPicker drawer must be sticky at the top, pre-select the active character, and have correctly sized touch targets on mobile.

**Files:**
- `src/features/session/SessionQuickActions.tsx`

**Implementation:**
- Make the "Who?" section sticky (`position: sticky; top: 0`) inside the drawer scroll container.
- Pre-select the active character member on drawer open.
- Audit all touch targets inside the drawer against 44×44px minimum; fix any violations with `minHeight`/`minWidth` inline styles using `var(--spacing-*)` or explicit pixel values.

**Acceptance Criteria:**
- [ ] AC2.1 — "Who?" section remains visible when scrolling the PartyPicker drawer on a 360px viewport.
- [ ] AC2.2 — Active character is pre-selected when the drawer opens.
- [ ] AC2.3 — Every tappable element in the drawer meets 44×44px minimum touch target.
- [ ] AC2.4 — No data model changes introduced.
- [ ] AC2.5 — `tsc -b` reports zero new type errors after this change.

**Edge Cases:**
- 0 party members: fall back to `__self__` (active character only).
- Duplicate names: append a subtle index suffix for disambiguation.

---

#### Item 3 — Character Creation — No Auto-Activate (Except First)

**Score: 10 / 10**

**Intent:** The first character created should automatically become the active character. All subsequent characters should trigger a toast with a "Set Active?" action button instead of auto-activating.

**Files:**
- `src/features/character/useCharacterActions.ts`
- `src/screens/CharacterLibraryScreen.tsx`

**Implementation:**
- After `createCharacter()` succeeds, check if `activeCharacterId` is currently unset (no active character).
  - If unset: call `updateSettings({ activeCharacterId: newCharacter.id })` automatically.
  - If already set: call `useToast()` to show a toast: `"Character created — Set Active?"` with an action button that calls `updateSettings({ activeCharacterId: newCharacter.id })`.
- Use `useToast()` from `context/ToastContext` for all notifications.
- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` for IDs and timestamps.

**Acceptance Criteria:**
- [ ] AC3.1 — Creating the very first character sets it as active immediately with no toast.
- [ ] AC3.2 — Creating a second (or later) character shows a toast with a "Set Active?" action button.
- [ ] AC3.3 — Tapping "Set Active?" in the toast updates `activeCharacterId` to the new character.
- [ ] AC3.4 — Creation failures do not modify `activeCharacterId`.
- [ ] AC3.5 — `tsc -b` reports zero new type errors after this change.

**Edge Cases:**
- If creation fails mid-flow: no settings write occurs.
- Toast dismissal without action: `activeCharacterId` remains unchanged.

---

#### Item 4 — Party Members Show "New Adventurer" — Require Real Name

**Score: 9 / 10**

**Intent:** Characters must receive a real name at creation time. An inline rename prompt must appear during creation, and saving must be blocked until the name is non-empty.

**Files:**
- `src/screens/CharacterLibraryScreen.tsx`
- `src/features/character/useCharacterActions.ts`

**Implementation:**
- Add an inline rename prompt (text input) in the creation flow before the character is persisted.
- Disable the save/confirm button when the name input is empty or whitespace-only.
- On cancel: fall back to `"New Adventurer"` only if user explicitly cancels (not on dismiss).
- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates`.

**Acceptance Criteria:**
- [ ] AC4.1 — The creation flow presents a name input field before saving.
- [ ] AC4.2 — The save button is disabled when the name field is empty or whitespace-only.
- [ ] AC4.3 — Submitting a valid name persists the character with that name (not "New Adventurer").
- [ ] AC4.4 — Canceling the rename falls back to `"New Adventurer"` (no data corruption).
- [ ] AC4.5 — Existing characters named "New Adventurer" are not affected.
- [ ] AC4.6 — `tsc -b` reports zero new type errors after this change.

**Edge Cases:**
- Name with only whitespace: trimmed to empty, treated as invalid.
- Cancel vs. dismiss: both acceptable, both fall back gracefully.

---

### TIER 2 — Features + Key UX

#### Item 5 — Inline `#descriptor` Chips

**Score: 10 / 10**  *(highest complexity; most detailed sub-spec)*

**Intent:** Users can type `#word` in the TipTap editor to create a descriptor chip. Descriptors are persisted in the existing ProseMirror JSON body, extracted for display and search, and autocompleted from campaign notes with frequency weighting.

**Files (new):**
- `src/utils/notes/extractDescriptors.ts`
- `src/features/notes/useDescriptorSuggestions.ts`

**Files (modified):**
- `src/features/notes/TiptapNoteEditor.tsx`
- `src/features/notes/NoteItem.tsx`
- `src/features/notes/useNoteSearch.ts`
- `src/features/notes/descriptorMentionExtension.ts` *(new file, registered as modified since it extends existing TipTap setup)*

**Architecture:**

```
User types #word in TipTap editor
  → descriptorMentionExtension (Mention.extend({ name: 'descriptorMention' }))
      intercepts # trigger
  → Dropdown shows campaign-weighted autocomplete suggestions
      (useDescriptorSuggestions → frequency map from campaign notes)
  → User selects or completes → ProseMirror node:
      { type: 'descriptorMention', attrs: { kind: 'descriptor', label: 'word' } }
  → On save: body JSON persisted to Dexie as-is (no schema change)
  → On render (NoteItem): extractDescriptors(body) → chip row display
  → On search index: extractDescriptors(body) → MiniSearch 'descriptors' field
```

**TipTap Extension Constraint:**
- TipTap's Mention extension uses a single `suggestion` config per instance.
- **MUST** use `Mention.extend({ name: 'descriptorMention' })` to create a separate extension for `#` trigger.
- **MUST NOT** attempt a plural `suggestions` array on a single Mention instance.
- Verify against actual TipTap source (`^2.11.7`) before writing implementation code.
- If `Mention.extend()` approach fails: **escalate before falling back to any alternative**.

**Implementation Notes:**
- `extractDescriptors(body)`: model on `extractText()` from `utils/prosemirror`. Traverse ProseMirror JSON, collect all nodes where `type === 'descriptorMention'`, return `node.attrs.label[]`. Return `[]` for null/malformed bodies — never throw.
- `useDescriptorSuggestions`: build frequency map on mount by scanning all campaign notes' descriptor arrays. Cache in-memory. Append on save. Return ranked suggestions for current `#` query.
- `NoteItem`: render descriptor chips below note body. Use existing `chipStyle` pattern.
- `useNoteSearch`: add `'descriptors'` field to MiniSearch index. Follow existing `useNoteSearch.ts` patterns.
- Descriptor export: include in YAML frontmatter as `descriptors: [word1, word2]`.

**Acceptance Criteria:**
- [ ] AC5.1 — Typing `#` in the TipTap editor opens an autocomplete dropdown.
- [ ] AC5.2 — Completing a descriptor creates an inline chip node in the editor.
- [ ] AC5.3 — The ProseMirror JSON for a descriptor node has `type: 'descriptorMention'` and `attrs.label`.
- [ ] AC5.4 — Saving a note with descriptors persists the body JSON unchanged to Dexie (no schema version bump).
- [ ] AC5.5 — `extractDescriptors(body)` returns the correct labels array for a note with descriptors.
- [ ] AC5.6 — `extractDescriptors(null)` and `extractDescriptors({})` both return `[]` without throwing.
- [ ] AC5.7 — All existing notes (without descriptors) render correctly after this change.
- [ ] AC5.8 — NoteItem displays descriptor chips for notes that have descriptors.
- [ ] AC5.9 — MiniSearch indexes descriptors; searching for a descriptor word returns matching notes.
- [ ] AC5.10 — Autocomplete suggestions are frequency-ranked from campaign notes.
- [ ] AC5.11 — `#` without completion stays as plain text (no stray node created).
- [ ] AC5.12 — Both `@mention` and `#descriptor` triggers work simultaneously in the same editor instance.
- [ ] AC5.13 — `tsc -b` reports zero new type errors after this change.
- [ ] AC5.14 — `vite build` succeeds after this change.

**Edge Cases:**
- `#` without completion → plain text, no node.
- Null or malformed body → `extractDescriptors` returns `[]`.
- JSON format changes handled gracefully (no throw).
- Frequency map built once on mount; appended on save for performance.

**Escalate When:**
- `Mention.extend()` API does not work as described — escalate before any alternative.

---

#### Item 6 — Link Note — Hide When No Active Session

**Score: 10 / 10**

**Intent:** The "Link Note" button in `NotesScreen` is only meaningful when an active session exists. Render it conditionally and show a muted explanation when no session is active.

**Files:**
- `src/screens/NotesScreen.tsx`

**Implementation:**
- Read `activeSession` from context.
- Conditionally render the "Link Note" button only when `activeSession` is truthy.
- When `activeSession` is falsy, render muted explanation text (e.g., `"Start a session to link notes"`).

**Acceptance Criteria:**
- [ ] AC6.1 — "Link Note" button is absent from the DOM when no active session exists.
- [ ] AC6.2 — "Link Note" button is present and functional when an active session exists.
- [ ] AC6.3 — Muted explanation text is visible when no active session exists.
- [ ] AC6.4 — Drawer closes gracefully if session ends while the link-note drawer is open.
- [ ] AC6.5 — `tsc -b` reports zero new type errors after this change.

---

#### Item 7 — Touch Target Audit

**Score: 9 / 10**

**Intent:** Every interactive element in the app meets the 44×44px minimum touch target requirement, ensuring usability on mobile touch screens.

**Files:** Multiple — scan-driven (NoteItem action menu, drawer buttons, chip sizes are known violators).

**Implementation:**
- Audit all interactive elements (`button`, `[role="button"]`, clickable chips, drawer controls).
- For each violation: add `minHeight: 44` and `minWidth: 44` (or equivalent) via inline styles using `var(--spacing-*)` or explicit pixel values.
- Known areas: NoteItem action menu buttons, drawer open/close buttons, chip elements in `SessionQuickActions`.

**Acceptance Criteria:**
- [ ] AC7.1 — All `button` and `[role="button"]` elements have a rendered hit area ≥ 44×44px on a 360px viewport.
- [ ] AC7.2 — NoteItem action menu buttons meet the 44×44px minimum.
- [ ] AC7.3 — Drawer open/close controls meet the 44×44px minimum.
- [ ] AC7.4 — Chip elements in `SessionQuickActions` meet the 44×44px minimum.
- [ ] AC7.5 — No existing layouts overflow or collapse at 360px after touch target fixes.
- [ ] AC7.6 — `tsc -b` reports zero new type errors after this change.

---

#### Item 8 — Combat Event Form Auto-Fill

**Score: 9 / 10**

**Intent:** Reduce friction when logging combat events by pre-filling the "Actor" field with the active character name and pre-filling "Label" based on the selected event type.

**Files:**
- `src/features/combat/CombatTimeline.tsx`

**Implementation:**
- Read active character name from `ActiveCharacterContext`.
- On form mount / event type change: set default value of "Actor" field to active character name.
- Pre-fill "Label" with a sensible default derived from the event type (e.g., `"Attack"`, `"Defend"`, `"Damage"`).
- All pre-fills are overridable by the user.

**Acceptance Criteria:**
- [ ] AC8.1 — "Actor" field is pre-filled with the active character's name when the combat event form opens.
- [ ] AC8.2 — "Label" field is pre-filled based on the selected event type.
- [ ] AC8.3 — User can override both pre-filled values before submitting.
- [ ] AC8.4 — Submitting the form persists the user's entered values (not the defaults if overridden).
- [ ] AC8.5 — `tsc -b` reports zero new type errors after this change.

---

### TIER 3 — Polish

#### Item 9 — Session Timer Granularity

**Score: 10 / 10**

**Intent:** The session timer should update every 10 seconds instead of every 30 seconds for more accurate elapsed time display.

**Files:**
- `src/screens/SessionScreen.tsx`

**Implementation:**
- Locate the timer interval (`setInterval` or equivalent).
- Change interval from `30000` ms to `10000` ms.

**Acceptance Criteria:**
- [ ] AC9.1 — Session timer interval is 10 seconds (10 000 ms).
- [ ] AC9.2 — Timer display updates visibly within 10 seconds of session state changes.
- [ ] AC9.3 — No memory leak introduced (interval is properly cleared on unmount).
- [ ] AC9.4 — `tsc -b` reports zero new type errors after this change.

---

#### Item 10 — Character Sub-Nav Active Detection

**Score: 10 / 10**

**Intent:** The active state detection in `CharacterSubNav` should use `startsWith` matching so that nested routes are correctly highlighted.

**Files:**
- `src/features/character/CharacterSubNav.tsx`

**Implementation:**
- Replace exact `===` path comparison with `pathname.startsWith(navItem.path)`.

**Acceptance Criteria:**
- [ ] AC10.1 — Active sub-nav item is highlighted correctly when on a nested route under a nav item's path.
- [ ] AC10.2 — No false-positive active states (e.g., `/` matching all routes).
- [ ] AC10.3 — `tsc -b` reports zero new type errors after this change.

---

#### Item 11 — Console Warning Cleanup

**Score: 10 / 10**

**Intent:** Verify that the navigate-during-render fix (committed in `75f5130`) has eliminated all React/router console warnings. This is a verification-only item — no code changes expected unless warnings persist.

**Files:** Verification only (no planned code changes).

**Implementation:**
- Run the full E2E suite and inspect browser console output.
- Run a manual session in the browser at 360px viewport and check the console.
- If warnings persist: identify source and fix; escalate if root cause is unclear.

**Acceptance Criteria:**
- [ ] AC11.1 — Zero `Warning: Cannot update a component` (navigate-during-render) messages in E2E console output.
- [ ] AC11.2 — Zero unhandled React errors or warnings during a full manual session walkthrough.
- [ ] AC11.3 — If new warnings are found, they are addressed before this item is marked complete.

---

#### Item 12 — E2E Test Hardening

**Score: 9 / 10**

**Intent:** Improve the robustness of the E2E test suite by fixing the character rename flow, and adding tests for descriptor chips and PartyPicker interactions.

**Files:**
- `tests/e2e_full_test.py`

**Implementation:**
- Fix flaky character rename flow test (use stable selectors; await proper DOM state).
- Add test cases for `#descriptor` chip creation and rendering (Item 5).
- Add test cases for PartyPicker "Who?" selection and sticky header behavior (Item 2).
- All new tests must pass 10/10 iterations.

**Acceptance Criteria:**
- [ ] AC12.1 — Character rename flow test passes reliably (10/10 iterations, no flakiness).
- [ ] AC12.2 — At least one test verifies `#descriptor` chip creation in the TipTap editor.
- [ ] AC12.3 — At least one test verifies descriptor chips render on `NoteItem`.
- [ ] AC12.4 — At least one test verifies PartyPicker "Who?" sticky section and pre-selection.
- [ ] AC12.5 — Full E2E suite passes 10/10 iterations after all additions.

---

## Execution Protocol

### Inner Loop (per item)

1. Read the item spec and all listed affected files.
2. Implement the change per the sub-spec above.
3. Run `tsc -b` — fix all type errors before moving on.
4. Spot-check in browser at 360px viewport.
5. Commit with a descriptive message (item number + summary).
6. Move to next item.

### Outer Loop (per tier)

1. Complete all items in the tier.
2. Run full E2E suite × 10 iterations.
3. Fix all regressions (repeat inner loop).
4. Re-run E2E until 10 / 10.
5. Run `vite build` — confirm successful production build.
6. Proceed to next tier.

### Build Signals

| Signal | Requirement |
|--------|-------------|
| `tsc -b` | Zero type errors after each item |
| `vite build` | Successful production build after each tier |
| E2E suite (×10) | 10/10 pass rate at each tier gate |
| Browser console | Zero unhandled errors during manual spot-checks |
| Mobile viewport (360px) | No overflow or collapse |

---

## Escalation Triggers

Escalate to human **before proceeding** when:

1. Any item requires modifying a file not listed in its Files column.
2. The `Mention.extend()` approach for `#` descriptor triggers does not work — do not fall back to alternatives without approval.
3. E2E pass rate drops below 10/10 after a tier gate — do not proceed to next tier.
4. A fix in one item breaks an unrelated feature (regression).
5. Any new npm dependency would be required.
6. A prop interface change is needed on `NoteItem`, `TiptapNoteEditor`, or `SessionQuickActions`.

---

## Shortcuts (Apply Without Deliberation)

- Use `useToast()` from `context/ToastContext` for all user notifications.
- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for any new chip UI.
- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` for IDs and timestamps.
- Use existing `Drawer` component from `components/primitives/Drawer` for any drawer UI.
- Use `getById()` / `save()` from the appropriate repository — no raw Dexie queries.
- Model `extractDescriptors()` on `extractText()` from `utils/prosemirror`.
- Follow existing `useNoteSearch.ts` patterns for MiniSearch index modifications.
- Commit after each completed item for bisectability.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| TipTap Mention API mismatch (`suggestions` vs. `Mention.extend()`) | High | High | Use `Mention.extend({ name: 'descriptorMention' })`. Verify against TipTap source before writing code. Escalate if blocked. |
| IndexedDB quota exceeded during heavy session use | Low | Medium | Add global Dexie error handler with storage-full toast. |
| Autocomplete slow on large campaigns | Medium | Low | Build frequency map once on mount, cache in-memory, append on save. |
| Touch target fixes introduce layout overflow at 360px | Low | Medium | Spot-check every fix at 360px before committing. |
| E2E regression from Item 5 TipTap changes | Medium | Medium | Run E2E after Item 5 before proceeding to Item 6. |

---

## Decision Authority Summary

| Decision | Authority |
|----------|-----------|
| File/folder structure for new files | Agent |
| Internal variable/function naming | Agent |
| CSS custom property usage | Agent |
| Test case design | Agent |
| Toast wording | Agent |
| Descriptor seed word list | Agent |
| Commit message wording | Agent |
| Item order within a tier | Agent |
| Deviation from descriptors Option D approach | Agent recommends → Human approves |
| Changes to `NoteItem`, `TiptapNoteEditor`, `SessionQuickActions` prop interfaces | Agent recommends → Human approves |
| MiniSearch structural changes beyond `descriptors` field | Agent recommends → Human approves |
| Item significantly more complex than described | Agent recommends → Human approves |
| Scope changes (add/remove items) | Human |
| Ship after Tier 1 vs. continue | Human |
| New UX interaction patterns | Human |
| New npm dependencies | Human |

---

## Acceptance Criteria Summary (All Tiers)

| Item | AC Count | Tier |
|------|----------|------|
| 1 — Overlay fix | 5 | 1 |
| 2 — PartyPicker | 5 | 1 |
| 3 — Auto-activate | 5 | 1 |
| 4 — Party naming | 6 | 1 |
| 5 — Descriptors | 14 | 2 |
| 6 — Link Note | 5 | 2 |
| 7 — Touch audit | 6 | 2 |
| 8 — Combat auto-fill | 5 | 2 |
| 9 — Timer | 4 | 3 |
| 10 — Sub-nav | 3 | 3 |
| 11 — Console | 3 | 3 |
| 12 — E2E hardening | 5 | 3 |
| **Total** | **66** | |

**Tier gate AC (shared):**
- [ ] TG1 — E2E suite passes 10/10 after Tier 1.
- [ ] TG2 — E2E suite passes 10/10 after Tier 2; `vite build` succeeds.
- [ ] TG3 — E2E suite passes 10/10 after Tier 3; `vite build` succeeds; zero console errors.

---

## Commander's Intent (Restated)

**End State:** All 12 backlog items implemented and verified. E2E suite passes 10/10 after each tier. Zero unhandled console errors. All interactive elements ≥ 44×44px. `#descriptor` chips work inline in TipTap with campaign-weighted autocomplete. The app is fully usable for a real Dragonbane gaming session on a 360px+ mobile viewport.

**Purpose:** Make Skaldbok session-ready — a GM or player can open the app on their phone during a Dragonbane session and use every feature (combat, notes, quick actions, character management) without encountering bugs, layout issues, or missing functionality that breaks game flow.
