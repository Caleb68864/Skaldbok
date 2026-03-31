---
date: 2026-03-31
topic: "Unified Production Readiness — Optimization Backlog + Descriptors Feature"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-03-31
tags:
  - design
  - production-readiness
  - optimization
  - descriptors
---

# Unified Production Readiness — Design

## Summary

A priority-ordered, three-tier work plan that merges the 10 optimization items discovered during E2E testing with the inline `#descriptor` chip feature into a single unified backlog. Each tier is gated by a full Playwright E2E verification pass (10 iterations). The goal is a production-grade Dragonbane companion app where every feature works reliably on mobile touch screens.

## Approach Selected

**Interleaved by Priority (Unified Backlog)** — all items ranked by real-session impact regardless of whether each is a bug fix, UX improvement, or new feature. This avoids artificial phase boundaries and ensures the highest-impact work ships first.

## Architecture

Three tiers, ordered by session impact, with verification gates between each:

```
┌─────────────────────────────────────────────────────┐
│              UNIFIED PRODUCTION BACKLOG              │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ TIER 1  │→ │ TIER 2  │→ │ TIER 3  │             │
│  │ Blockers│  │ Features│  │ Polish  │             │
│  └────┬────┘  └────┬────┘  └────┬────┘             │
│       │             │            │                   │
│  Overlay fix   Descriptors  Session timer           │
│  PartyPicker   Link Note UX Sub-nav active          │
│  Char create   Touch audit  Combat autofill         │
│  Party naming  Search boost Console warnings        │
│                                                     │
│  ───────── After each tier ─────────                │
│  Run E2E suite (10 iterations) → fix regressions    │
└─────────────────────────────────────────────────────┘
```

- **Tier 1 (Blockers):** Things that would interrupt or confuse a real gaming session.
- **Tier 2 (Features + Key UX):** Descriptors feature plus UX improvements that make the app genuinely useful at the table.
- **Tier 3 (Polish):** Nice-to-haves that improve the app but don't block gameplay.

## Components

### TIER 1 — Session Blockers (4 items)

| # | Item | What to Do | Files |
|---|------|------------|-------|
| 1 | **SessionQuickActions overlay blocks CombatTimeline** | When `showCombatView` is true, collapse/hide the Quick Log chip row. Combat owns the session screen while active. | `SessionScreen.tsx` |
| 2 | **PartyPicker "who" selection** | Make "Who?" section sticky at top of drawer. Verify touch targets on mobile viewports. Pre-select active character member. | `SessionQuickActions.tsx` |
| 3 | **Character creation — no auto-activate** | After `createCharacter()`, auto-set as active if first character. Show toast with "Set Active?" for subsequent characters. | `useCharacterActions.ts`, `CharacterLibraryScreen.tsx` |
| 4 | **Party members all show "New Adventurer"** | Add inline rename prompt during creation. Require non-empty name before saving. | `CharacterLibraryScreen.tsx`, `useCharacterActions.ts` |

### TIER 2 — Features + Key UX (4 items)

| # | Item | What to Do | Files |
|---|------|------------|-------|
| 5 | **Inline `#descriptor` chips** | Full implementation per quick-descriptors plan: extend TipTap Mention with `#` trigger, descriptor renderer, campaign-weighted autocomplete, extraction utility, search indexing, NoteItem display. **Note:** TipTap's Mention extension uses a single `suggestion` config per instance. Use `Mention.extend({ name: 'descriptorMention' })` to create a second extension instance for the `#` trigger — do not attempt a plural `suggestions` array on a single Mention instance. | 6 files (2 new, 4 modified) |
| 6 | **Link Note — hide when no session** | Conditionally render "Link Note" button only when `activeSession` exists. Show muted explanation text otherwise. | `NotesScreen.tsx` |
| 7 | **Touch target audit** | Audit all interactive elements for 44x44px minimum. Fix NoteItem action menu, drawer buttons, chip sizes. | Multiple — scan-driven |
| 8 | **Combat event form auto-fill** | Pre-fill "Actor" with active character name. Pre-fill "Label" based on event type. | `CombatTimeline.tsx` |

### TIER 3 — Polish (4 items)

| # | Item | What to Do | Files |
|---|------|------------|-------|
| 9 | **Session timer granularity** | Change interval from 30s to 10s. | `SessionScreen.tsx` |
| 10 | **Character sub-nav active detection** | Use `startsWith` matching instead of exact `===`. | `CharacterSubNav.tsx` |
| 11 | **Console warning cleanup** | Verify navigate-during-render fix eliminated warnings. Check E2E logs. | Verification only |
| 12 | **E2E test hardening** | Improve character rename flow, add descriptor tests, add PartyPicker interaction tests. | `tests/e2e_full_test.py` |

## Data Flow

### Tier 1 — Minimal data changes

- **#1 (Overlay):** Pure UI. `showCombatView` boolean controls chip visibility.
- **#2 (PartyPicker):** No data change. Fix is rendering + touch behavior.
- **#3 (Auto-activate):** Adds one write: `updateSettings({ activeCharacterId })` after creation.
- **#4 (Naming):** Character gets real name at creation time instead of "New Adventurer".

### Tier 2 — Descriptors is the big change

```
User types #word in TipTap editor
  → Mention extension (# trigger) creates inline node
  → ProseMirror JSON body: { type: 'mention', attrs: { kind: 'descriptor', label: 'word' } }
  → On save: body persisted to Dexie as-is (no schema change)
  → On render: extractDescriptors(body) → chips on NoteItem
  → On search: extractDescriptors(body) → MiniSearch 'descriptors' field
  → Autocomplete: useDescriptorSuggestions scans campaign notes → frequency map → ranked suggestions
```

All other Tier 2 items are zero data-change (conditional rendering, CSS fixes, pre-fill from existing state).

### Tier 3 — Zero data changes

Timer interval, CSS matching, verification, test code.

## Error Handling

### Tier 1 Edge Cases

- **Overlay:** Quick Log drawer auto-closes when combat starts. Chips reappear when combat ends.
- **PartyPicker:** 0 members → fallback to `__self__`. Duplicate names → append subtle index.
- **Auto-activate:** Only auto-activate first character. 2nd+ shows toast with action button. Creation failures don't update activeCharacterId.
- **Naming:** Empty name disables save. Cancel falls back to "New Adventurer".

### Tier 2 Edge Cases

- **Descriptors:** `#` without completion stays as plain text. Null bodies return `[]`. JSON format changes handled gracefully (no throw).
- **Link Note:** Drawer closes if session ends while open.

### Failure Modes

1. **IndexedDB quota exceeded:** Add global Dexie error handler with storage-full toast.
2. **TipTap extension conflict:** Pin TipTap version, add smoke test for both `@` and `#` triggers.
3. **Slow autocomplete on large campaigns:** Build frequency map once on mount, cache in-memory, append on save.

## Resolved Questions

1. **Auto-activate for non-first characters:** Toast with "Set Active?" action. Auto-activate only the first character; subsequent characters show a toast with an action button.
2. **Descriptor chip click behavior in read-only view:** Nothing — chips are display-only for this scope. Search-on-click is a future enhancement.
3. **Descriptors in export:** Include in YAML frontmatter of exported notes as `descriptors: [word1, word2]`.
4. **E2E as CI gate:** Out of scope. Manual E2E runs only for this work.

## Approaches Considered

### Approach A: Polish-First, Features-Second
Fix all 10 optimization items first, then build descriptors. **Not selected** because it causes NoteItem rework (timestamps now, descriptors later) and delays the most exciting feature without material benefit.

### Approach B: Interleaved by Priority (Selected)
Unified backlog ordered by real-session impact. **Selected** because it delivers the best app at every stopping point, avoids rework, and respects the fact that some fixes outrank features and vice versa.

### Approach C: Feature-First, Harden After
Build descriptors immediately, polish later. **Not selected** because known UX blockers (overlay conflicts, PartyPicker) would frustrate development and testing of the descriptor feature itself.

## Commander's Intent

**Desired End State:** All 12 backlog items implemented and verified. E2E suite passes 10/10 iterations after each tier with zero failures. Zero unhandled console errors during E2E runs. All interactive elements meet 44x44px minimum touch targets. Descriptor `#` chips work inline in the TipTap editor with campaign-weighted autocomplete. The app is usable for a real Dragonbane gaming session on a mobile phone (360px+ viewport).

**Purpose:** Make Skaldbok session-ready — a GM or player can open the app on their phone during a Dragonbane session and use every feature (combat, notes, quick actions, character management) without hitting bugs, layout issues, or missing functionality that breaks flow.

**Constraints:**
- MUST NOT change the Dexie schema version or database structure — no migrations
- MUST NOT break existing note body JSON format — all existing notes must render correctly
- MUST NOT regress PWA offline behavior or service worker functionality
- MUST NOT add npm dependencies beyond what's already in package.json and the descriptors plan
- MUST use inline styles with `var(--color-*)` CSS custom properties — no CSS modules, no Tailwind
- MUST maintain 44x44px minimum touch targets on all interactive elements
- MUST work on mobile viewports down to 360px width
- MUST preserve all existing component prop interfaces unless a specific item requires changes

**Freedoms:**
- MAY restructure internal component logic within a file as needed for a fix
- MAY add new utility functions in `utils/` without approval
- MAY choose internal variable/function naming
- MAY adjust the descriptor starter seed word list
- MAY refactor test structure in `tests/e2e_full_test.py`

## Execution Guidance

**Observe (signals to monitor during implementation):**
- `tsc -b` — zero type errors after each item
- `vite build` — successful production build after each tier
- E2E suite (10 iterations) — 10/10 pass rate required at tier gates
- Browser console — zero unhandled errors during manual spot-checks
- Mobile viewport (360px) — visual check that nothing overflows or collapses

**Orient (codebase context to maintain):**
- All UI uses inline styles with CSS custom properties from `src/theme/` — never raw hex/rgb
- State management via React Context: `AppStateContext`, `ActiveCharacterContext`, `CampaignContext`, `ToastContext`
- Data access via repository pattern: `storage/repositories/*Repository.ts` with `save()`, `getById()`, `remove()`, `getAll()`
- Feature code lives in `features/{domain}/` — hooks, components, drawers grouped by feature
- Screen components in `screens/` — these are route-level pages
- Shared primitives in `components/primitives/` — `Drawer`, `Modal`, `Toast`, `Button`, `Chip`, `Card`
- Field components in `components/fields/` — domain-specific form elements

**Escalate When:**
- Any item requires modifying a file not listed in the plan's file column
- The TipTap `Mention.extend()` approach for `#` triggers doesn't work — escalate before falling back to Option A
- E2E pass rate drops below 10/10 after a tier gate — don't proceed to next tier
- A fix in one item breaks an unrelated feature (regression)
- Any new npm dependency would be required

**Shortcuts (Apply Without Deliberation):**
- Use `useToast()` from `context/ToastContext` for all user notifications (item #3 toast)
- Use existing `chipStyle` pattern from `SessionQuickActions.tsx` for any new chip UI
- Use `generateId()` from `utils/ids` and `nowISO()` from `utils/dates` for IDs and timestamps
- Use existing `Drawer` component from `components/primitives/Drawer` for any drawer UI
- Use `getById()` / `save()` from the appropriate repository — don't write raw Dexie queries
- Use `extractText()` from `utils/prosemirror` as the model for the new `extractDescriptors()` utility
- Follow existing `useNoteSearch.ts` patterns for MiniSearch index modifications
- Commit after each completed item (not just each tier) for bisectability

**Inner Loop (per item):**
1. Read the item spec and affected files
2. Implement the change
3. Run `tsc -b` — fix any type errors
4. Spot-check in browser at 360px viewport
5. Commit with descriptive message
6. Move to next item

**Outer Loop (per tier):**
1. Complete all items in the tier
2. Run full E2E suite (10 iterations)
3. Fix any regressions (repeat inner loop)
4. Re-run E2E until 10/10
5. Proceed to next tier

## Decision Authority

**Agent Decides Autonomously:**
- File and folder structure for new files (`features/notes/`, `utils/notes/`)
- Internal component implementation details and variable naming
- CSS custom property usage and inline style patterns
- Test case design and E2E test structure
- Error message wording in toasts
- Descriptor starter seed word list contents
- Commit message wording and granularity
- Order of items within a tier (may reorder for efficiency)

**Agent Recommends, Human Approves:**
- Any deviation from the descriptors plan's Option D approach
- Changes to existing component prop interfaces (`NoteItem`, `TiptapNoteEditor`, `SessionQuickActions`)
- Structural changes to the MiniSearch index beyond adding `descriptors` field
- Any item that turns out to be significantly more complex than described

**Human Decides:**
- Scope changes (adding or removing items from the backlog)
- Whether to ship after Tier 1 or continue to Tier 2/3
- UX decisions not covered by the plan (new interaction patterns)
- Any new npm dependency

## War-Game Results

**Most Likely Failure:** TipTap Mention extension API mismatch — the descriptors sub-plan shows two contradictory patterns (plural `suggestions` array vs. `Mention.extend()`). Mitigation: use `Mention.extend({ name: 'descriptorMention' })` to create a separate extension instance for `#` triggers. Verify the API against actual TipTap source before writing implementation code.

**Scale Stress:** N/A — single-user offline PWA. Not a concern at current scope.

**Dependency Risk:** TipTap is the critical dependency for the descriptors feature. Version is pinned in package.json (`^2.11.7`). Risk is moderate and mitigated by the version pin plus the smoke test for both `@` and `#` triggers (item #12).

**Maintenance Assessment:** Strong. The tiered structure, per-item file listings, and detailed data flow diagrams make this plan highly readable. The descriptors sub-plan (`quick-descriptors-plan.md`) is exceptionally thorough. A developer unfamiliar with the codebase could understand the design from these documents alone.

## Evaluation Metadata

- Evaluated: 2026-03-31
- Cynefin Domain: Complicated (with Clear elements)
- Critical Gaps Found: 3 (3 resolved)
- Important Gaps Found: 3 (3 resolved)
- Suggestions: 3 (applied)

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-03-31-unified-production-readiness-design.md`)
- [ ] Update E2E test suite to cover each tier's changes
