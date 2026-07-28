---
date: 2026-07-27
status: ready
design_source: docs/plans/2026-07-27-session-log-note-capture-design.md
---

# Session Log — stylus-first note capture

## Meta

- Project: Skaldbok
- Repo: Skaldbok
- Date: 2026-07-27
- Author: Caleb Bennett
- Quality: 33/35 (outcome: 5, scope: 5, decision_guidance: 5, edges: 4, criteria: 4, decomposition: 5, purpose: 5)
- Status: ready
- Design source: `docs/plans/2026-07-27-session-log-note-capture-design.md` (evaluated 2026-07-27)

## Outcome

During a session the user opens one screen, writes, and commits timestamped entries without ever typing a title, choosing a type, or leaving the screen. Committed entries can be edited and deleted. Afterwards, selected entries promote into typed notes or append to existing ones, a link scanner proposes wikilinks and missing NPC records, and the session exports as a single chronological narrative with extracted notes attached.

**Success metric:** capturing a thought during play takes **at most 2 taps** from the session screen (open log → commit), versus today's minimum of 5 (FAB → Note → title → type → save). Any change that raises that count is a regression.

## Intent

**Trade-off hierarchy:**
1. Removing decisions from the moment of writing over feature richness — every choice is judged by "does this remove a decision at the table?"
2. Reusing the existing `Note` infrastructure over purpose-built structures — inherit export, timeline, bundles, soft delete, search
3. Backward compatibility over clean abstractions — existing notes must keep working with zero migration
4. Correctability over capture speed — a fast capture flow that produces uneditable garbage is worthless

**Decision boundaries:**
- Agent decides autonomously: file and folder structure, component and function naming, CSS values, test organisation, fuzzy-match implementation, selection-mode interaction details, internal state shape
- Agent recommends, human approves: any change to `renderNote`/`renderSession` output for existing note types; adding an npm dependency; changing `baseNoteSchema`; altering `notesToTimeline` behaviour for non-log notes
- Human decides: deleting `QuickNoteDrawer`/`QuickNoteAction` outright rather than removing them from the session flow; collapsing `NOTE_TYPES`; changing the AAR export format contract

## Context

Skaldbok is a local-first, offline-capable TTRPG PWA (React 19, TypeScript, Vite, Tailwind v4, Dexie/IndexedDB, TipTap/ProseMirror, Zod). No backend.

**The problem being solved.** In-session note capture is too slow to use at the table, structurally:

- `QuickNoteDrawer` has a body editor but `Save` is disabled until a title is typed, and is capped at `max-w-[480px]`.
- `QuickNoteAction` (FAB → Note) has no body field at all; writing means navigating away to `/note/:id/edit`.

The path with a body demands a title first; the path that doesn't demand a title has nowhere to write.

**Why this is cheap.** The completed `2026-03-30-universal-note-model` spec already established a single `baseNoteSchema` with `type: z.string()` and `typeData: z.unknown().optional()`. Adding a note type is therefore **purely additive — no Dexie version bump, no data migration**.

**Verified during evaluation (do not re-investigate):**
- `generateFilename` already falls back to `note-<idSuffix>.md` for empty titles — no collision risk from titleless entries.
- `extractLinksFromTiptapJSON` extracts wikilinks **by `label`**, so generated `wikiLink` nodes need no resolved `id` for KB sync.
- `resolveWikiLinks` returns `''` for any non-object body — **bodies must be ProseMirror docs, never raw strings**.
- `NotesGrid` renders a filter pill chip **per `NoteType`** plus "All", so adding `'log'` auto-creates a chip unless explicitly excluded.

**Codebase conventions:**
- Repositories: try/catch + Zod `safeParse` on every read, `console.warn` on validation failure, `throw new Error('{repo}.{method} failed: ${e}')`. Use `campaignRepository.ts` as the template — **NOT** `characterRepository.ts`, which is legacy.
- IDs via `generateId()` (`src/utils/ids.ts`); timestamps via `nowISO()` (`src/utils/dates.ts`).
- Reads filter soft-deleted rows via `excludeDeleted` (`src/utils/softDelete.ts`).
- Hooks in `src/features/{domain}/`; utilities in `src/utils/`.
- Tests are colocated `*.test.ts` (e.g. `src/components/timeline/adapters/notesToTimeline.test.ts`). Vitest. 219 tests currently pass.
- `npm run build` is the **only** type-check (`tsc -b` then `vite build`). There is no standalone lint or typecheck script.

## Requirements

1. `NOTE_TYPES` includes `'log'`; no Dexie version bump and no data migration occurs.
2. A `textToDoc()` helper converts plain text to a ProseMirror doc and parses `[[label]]` spans into `wikiLink` atom nodes; a `docToText()` inverse supports editing.
3. A reusable full-screen ruled writing surface exists that any text field can expand into, built on a plain `<textarea>`.
4. A session-scoped log screen captures timestamped entries with no title, type, tags or attach-target, retains focus on commit, and supports editing and soft-deleting committed entries.
5. Opening the log with no active session shows a "Start a session" prompt rather than failing.
6. Selected entries promote to a new typed note, append to an existing note, or receive tags; promoted entries remain in the log linked by a `promoted_into` entity link.
7. A link scanner proposes wikilinks from PC, NPC and note-title dictionaries using exact and fuzzy (edit distance ≤2) matching, and proposes creating records that do not exist; dismissals are remembered.
8. Log entries are excluded from `NotesGrid` chips and the "All" filter behind an opt-in toggle, and excluded from the KB graph.
9. The session export renders log entries as one chronological section inside the session index, not one file per entry.
10. The in-session FAB Note action opens the session log instead of the type-chip form.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. `textToDoc` helper and the `log` note type

- **Scope:** Add `'log'` to `NOTE_TYPES`. Create `textToDoc(text: string)` returning a ProseMirror doc (`doc > paragraph > text`), splitting on blank lines into paragraphs, and parsing `[[label]]` spans into `wikiLink` inline atom nodes with `{ id: null, label }`. Create `docToText(doc: unknown)` as the inverse, rendering `wikiLink` nodes back to `[[label]]`. Both must round-trip.
- **Files (new):**
  - `src/features/notes/textToDoc.ts`
  - `src/features/notes/textToDoc.test.ts`
- **Files (modify):**
  - `src/types/note.ts`
- **Acceptance criteria:**
  - `[MECHANICAL]` `npm test` passes with new tests in `src/features/notes/textToDoc.test.ts`.
  - `[STRUCTURAL]` `src/features/notes/textToDoc.ts` exports `textToDoc(text: string): unknown` and `docToText(doc: unknown): string`.
  - `[BEHAVIORAL]` `docToText(textToDoc('a [[Ostrand]] b'))` returns `'a [[Ostrand]] b'`.
  - `[BEHAVIORAL]` `textToDoc('x')` returns an object whose `type` is `'doc'` — never a string — so `resolveWikiLinks` does not return `''`.
  - `[STRUCTURAL]` `NOTE_TYPES` in `src/types/note.ts` contains `'log'`.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-02
phase: run
depends_on: []
---

### 2. `promoted_into` entity-link relationship type

- **Scope:** Register the new `promoted_into` relationship (`log` note → target note) and document it per project convention. Add a `deleteLinksForNote`-style helper only if one does not already cover it.
- **Files (modify):**
  - `src/storage/repositories/entityLinkRepository.ts`
  - `CLAUDE.md`
  - `AGENTS.md`
- **Acceptance criteria:**
  - `[STRUCTURAL]` The entity-type/relationship comment at the top of `src/storage/repositories/entityLinkRepository.ts` lists `promoted_into`.
  - `[STRUCTURAL]` The Entity Linking relationship table in `CLAUDE.md` has a `promoted_into` row describing `note (log) → note`.
  - `[MECHANICAL]` `grep -c "promoted_into" AGENTS.md` returns a value greater than 0 — `AGENTS.md` is a near-verbatim copy of `CLAUDE.md` and must stay in sync.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-03
phase: run
depends_on: []
---

### 3. `WritePad` reusable ruled writing surface

- **Scope:** A full-screen writing surface any text field can expand into. Plain `<textarea>` only — never `contenteditable`, because Chromium stylus handwriting targets editable text *fields*. Ruled background via `repeating-linear-gradient` with `line-height` matched to the stripe pitch. No `max-w` cap. Commit via an explicit button and `Ctrl`/`Cmd`+`Enter`; a bare `Enter` inserts a newline. Whitespace-only commits are a no-op. The textarea must not blur on commit. **`onCommit` may reject** — if it throws or rejects, retain the text in the textarea and surface a toast rather than clearing.
- **Files (new):**
  - `src/components/notes/WritePad.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/components/notes/WritePad.tsx` exports a `WritePad` component accepting at minimum `value`, `onChange`, `onCommit`, `open` and `onClose` props.
  - `[MECHANICAL]` `grep -c "contenteditable" src/components/notes/WritePad.tsx` returns 0.
  - `[MECHANICAL]` `grep -c "textarea" src/components/notes/WritePad.tsx` returns a value greater than 0.
  - `[MECHANICAL]` `grep -c "repeating-linear-gradient" src/components/notes/WritePad.tsx` returns a value greater than 0.
  - `[STRUCTURAL]` The commit handler is wrapped in try/catch and does not clear `value` when `onCommit` rejects.
  - `[HUMAN REVIEW]` In the running app: committing whitespace-only content does nothing; after a real commit the caret is still in the textarea and the S Pen / keyboard panel has not closed.
  - `[MECHANICAL]` `npm run build` exits 0.

> **Verification note (red-team C-2).** This project has **no DOM test environment** — no `jsdom`, `happy-dom` or `@testing-library`, and vitest runs pure-logic tests only. Component behaviour is therefore tagged `[HUMAN REVIEW]` and verified in the running app (`npm run preview`, or the Playwright smoke script in `forge-project.json`). Do **not** fabricate DOM test evidence, and do **not** add a DOM test harness — that is out of scope and an escalation trigger.

---
sub_spec_id: SS-04
phase: run
depends_on: ['SS-01']
---

### 4. Log-entry repository methods

- **Scope:** Add log-entry reads and writes to the note repository, following the `campaignRepository.ts` template. Provide list-by-session (chronological, soft-deleted excluded), create, and update. Update must preserve the original `createdAt` so an edited entry keeps its place in the timeline.
- **Files (modify):**
  - `src/storage/repositories/noteRepository.ts`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/storage/repositories/noteRepository.ts` exports `listLogEntriesBySession`, `createLogEntry` and `updateLogEntry`.
  - `[BEHAVIORAL]` `listLogEntriesBySession` returns entries sorted by `createdAt` ascending and omits rows with a `deletedAt`.
  - `[BEHAVIORAL]` `updateLogEntry` changes `body` and `updatedAt` while leaving `createdAt` unchanged.
  - `[BEHAVIORAL]` `createLogEntry` writes `type: 'log'`, `title: ''`, `status: 'active'`, `pinned: false` and the supplied `sessionId`.
  - `[STRUCTURAL]` Every new read path calls `excludeDeleted` or filters `deletedAt` inline.
  - `[MECHANICAL]` `npm run build` exits 0 and `npm test` passes.

---
sub_spec_id: SS-05
phase: run
depends_on: ['SS-01']
---

### 5. Link scanner

- **Scope:** Build the suggestion engine. Assemble a dictionary from party members (with linked character names), campaign creature templates with `category: 'npc'`, and all campaign note titles. Match entry text with whole-word exact matching plus fuzzy matching at edit distance ≤2, flagged as lower confidence. Report names appearing 2+ times with no existing record as "missing record" candidates. Accept and honour a dismissed-suggestion list. Pure logic, no UI.
- **Files (new):**
  - `src/features/notes/linkScanner.ts`
  - `src/features/notes/linkScanner.test.ts`
- **Acceptance criteria:**
  - `[MECHANICAL]` `npm test` passes with new tests in `src/features/notes/linkScanner.test.ts`.
  - `[STRUCTURAL]` `src/features/notes/linkScanner.ts` exports a `scanForLinks` function returning suggestions carrying at minimum matched text, target entity, and a confidence flag distinguishing exact from fuzzy.
  - `[BEHAVIORAL]` Given a dictionary containing `Ostrand`, the text `met 0strand today` produces a fuzzy suggestion for `Ostrand`.
  - `[BEHAVIORAL]` A name appearing as a substring of a longer word does not produce a suggestion — matching is whole-word.
  - `[BEHAVIORAL]` A suggestion whose key is in the dismissed list is not returned.
  - `[BEHAVIORAL]` A capitalised name appearing twice with no dictionary entry is returned as a missing-record candidate.

---
sub_spec_id: SS-06
phase: run
depends_on: ['SS-05']
---

### 6. Suggested-links panel

- **Scope:** UI for `scanForLinks` output. Lists each suggestion with matched text, proposed target, and confidence; Approve and Dismiss per row; a bulk approve. Approving replaces the matched span with a `wikiLink` node in the target body. Missing-record candidates offer "create NPC note". Dismissals persist so the same wrong suggestion does not reappear.
- **Files (new):**
  - `src/features/notes/SuggestedLinksPanel.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/notes/SuggestedLinksPanel.tsx` exports a `SuggestedLinksPanel` component accepting suggestions and approve/dismiss callbacks.
  - `[STRUCTURAL]` The approve handler produces a body containing a `wikiLink` node carrying the target label — assert on the returned document object, not on rendered DOM.
  - `[BEHAVIORAL]` Dismissing a suggestion writes the dismissal to persistent settings so a re-scan of the same text does not re-offer it (assert on the persisted value, not the DOM).
  - `[HUMAN REVIEW]` In the running app: fuzzy suggestions render visibly distinct from exact matches, and bulk-approve applies every listed suggestion.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-07
phase: run
depends_on: ['SS-02', 'SS-04', 'SS-06']
---

### 7. Promote-entries sheet

- **Scope:** Given a selection of log entries, offer three actions. **New note:** the existing 6 selectable types, title prefilled from the first ~60 characters of the earliest selected entry, body = selected entries concatenated in `createdAt` order with timestamps retained. **Add to existing:** searchable note picker backed by `useNoteSearch`, appending entries under a `---` divider. **Tag:** apply tags without promoting. In all cases the source entries are **never deleted**; each gains a `promoted_into` entity link to the target. Embeds `SuggestedLinksPanel` scoped to the selected entries.

  **The whole promote must be one `db.transaction('rw', …)`** covering the note write and every `promoted_into` link. A partial promote — note created, links missing — silently loses lineage, and the project already wraps multi-table cascades in a transaction (see soft-delete convention in `CLAUDE.md`).
- **Files (new):**
  - `src/features/notes/PromoteEntriesSheet.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/notes/PromoteEntriesSheet.tsx` exports a `PromoteEntriesSheet` component accepting an array of selected log entries.
  - `[STRUCTURAL]` The promote path calls `db.transaction('rw', …)` spanning both the notes and entityLinks tables.
  - `[BEHAVIORAL]` Promoting 3 entries creates one note whose body contains all 3 entry texts in `createdAt` order.
  - `[BEHAVIORAL]` After promoting, all 3 source log entries still exist with `deletedAt` unset.
  - `[BEHAVIORAL]` After promoting, an `entityLinks` row exists per source entry with `relationshipType: 'promoted_into'` pointing at the new note.
  - `[BEHAVIORAL]` "Add to existing" appends the entries to the chosen note's body and leaves its title unchanged.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-08
phase: run
depends_on: ['SS-03', 'SS-04']
---

### 8. `SessionLog` screen and route — capture only

- **Scope:** The in-session capture screen. Committed entries listed chronologically with timestamps; `WritePad` docked below; commit appends and clears while retaining focus. **Tap an entry to edit in place** (reopens `WritePad`, preserves `createdAt`); **long-press to soft-delete**. With no active session, render a "Start a session to begin logging" prompt with a button that starts one — do not fail or render an empty log. If a commit write fails, retain the text and toast; never silently drop an entry.

  Selection, promotion and the review sweep are **SS-13** — this sub-spec is capture and correction only.
- **Files (new):**
  - `src/features/session/sessionLog/SessionLog.tsx`
- **Files (modify):**
  - `src/routes/index.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/session/sessionLog/SessionLog.tsx` exports a `SessionLog` component.
  - `[STRUCTURAL]` `src/routes/index.tsx` registers a route rendering `SessionLog` under the `ShellLayout` tree.
  - `[BEHAVIORAL]` Committing text creates a `type: 'log'` note with the current `sessionId` (assert against the repository, not the DOM).
  - `[BEHAVIORAL]` Editing an entry updates its body and preserves its original `createdAt`.
  - `[BEHAVIORAL]` Deleting an entry sets `deletedAt`; `hardDelete` is never called from this screen.
  - `[STRUCTURAL]` The commit path is wrapped in try/catch and retains the draft text on failure.
  - `[HUMAN REVIEW]` In the running app: commit clears the field and leaves the caret in place; tap-to-edit and long-press-to-delete both work by touch; with no active session the "Start a session" prompt renders and no writing surface appears.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-09
phase: run
depends_on: ['SS-01']
---

### 9. Hide log entries from the notes grid, keep them searchable

- **Scope:** Introduce an explicit `HIDDEN_NOTE_TYPES = ['log']` exclusion in `NotesGrid`, applied to **both** the type pill-chip row and the "All" filter, plus an opt-in "Show log entries" toggle that reveals them. Separately, confirm log entries **remain indexed** by `useNoteSearch` — searching the raw log is a primary value of keeping it.
- **Files (modify):**
  - `src/features/notes/NotesGrid.tsx`
  - `src/features/notes/useNoteSearch.ts`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/notes/NotesGrid.tsx` defines a `HIDDEN_NOTE_TYPES` constant containing `'log'`.
  - `[STRUCTURAL]` Both the pill-chip list and the "All" filter derive from `NOTE_TYPES` minus `HIDDEN_NOTE_TYPES`.
  - `[BEHAVIORAL]` A log entry's body text is findable via `useNoteSearch`.
  - `[STRUCTURAL]` Log entries render a title fallback — the first ~40 characters of body text — rather than a blank row, since `title` is always `''`.
  - `[HUMAN REVIEW]` In the running app: with the toggle off no "Log" chip appears and "All" shows no log entries; enabling "Show log entries" reveals them with readable titles.
  - `[MECHANICAL]` `npm run build` exits 0 and `npm test` passes.

---
sub_spec_id: SS-10
phase: run
depends_on: ['SS-01']
---

### 10. Exclude log entries from the KB graph

- **Scope:** `syncNote` returns early for `type === 'log'`. Log entries are raw capture, not knowledge nodes; syncing ~80 nodes per session would swamp the graph, and `promoted_into` already records lineage in `entityLinks`.
- **Files (modify):**
  - `src/features/kb/linkSyncEngine.ts`
- **Acceptance criteria:**
  - `[BEHAVIORAL]` Calling `syncNote` on a note with `type: 'log'` creates no `kb_nodes` row and no `kb_edges` rows.
  - `[BEHAVIORAL]` Calling `syncNote` on a note of any other type behaves exactly as before.
  - `[MECHANICAL]` `npm run build` exits 0 and `npm test` passes.

---
sub_spec_id: SS-11
phase: run
depends_on: ['SS-01']
---

### 11. AAR export — log as one chronological section

- **Scope:** `renderSessionBundle` renders log entries as a **single chronological section inside the session index file**, not one `.md` per entry. Promoted notes keep their own files. Output for existing note types must be byte-identical to today.
- **Files (modify):**
  - `src/utils/export/renderSession.ts`
- **Acceptance criteria:**
  - `[BEHAVIORAL]` Exporting a session with 20 log entries and 2 promoted notes yields 3 files — the session index plus the 2 note files — not 23.
  - `[BEHAVIORAL]` The session index contains all 20 entry texts in `createdAt` order, each with its timestamp.
  - `[BEHAVIORAL]` Exporting a session containing no log entries produces byte-identical output to the pre-change implementation.
  - `[MECHANICAL]` `npm run build` exits 0 and `npm test` passes.

---
sub_spec_id: SS-13
phase: run
depends_on: ['SS-02', 'SS-07', 'SS-08']
---

### 13. Entry selection, promote entry point, and the review sweep

- **Scope:** Layer selection onto `SessionLog`. Tap-to-select toggles an entry; selecting one or more reveals an action bar that opens `PromoteEntriesSheet` with the selected entries. Add a **Review** action that runs `scanForLinks` across **every** entry in the session and renders `SuggestedLinksPanel` — this is the after-action pass and the second of the two placements the design specifies for the scanner. Promoted entries display a badge linking to their target.
- **Files (new):**
  - `src/features/session/sessionLog/SessionLogSelection.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/session/sessionLog/SessionLogSelection.tsx` exports a selection surface that accepts the session's log entries and renders an action bar when the selection is non-empty.
  - `[STRUCTURAL]` The Review action calls `scanForLinks` with **all** entries of the active session, not only the selected ones.
  - `[BEHAVIORAL]` An entry carrying a `promoted_into` link renders a badge referencing the target note id.
  - `[HUMAN REVIEW]` In the running app: selecting 2+ entries reveals the action bar, opening it shows `PromoteEntriesSheet` with exactly those entries, and Review lists suggestions drawn from the whole session.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-14
phase: run
depends_on: ['SS-03']
---

### 14. Wire `WritePad` into an existing long-text field

- **Scope:** Deliver the reusability `WritePad` was built for (red-team C-1 — otherwise it is an orphan component with one caller). Add an expand affordance beside the **ship notes** textarea that opens `WritePad` over it and writes the result back. Ship notes is the right first consumer: it is a long free-text field on a tablet-facing screen, and it is already gated by edit mode so the affordance inherits the correct permissions.
- **Files (modify):**
  - `src/screens/ShipsScreen.tsx`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/screens/ShipsScreen.tsx` imports `WritePad` and renders an expand control adjacent to the `Ship notes` textarea.
  - `[STRUCTURAL]` The expand control is rendered only when the ship editor is editable — it must not appear in play mode.
  - `[BEHAVIORAL]` Committing in `WritePad` writes the text back to `ship.notes` via the existing `patch` function.
  - `[HUMAN REVIEW]` In the running app on a tablet-width viewport: the expand control opens a full-screen ruled surface, and text written there lands in the ship notes field.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-12
phase: run
depends_on: ['SS-13', 'SS-14']
---

### 12. Route in-session capture to the log, and verify end to end

- **Scope:** The integration sub-spec. Point the session FAB's Note quick action at `SessionLog` instead of the `QuickNoteAction` type-chip form. `QuickNoteAction` and `QuickNoteDrawer` remain reachable outside the session flow — **do not delete either component**. Then verify the whole pipeline end to end and record the evidence.
- **Files (modify):**
  - `src/features/session/SessionQuickActions.tsx`
- **Files (new):**
  - `docs/specs/session-log-note-capture/ss12-integration-evidence.md`
- **Acceptance criteria:**
  - `[STRUCTURAL]` `src/features/session/SessionQuickActions.tsx` opens `SessionLog` for the Note action and no longer renders `QuickNoteAction` in the session flow.
  - `[MECHANICAL]` `grep -rc "QuickNoteDrawer" src/` returns a value greater than 0 — the component still exists and is reachable outside play.
  - `[INTEGRATION]` Full flow exercised in the running app: start a session → open the log from the FAB → commit 3 entries → edit one → delete one → select the remaining 2 → promote to a new NPC note → approve a suggested wikilink → export the session. The export contains the log section and the promoted note file, and the promoted note contains the approved `[[link]]`.
  - `[MECHANICAL]` `npm run build` exits 0 and `npm test` passes with 219 or more tests.
  - `[STRUCTURAL]` `docs/specs/session-log-note-capture/ss12-integration-evidence.md` records the end-to-end run with observed output.
  - `[MECHANICAL]` The evidence file is **committed**: `git ls-files --error-unmatch docs/specs/session-log-note-capture/ss12-integration-evidence.md` exits 0. `docs/` is gitignored in this repo, so staging it requires `git add -f` — a plain `git add` silently no-ops and the commit-advance gate will read the sub-spec as hollow success.

## Edge Cases

- **Garbled handwriting conversion** → entries are editable in place (SS-08). This is why edit cannot be deferred.
- **No active session** → "Start a session" prompt, not a failure or an empty log (SS-08).
- **Empty or whitespace-only commit** → no-op, no note created (SS-03).
- **Very long entries and paste** → no length cap; `WritePad` scrolls (SS-03).
- **Bare `Enter` mid-thought** → inserts a newline, never commits; commit is the button or `Ctrl`/`Cmd`+`Enter` (SS-03).
- **Short or common names in the link scan** (a PC called "Hawk") → whole-word matching, minimum length, remembered dismissals (SS-05).
- **Promoting an already-promoted entry** → allowed; entries may link into multiple targets, each recorded as its own `promoted_into` edge.
- **Editing an entry after promotion** → the promoted note is not retroactively updated; the `promoted_into` link records lineage only.
- **Session with zero log entries** → export output is byte-identical to today (SS-11).
- **Commit write fails (IndexedDB quota, closed connection)** → the draft text stays in the textarea and a toast fires. An entry is never silently dropped (SS-03, SS-08).
- **Deleting a session leaves its log entries orphaned** → **known limitation, accepted.** `sessionRepository.softDelete` does not cascade to notes today (verified at `sessionRepository.ts:193`), so entries survive with a `sessionId` pointing at a deleted session. This pre-dates this spec but the log amplifies it from a handful of notes to ~80 per session. Out of scope here; tracked for a follow-up cascade pass.
- **Log entries have no title** → `NotesGrid` falls back to the first ~40 characters of body (SS-09); `generateFilename` already falls back to `note-<idSuffix>.md`.

## Out of Scope

- Collapsing `NOTE_TYPES` to a general bucket plus tags — considered and declined. The log *is* the general bucket; promoted notes keep their types.
- Moving `TagPicker` presets to config (tracked separately as hardening-backlog item 5).
- Ink storage — strokes convert to text at the OS layer and are never persisted.
- Deleting `QuickNoteDrawer` or `QuickNoteAction`. They leave the session flow only.
- Any Dexie `version()` bump or data migration.
- Live link suggestions while writing — deliberately rejected as visual noise during play.
- Changing note export format for existing types.

## Constraints

**Musts:**
- Bodies stored as ProseMirror docs, never raw strings.
- Capture surface is a plain `<textarea>`.
- Entry edit and soft-delete ship in SS-08, not later.
- New reads filter soft-deleted rows.
- `CLAUDE.md` and `AGENTS.md` stay in sync when relationship types change.

**Must-Nots:**
- Must not require a title, type, tag or attach-target to capture an entry.
- Must not blur the capture field on commit.
- Must not call `hardDelete` from any UI path.
- Must not run a data migration or bump the Dexie version.
- Must not delete log entries on promotion.
- Must not use `contenteditable` for capture.

**Preferences:**
- Prefer reusing existing `Note` infrastructure over new tables or repositories.
- Prefer `campaignRepository.ts` patterns over `characterRepository.ts` (legacy).
- Prefer explicit exclusion lists over implicit defaults.
- Prefer config over component literals for user-facing groupings.

**Escalation triggers:**
- A Dexie `version()` bump appears necessary.
- Export output would change for existing note types.
- A change would touch the character sheet or system engine.
- A new npm dependency is required.

## Phase Specs

Refined by `/forge-prep` on 2026-07-27.

| Sub-Spec | Phase Spec |
|----------|------------|
| SS-01. `textToDoc` + `log` note type | `docs/specs/session-log-note-capture/sub-spec-01-text-to-doc.md` |
| SS-02. `promoted_into` relationship + docs | `docs/specs/session-log-note-capture/sub-spec-02-promoted-into-link.md` |
| SS-03. `WritePad` ruled surface | `docs/specs/session-log-note-capture/sub-spec-03-writepad.md` |
| SS-04. Log-entry repository methods | `docs/specs/session-log-note-capture/sub-spec-04-log-repository.md` |
| SS-05. Link scanner | `docs/specs/session-log-note-capture/sub-spec-05-link-scanner.md` |
| SS-06. Suggested-links panel | `docs/specs/session-log-note-capture/sub-spec-06-suggested-links-panel.md` |
| SS-07. Promote-entries sheet | `docs/specs/session-log-note-capture/sub-spec-07-promote-sheet.md` |
| SS-08. `SessionLog` screen + route | `docs/specs/session-log-note-capture/sub-spec-08-session-log-screen.md` |
| SS-09. Hide log from grid, keep searchable | `docs/specs/session-log-note-capture/sub-spec-09-notesgrid-exclusion.md` |
| SS-10. Exclude log from KB graph | `docs/specs/session-log-note-capture/sub-spec-10-kb-exclusion.md` |
| SS-11. AAR export — log as one section | `docs/specs/session-log-note-capture/sub-spec-11-aar-export.md` |
| SS-13. Selection, promote entry, review sweep | `docs/specs/session-log-note-capture/sub-spec-13-selection-and-review.md` |
| SS-14. Wire `WritePad` into ship notes | `docs/specs/session-log-note-capture/sub-spec-14-writepad-ship-notes.md` |
| SS-12. Route FAB to log + integration | `docs/specs/session-log-note-capture/sub-spec-12-integration.md` |

Index: `docs/specs/session-log-note-capture/index.md`
Contracts: `docs/specs/session-log-note-capture/contracts.json`

## Verification

1. `npm run build` exits 0 — the only type-check in the project.
2. `npm test` passes with 219 or more tests.
3. The `[INTEGRATION]` criterion in SS-12 is exercised in the running app and its evidence file is written.
4. `NotesGrid` shows no log entries with the toggle off, and reveals them with it on.
5. A session export with log entries plus promoted notes produces the session index with an inline chronological log section, and one file per promoted note.
