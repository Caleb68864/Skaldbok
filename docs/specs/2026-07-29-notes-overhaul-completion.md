# Notes Overhaul Completion — Raw Log as the Only Capture Surface

## Meta

- Client: Personal
- Project: Skaldbok
- Repo: `C:\Users\CalebBennett\Documents\GitHub\Skaldbok`
- Date: 2026-07-29
- Author: caleb
- Design doc: `docs/plans/2026-07-29-notes-overhaul-completion-design.md`
- Predecessor spec: `docs/specs/2026-07-27-session-log-note-capture.md`
- Status: ready
- Quality score: 32/35 (outcome 5, scope 5, decision guidance 5, edge coverage 4, acceptance criteria 4, decomposition 4, purpose alignment 5)

## Outcome

Pressing the global FAB anywhere in the app lands the user full-screen on
`/session/log` — the session's committed entries above, `WritePad` below, and no
chips, drawers, tag pickers or attach-to controls anywhere on the screen. The
Session tab becomes a review destination whose timeline shows both the raw log
and the notes promoted out of it. `SessionQuickActions` and its entire
chip/drawer surface no longer exist in the codebase.

## Intent

**Trade-off hierarchy** (when valid approaches conflict):

1. **Removing a decision from the moment of writing** beats every other
   consideration. This is the single criterion the work is judged by.
2. **Deleting code** beats refactoring it. Every surface in scope has a
   documented replacement; none of it needs preserving "just in case".
3. **Preserving auto-logging behaviour** beats tidiness. `useSessionLog` and its
   callers are not chips — they cost the user nothing at the table and stay
   exactly as they are.
4. **Consistency with existing repo conventions** beats ideal design.

**Decision boundaries** — decide autonomously: deletion order, how dead imports
are unwound, the FAB hide mechanism, timeline track metadata, file layout.
Stop and ask: see Escalation Triggers.

## Context

The 2026-07-27 design shipped its data model and surfaces. `SessionLog`,
`WritePad`, `PromoteEntriesSheet`, `SessionLogSelection`, `linkScanner`, the
`promoted_into` edge and the `HIDDEN_NOTE_TYPES` exclusion all exist and work.

What did not happen is the retirement it depended on. `GlobalFAB` still opens
`SessionQuickActions`, which renders a 6-chip primary row (Quick Log, Note,
Encounter, Damage, Quote, NPC), an 8-item **More** dropdown (Condition, Death
Roll, Rest, Camp, Travel, Rumor, Shopping, Loot), and a structured drawer per
action carrying `AttachToControl` plus a 10-chip `TagPicker`. The raw log is the
*second chip in that row*. A screen built to remove every decision from the
moment of writing sits behind fourteen of them.

Supporting findings from tracing the code:

- `src/features/session/actions/{Loot,Quote,Rumor,Shopping,SkillCheck}Drawer.tsx`
  are already unreferenced. Only `SkillCheckEditDrawer` still has callers.
- `SessionQuickActions.tsx:1156-1158` `void`s `renderSkillPicker`,
  `renderSpellPicker` and `renderAbilityPicker` — dead code kept compiling by a
  deliberate no-op.
- `SessionTimelinePanel.tsx:25` declares an `onSelectionContextChange` prop typed
  with `AttachToValue`, but no caller passes it. It exists only to feed
  `SessionQuickActions.preferredAttachTo`.
- `VaultBrowser.tsx:354` renders a "Quick Log Note" button through
  `sessionRefresh.openQuickLog('note')`, and its empty-state copy explains the
  Quick Log / encounter log / session note split.
- `sessionTimelineAdapter`'s note filter excludes `type: 'log'` from the timeline,
  and the comment records why: log entries carry `title: ''`, the timeline
  labels items by title, so every raw capture rendered as an unlabeled chip.
  **Re-including them therefore requires deriving a label from the body.**

## Requirements

1. The global FAB navigates to `/session/log` rather than opening a drawer, and
   is not rendered while on that route.
2. `SessionQuickActions`, `QuickLogPCTray`, `QuickNpcAction`, `AttachToControl`
   and the five orphaned `actions/*Drawer.tsx` files are deleted from the repo.
3. The `openQuickLog` request plumbing is removed from `SessionRefreshContext`,
   and both of its callers navigate to `/session/log` instead.
4. The session timeline includes log entries in their own **top-level** lane
   (a sibling of Encounters and NPCs, not a child of Notes), hidden by default
   and revealed through the existing track filter, each labelled from its body
   text. Log entries never roll up into the Notes aggregate count.
5. `MoreScreen` offers a "Session Log" link so the capture screen is reachable
   when `settings.showGlobalFAB` is off.
6. Auto-logging behaviour is unchanged: `useSessionLog` and every caller
   (`SheetScreen`, `GearScreen`, `PlayDashboard` modules, `CombatEncounterView`)
   keep writing typed notes exactly as they do today.
7. `npm run build` and `npm test` both pass with no weakened tests.

## Sub-Specs

---
sub_spec_id: SS-01
phase: run
depends_on: []
---

### 1. FAB navigates to the full-screen log

- **Scope:** Rewire `GlobalFAB` from a drawer host into a navigation trigger. It
  stops importing `SessionQuickActions`, stops rendering a `Drawer`, and instead
  navigates to `/session/log` via `useNavigate`. It returns `null` when the
  current pathname is `/session/log`, so nothing overlaps `WritePad` or the entry
  list. Pressing it with no active session navigates to the log anyway —
  `SessionLog` already renders a "Start a session to begin logging" empty state
  with a Start session button, which is strictly better than the current
  "Start a session first" toast dead end. The `showGlobalFAB === false` early
  return is retained.

  **Layout (red-team C-3):** `SessionLog` was built to be mounted inside
  `SessionQuickActions`' explicit `<div className="flex h-[70vh] flex-col gap-3">`
  wrapper, which this work deletes. As a bare route it renders into
  `<main className="flex-1 overflow-y-auto overflow-x-hidden pb-[140px]">`
  (`ShellLayout`'s `<main>`) — itself a scroll container. Left alone, `SessionLog`'s
  the docked `WritePad` risks falling below the fold. (The original wording said
  `h-full` "resolves to the full main height *plus* 140px of padding" — that is
  backwards. Under `box-sizing: border-box` the padding is *inside* main's
  height, so main's content box is already `H - 140` and `h-full` measures
  exactly that. The bug shipped by the factory was the opposite mistake:
  `h-[calc(100%-140px)]`, subtracting the padding a second time and wasting
  ~140px. See the comment in `SessionLog.tsx`.) On the Tab S9 with the handwriting pad open that is the entire
  screen misbehaving. The route must constrain itself to the `<main>` region's
  height so the entry list is the only scrolling element.
- **Files (modify):**
  - `src/components/shell/GlobalFAB.tsx`
  - `src/features/session/sessionLog/SessionLog.tsx`
- **Decisions:** Use `useLocation().pathname === '/session/log'` for the hide
  check rather than adding a context flag — the route is the fact being tested,
  and a flag would need threading through `ShellLayout`. Drop the
  `requestedQuickLogAction` / `requestedQuickLogNonce` / `clearQuickLogRequest`
  consumption here; SS-03 removes the context members themselves.
  **Header (red-team A-1):** render a minimal header on the log showing the
  active session's title, so the screen identifies itself. The bottom nav is the
  back affordance — do not add a separate back button. Constrain the layout by
  giving `SessionLog`'s root a viewport-relative max height that accounts for
  the shell chrome; do not change `ShellLayout`'s `pb-[140px]`, which other
  routes depend on.
- **Acceptance criteria:**
  - `[MECHANICAL]` `grep -c "SessionQuickActions" src/components/shell/GlobalFAB.tsx` returns 0.
  - `[MECHANICAL]` `grep -c "Drawer" src/components/shell/GlobalFAB.tsx` returns 0.
  - `[STRUCTURAL]` `GlobalFAB.tsx` imports `useNavigate` and `useLocation` from `react-router-dom` and calls `navigate('/session/log')` in its press handler.
  - `[STRUCTURAL]` `GlobalFAB` returns `null` when `location.pathname === '/session/log'`, and still returns `null` when `settings.showGlobalFAB === false`.
  - `[BEHAVIORAL]` With a session active, pressing the FAB from `/character/sheet` lands on `/session/log` showing the entry list and `WritePad`.
  - `[BEHAVIORAL]` With no session active, pressing the FAB lands on `/session/log` showing the "Start a session to begin logging" empty state and its Start session button.
  - `[BEHAVIORAL]` While on `/session/log`, no FAB is rendered — nothing overlaps `WritePad` or the entry list.
  - `[STRUCTURAL]` `SessionLog`'s root constrains to the shell's `<main>` region height; the entry list is the only element with `overflow-y-auto` in the route's own subtree.
  - `[BEHAVIORAL]` At a 1600×2560 tablet viewport with ~30 committed entries, the entry list scrolls internally and the `WritePad` commit button is visible without scrolling the page.
  - `[STRUCTURAL]` The log route renders a header showing the active session's title.
  - `[BEHAVIORAL]` On `/session/log`, a header is visible above the entry list displaying the current session's name (e.g., "Campaign Name — Session 3").

---
sub_spec_id: SS-02
phase: run
depends_on: ['SS-01']
---

### 2. Delete the quick-action surface

- **Scope:** Remove the chip/drawer capture surface entirely. This is a deletion
  sub-spec: no behaviour is reimplemented anywhere. `SessionTimelinePanel` is
  modified only to drop its now-unreferenced `AttachToValue` import and the
  `onSelectionContextChange` prop plus the three `useCallback`s that feed it
  (lines ~216-257) — no caller passes that prop, so removing it changes no
  behaviour.
- **Files (delete):**
  - `src/features/session/SessionQuickActions.tsx`
  - `src/features/session/quickLog/QuickLogPCTray.tsx`
  - `src/features/session/quickActions/QuickNpcAction.tsx`
  - `src/features/session/quickActions/AttachToControl.tsx`
  - `src/features/session/actions/LootDrawer.tsx`
  - `src/features/session/actions/QuoteDrawer.tsx`
  - `src/features/session/actions/RumorDrawer.tsx`
  - `src/features/session/actions/ShoppingDrawer.tsx`
  - `src/features/session/actions/SkillCheckDrawer.tsx`
- **Files (modify):**
  - `src/features/session/SessionTimelinePanel.tsx`
- **Sizing note (red-team A-2):** this sub-spec touches 10 files, above the usual
  1-3 heuristic. **Do not split it.** The deletion is atomic: any partial split
  leaves an intermediate state where `tsc -b` fails on orphaned imports, which is
  worse than the file count. A prep or decomposition pass must leave SS-02 whole.
- **Decisions:** `src/features/session/actions/SkillCheckEditDrawer.tsx` and
  `src/features/session/actions/formatSkillCheckTitle.ts` are **kept** —
  `src/features/notes/NotesGrid.tsx:297` and `src/screens/SessionScreen.tsx:779`
  both open the edit drawer for skill-check notes that auto-logging still
  produces, and `formatSkillCheckTitle` is used by `useSessionLog`. Deleting
  either would strip the only edit path for those notes.
  **Path note:** always cite these two callers by full repo-relative path. They
  do **not** live under `src/features/session/`. A prior run's generated check
  guessed `src/features/session/NotesGrid.tsx`, which does not exist, and
  deferred SS-02 on a false negative. Do not delete the `quickLog/` or `quickActions/` directories if any
  other file lands in them; delete the listed files only.
- **Acceptance criteria:**
  - `[MECHANICAL]` All nine listed files are absent: `test ! -e src/features/session/SessionQuickActions.tsx` (and each of the other eight) exits 0.
  - `[MECHANICAL]` `grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|resolveAttach\|AttachToValue" src/` returns no matches.
  - `[MECHANICAL]` `grep -rn "renderSkillPicker\|renderSpellPicker\|renderAbilityPicker\|TAG_OPTIONS\|REST_TYPES" src/` returns no matches.
  - `[STRUCTURAL]` `src/features/session/actions/SkillCheckEditDrawer.tsx` and `src/features/session/actions/formatSkillCheckTitle.ts` still exist and are still imported by their existing callers.
  - `[STRUCTURAL]` `SessionTimelinePanel.tsx` no longer declares `onSelectionContextChange` in its props type and no longer imports from `quickActions/AttachToControl`.
  - `[MECHANICAL]` `npm run build` exits 0 — no orphaned import survives.

---
sub_spec_id: SS-03
phase: run
depends_on: ['SS-01', 'SS-02']
---

### 3. Remove the openQuickLog plumbing and rewire its callers

- **Scope:** Delete `openQuickLog`, `clearQuickLogRequest`,
  `requestedQuickLogAction` and `requestedQuickLogNonce` from
  `SessionRefreshContext` (its type, its state, its `useCallback`s and both
  dependency arrays). Rewire the two remaining callers to navigate to
  `/session/log`: `SessionScreen`'s `onAddToTimeline` prop and `VaultBrowser`'s
  "Quick Log Note" button. `VaultBrowser`'s empty-state copy is rewritten —
  it currently reads "Use Quick Log for fast captures during play, encounter logs
  for scene-specific details, and session notes for recap, clues, and cleanup",
  which describes a surface that no longer exists.
- **Files (modify):**
  - `src/features/session/SessionRefreshContext.tsx`
  - `src/screens/SessionScreen.tsx`
  - `src/features/kb/VaultBrowser.tsx`
- **Decisions:** The `VaultBrowser` button keeps its position and styling; only
  its label and handler change (suggested label: "Open Session Log"). Replacement
  empty-state copy should describe the log-then-promote flow rather than
  enumerating capture surfaces — e.g. "Write into the session log during play,
  then promote the entries that matter into notes." The refresh tokens
  (`timelineRefreshToken`, `sessionNotesRefreshToken`, `bumpAll`, `bumpTimeline`)
  are **not** touched; only the quick-log request members are removed.
- **Acceptance criteria:**
  - `[MECHANICAL]` `grep -rn "openQuickLog\|requestedQuickLog\|clearQuickLogRequest" src/` returns no matches.
  - `[STRUCTURAL]` `SessionRefreshContext` still exports `bumpAll`, `bumpTimeline`, `timelineRefreshToken` and `sessionNotesRefreshToken` with unchanged behaviour.
  - `[STRUCTURAL]` `SessionScreen`'s `onAddToTimeline` handler navigates to `/session/log`.
  - `[STRUCTURAL]` `VaultBrowser`'s empty-state button navigates to `/session/log` and its surrounding copy no longer contains the string "Quick Log".
  - `[BEHAVIORAL]` On the Session tab, the timeline's "Add to Timeline" button navigates to `/session/log`.
  - `[MECHANICAL]` `npm run build` exits 0.

---
sub_spec_id: SS-04
phase: run
depends_on: []
---

### 4. Show log entries on the session timeline in a top-level, hidden-by-default lane

- **Scope:** Stop excluding `type: 'log'` from the session timeline and give log
  entries their own **top-level** track — a sibling of Encounters and NPCs, not a
  child of Notes — that starts **hidden** and is revealed through the existing
  track filter. Two red-team findings drive that shape and both are load-bearing:

  **Why top-level, not nested under Notes (C-2):** the `notes` parent ships
  `collapsed: true` (the `notes` entry in `defaultTimelineTrackCatalog.ts`) and the session
  adapter carries `collapsed` through (`sessionTimelineAdapter`'s `buildTrack`). When a
  parent is collapsed, `useTimelineLayout.ts:97-111` redirects **every
  descendant's items onto the parent row as an aggregate**. Nesting the log there
  would turn "Notes: 7 events" into "Notes: 87 events" — burying the promoted
  notes under the raw capture, which is the precise failure the original
  exclusion existed to prevent (`sessionTimelineAdapter`'s note filter). `npc` is
  already treated this way as a first-class top-level sibling; `log` follows it.

  **Why not `collapsed: true` (C-1):** `collapsed` only hides a track's
  *children* and rolls their items up. The log lane is a leaf, so `collapsed`
  on it is a **no-op**.

  **Corrected during converge pass 1 — use `defaultHidden`, not `visible: false`.**
  This spec originally prescribed `visible: false`, reasoning that
  `SessionTimelinePanel`'s filter-state initializer seeds `hiddenTrackIds` from
  `tracks.filter(track => !track.visible)`. That seeding is real, but
  `visible: false` means "never render" everywhere else in this timeline:
  `useTimelineLayout.ts:116` drops the row outright, and
  `useTimelineState.toggleTrack` recomputes `visibleTrackIds` behind the same
  gate, so un-hiding leaves the track in neither list. Implemented literally,
  the lane was listed in the Tracks menu and was **inert** — verified in the
  running app. The prescribed mechanism was wrong.

  The implementation instead adds a `defaultHidden?: boolean` to
  `TimelineTrack`: start switched off, stay switchable, with `hiddenTrackIds`
  authoritative once a track has been classified. The catalog entry is
  `visible: true, defaultHidden: true`. This necessarily touches
  `components/timeline/types.ts` and `components/timeline/hooks/useTimelineState.ts`
  beyond SS-04's original three-file scope.

  **Labels:** log entries carry `title: ''` and the timeline labels items by
  title, so the adapter must derive each item's label from the entry body —
  otherwise the lane fills with unlabeled chips. Use the existing `docToText`
  helper from `src/features/notes/textToDoc.ts`, collapsed to a single line.
- **Files (modify):**
  - `src/features/session/sessionTimelineAdapter.ts`
  - `src/features/session/sessionTimelineConfig.ts`
  - `src/components/timeline/config/defaultTimelineTrackCatalog.ts`
  - `src/components/timeline/types.ts`
  - `src/components/timeline/hooks/useTimelineState.ts`
  - `src/features/session/SessionTimelinePanel.tsx`
- **Decisions:** Truncate derived labels to **60 characters** followed by `…`.
  Add `log: 'log'` to `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS`. Do **not** add
  `'log'` to `NOTE_CHILD_TRACK_KINDS` — it is top-level. Add a `log` entry to
  `DEFAULT_TIMELINE_TRACK_CATALOG` with **no `parentTrackId`**,
  `visible: true, defaultHidden: true`, `collapsible: true`, label `'Log'`, and
  an `order` placing it between `encounter` (1) and `npc` (2). Use a
  `colorToken` **not** already taken by an adjacent top-level lane rather
  than introducing a new CSS variable. The session adapter must emit the `log`
  track alongside `npc` in its top-level branch, not inside the
  `NOTE_CHILD_TRACK_KINDS` loop. An entry whose body yields empty text after
  `docToText` falls back to the label `'(empty entry)'` rather than rendering
  blank.
- **Acceptance criteria:**
  - `[MECHANICAL]` `grep -c "type !== 'log'" src/features/session/sessionTimelineAdapter.ts` returns 0.
  - `[STRUCTURAL]` `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS` contains a `log` key, and `NOTE_CHILD_TRACK_KINDS` does **not** contain `'log'`.
  - `[STRUCTURAL]` `DEFAULT_TIMELINE_TRACK_CATALOG.log` exists with `visible: true`, `defaultHidden: true`, `collapsible: true`, and **no** `parentTrackId` key.
  - `[STRUCTURAL]` The adapter derives a timeline item label for `type: 'log'` notes from `docToText(note.body)`, truncated to 60 chars, falling back to `'(empty entry)'` when the body yields no text. Whitespace (including newlines) within the derived text must be collapsed to a single space so labels display on one line without line breaks.
  - `[BEHAVIORAL]` In a session with committed log entries, the Session tab timeline shows **no Log row on first render**; the track filter lists "Log", and enabling it reveals a top-level Log row whose entries show their text rather than blank chips.
  - `[BEHAVIORAL]` With the Log lane revealed and the Notes parent collapsed, the Notes row's aggregate count is unchanged from before this work — log entries never roll up into it.
  - `[BEHAVIORAL]` Notes promoted out of the log still appear in their own type lanes (e.g. Rumors, Loot) with unchanged labels and ordering.
  - `[MECHANICAL]` `npm test` exits 0 — no existing timeline or adapter test is weakened to accommodate the change.

---
sub_spec_id: SS-05
phase: run
depends_on: []
---

### 5. Reach the log from the More screen

- **Scope:** Add a "Session Log" link to `MoreScreen`'s existing link list
  pointing at `/session/log`, matching the styling of the current entries
  (`/settings`, `/reference`, `/library`, `/profile`). This is the fallback route
  when `settings.showGlobalFAB` is off, so the capture screen is never
  unreachable.
- **Files (modify):**
  - `src/screens/MoreScreen.tsx`
- **Decisions:** Place it **first** in the list — it is the most frequently
  needed destination during play. Use the same `<Link>` element and class names
  as the existing entries; do not introduce a new list-item component.
- **Acceptance criteria:**
  - `[MECHANICAL]` `grep -c "/session/log" src/screens/MoreScreen.tsx` returns at least 1.
  - `[STRUCTURAL]` The new entry is the first item in `MoreScreen`'s link array and uses the same `<Link>` markup and classes as the existing entries.
  - `[BEHAVIORAL]` With `settings.showGlobalFAB` set to off, More → Session Log still reaches the capture screen.

---
sub_spec_id: SS-06
phase: verify
depends_on: ['SS-01', 'SS-02', 'SS-03', 'SS-04', 'SS-05']
---

### 6. End-to-end verification and evidence

- **Scope:** Run the full verification pass across the assembled change and
  record the result. No source files are modified in this sub-spec; if a defect
  is found, report it rather than patching it here. Traveller only — per standing
  project convention Dragonbane is not re-tested unless its code was touched, and
  none of this work touches the system engine or the character sheet.
- **Files (new):**
  - `docs/specs/ss06-notes-overhaul-integration-evidence.md`
- **Decisions (red-team A-4, corrected):** `docs/` is listed in `.gitignore`, so
  a *new* file under it is **not** picked up by `git add -A` and the closer must
  not report a failure when git skips it. The original wording went further and
  claimed such files are "never tracked by git" — that is false: 28 files under
  `docs/` are tracked via force-add (`git ls-files docs/`), including
  `docs/decisions.md`, which this branch commits on every pass because a
  pre-commit hook requires it. Treat the evidence file as untracked-by-default,
  and force-add it only if you deliberately want it in history.
- **Acceptance criteria:**
  - `[MECHANICAL]` `npm run build` exits 0 and its output is captured verbatim in the evidence file.
  - `[MECHANICAL]` `npm test` exits 0 with no test count regression versus the pre-change baseline; both numbers are recorded in the evidence file.
  - `[MECHANICAL]` `grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|openQuickLog" src/` returns no matches, captured in the evidence file.
  - `[INTEGRATION]` Full flow in the running app: start a session → press the FAB → land full-screen on `/session/log` with no chips and no FAB overlap → commit three entries → tap one and edit it, confirming its original timestamp survives → select two entries and promote them to a new note → confirm the `Promoted` badge appears and the raw entries remain in the log → open the Session tab → confirm the promoted note appears in its type lane and the Log lane is **hidden** on first render → enable it in the track filter and confirm the three entries show their text.
  - `[INTEGRATION]` Auto-logging is intact: change HP on the character sheet and confirm a typed note is still written to the session and appears on the timeline.
  - `[BEHAVIORAL]` Draft survival: type text into `WritePad` without committing, navigate to the Session tab, navigate back to `/session/log`, and confirm the draft text and any edit target are still present.
  - `[STRUCTURAL]` Commit-failure path intact: `SessionLog.handleCommit` still re-throws on repository failure, and `WritePad` still retains `value` and shows a toast when `onCommit` rejects. Verified by reading both files — there is no DOM test setup in this project, so this is a code-path check, not an executed test.
  - `[HUMAN REVIEW]` Commit failure, manual: temporarily make `noteRepository.createLogEntry` throw in a dev run, commit an entry, and confirm the typed text is **retained** in the pad with an error toast rather than cleared. Revert the temporary change afterward.
  - `[HUMAN REVIEW]` On the Tab S9 with the S Pen, the handwriting pad plus the entry list fit without the pad hiding content the user needs while writing.

## Edge Cases

- **FAB pressed with no active session** → navigate to `/session/log` and let its
  existing empty state offer Start session. Do not toast.
- **FAB pressed while already on `/session/log`** → unreachable, because the FAB
  is not rendered on that route. Pinned as a criterion (SS-01) so an
  implementation that only changes the click handler is caught.
- **`settings.showGlobalFAB` is off** → More → Session Log is the fallback route
  (SS-05). The toggle keeps working; it no longer strands the user.
- **Commit failure** → `WritePad` retains the typed text and surfaces an error.
  `SessionLog.handleCommit` already re-throws to make this work; pinned as a
  criterion (SS-06) so a refactor cannot silently eat a thought.
- **Uncommitted draft across navigation** → survives via the existing
  localStorage draft parking, including the edit target. The move from drawer to
  route must not break it (SS-06).
- **Log entry with an empty body** → renders as `'(empty entry)'` on the
  timeline, never as a blank chip (SS-04).
- **Session with zero log entries** → the Log lane is still emitted (empty, and
  switched off by `defaultHidden`), like the note child tracks. It has to be:
  the track filter lists tracks present in the dataset, so gating emission on
  entries existing would mean a fresh session gives no hint the lane exists
  until the first entry — the moment it stops needing to be discovered. Note
  "collapsed" is the wrong verb here and was corrected: `collapsed` only hides a
  track's *children*, so it is a no-op on this leaf.

## Out of Scope

- Collapsing `NOTE_TYPES` into a general bucket plus tags.
- Moving `TagPicker` presets into config (existing backlog item #5).
- `NoteEditorScreen`'s note-type pills — that is note editing, not capture.
- Any change to `useSessionLog` or its auto-logging callers.
- Any change to `PromoteEntriesSheet`, `SessionLogSelection`, `linkScanner`, or
  the `promoted_into` edge.
- Any change to the character sheet, Play Dashboard, or the system engine.
- Any change to `NOTE_TYPES`, the note schema, or Dexie versions.
- The AAR export format.

## Constraints

**Musts:**

- `npm run build` (`tsc -b` + vite) and `npm test` both pass.
- Auto-logging behaviour is byte-for-byte unchanged.
- `SkillCheckEditDrawer` stays reachable from `NotesGrid` and `SessionScreen`.
- The timeline Log lane is top-level and hidden by default, via `defaultHidden`
  (**not** `visible: false` — see the corrected C-1 rationale in SS-04).
- Log entries get a body-derived label on the timeline.
- The `/session/log` route fits the shell's `<main>` region without the docked
  `WritePad` falling below the fold.
- Work happens on the current branch with **one commit per sub-spec**, so a bad
  deletion is revertable in isolation rather than as a single 14-file blob
  (red-team A-3).

**Must-Nots:**

- MUST NOT change `NOTE_TYPES` or run a data migration.
- MUST NOT add a Dexie `version()` block — nothing here is a schema change.
- MUST NOT weaken or delete an existing test to make a change pass.
- MUST NOT introduce a `systemId ===` branch anywhere.
- MUST NOT change the **behaviour** of the character sheet or the system
  engine. (Originally worded "MUST NOT touch". Relaxed after the fact: a
  separately-authorised dead-code sweep made comment-only edits to
  `features/systems/engine/{index,types}.ts` and `types/character.ts` —
  renaming stale "quick-log palette" prose and correcting `pinnedAsStamp`
  docs. No behavioural change; `git diff` on those files is comments only.)
- MUST NOT reimplement any deleted quick action in another surface.
- MUST NOT change `notesToTimeline.ts`'s deliberate omission of `collapsed`
  (see its comment at lines 53-58). `notesToTimeline.test.ts:28-30` asserts
  `ds.tracks.every(t => !t.collapsed)`; propagating `collapsed` there while
  chasing the SS-04 change would break that test and tempt a worker into
  weakening it. SS-04 touches only the session adapter, the session config and
  the catalog (red-team A-5).
- MUST NOT change `ShellLayout`'s `pb-[140px]` — other routes depend on it.

**Preferences:**

- Prefer deleting over commenting out or feature-flagging.
- Prefer the existing `<Link>` / class conventions over new components.
- Prefer reusing catalog color tokens over adding CSS variables.
- Prefer relative imports where both relative and `@/` work.

**Escalation Triggers:**

- Deleting a listed file would orphan a symbol that `useSessionLog` or another
  auto-logging caller depends on.
- A Dexie `version()` bump appears necessary.
- The timeline change would alter ordering or grouping for non-log notes.
- An existing test fails in a way that cannot be fixed without changing the
  test's assertion.

## Verification

1. `npm run build` — the project's only type-check. An orphaned reference to any
   deleted symbol fails here; this is the primary safety net for the deletions.
2. `npm test` — existing suite green, no count regression.
3. `grep -rn "SessionQuickActions\|QuickLogPCTray\|QuickNpcAction\|AttachToControl\|openQuickLog" src/` — no matches.
4. Run the app (`npm run dev`, or `build-and-run.bat` for LAN tablet testing) and
   execute the SS-06 `[INTEGRATION]` flows against a Traveller campaign.
5. Confirm on the Tab S9 that the full-screen log plus the S Pen handwriting pad
   leave the entry list usable.

## Phase Specs

Refined by `/forge-prep` on 2026-07-29.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. FAB navigates to the full-screen log | `docs/specs/notes-overhaul-completion/sub-spec-1-fab-full-screen-log.md` |
| 2. Delete the quick-action surface | `docs/specs/notes-overhaul-completion/sub-spec-2-delete-quick-action-surface.md` |
| 3. Remove the openQuickLog plumbing | `docs/specs/notes-overhaul-completion/sub-spec-3-remove-openquicklog-plumbing.md` |
| 4. Log entries on the timeline | `docs/specs/notes-overhaul-completion/sub-spec-4-timeline-log-lane.md` |
| 5. Reach the log from the More screen | `docs/specs/notes-overhaul-completion/sub-spec-5-more-screen-log-link.md` |
| 6. End-to-end verification and evidence | `docs/specs/notes-overhaul-completion/sub-spec-6-integration-verification.md` |

Index: `docs/specs/notes-overhaul-completion/index.md`
