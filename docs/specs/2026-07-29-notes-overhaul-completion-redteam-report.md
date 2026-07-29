---
type: redteam-report
generated: 2026-07-29
target: docs/specs/2026-07-29-notes-overhaul-completion.md
findings_count: 10
critical_count: 4
advisory_count: 6
---

# Red Team Review: 2026-07-29-notes-overhaul-completion.md

6 sub-specs, 38 acceptance criteria. All 9 roles run.

Every finding below was verified against the codebase before being recorded. The
deletion sub-specs (SS-01, SS-02, SS-03, SS-05) came back essentially clean —
they are mechanical, `tsc -b` catches orphaned references, and no test references
any deleted symbol (`grep -rln` over `*.test.ts*` returns nothing). **All four
CRITICAL findings land on SS-04 and SS-06**, the only sub-specs containing new
logic or manual verification.

## CRITICAL Findings (4)

### C-1: `collapsed: true` on a leaf track is a no-op — SS-04's central criterion is unimplementable (Developer Implementer, Integration Architect)

- **Location:** SS-04 Decisions; SS-04 acceptance criteria 3 and 5
- **Issue:** The spec requires the Log lane to render "collapsed on first
  render". `collapsed` does not mean that. In
  `useTimelineLayout.ts:86-111` it is used solely to hide a track's *children*
  and redirect their items onto the parent as an aggregate. The Log lane is a
  leaf — it has no children — so `collapsed: true` on it changes nothing. A
  worker would set the flag, see the lane render fully expanded, and either
  ship it broken or stall.
- **Evidence:** `useTimelineLayout.ts:100-111` builds `itemTrackRedirect` by
  walking `parentTrackId` chains looking for a collapsed *ancestor*;
  `rowVisibleTracks` (115-126) hides a row only when an *ancestor* is collapsed.
  Neither path consults a leaf's own `collapsed` value.
- **Fix (as accepted at review time — SUPERSEDED, see Resolution):** use
  `visible: false` on the `log` catalog entry, because
  `SessionTimelinePanel`'s filter-state initializer seeds `hiddenTrackIds` from
  `tracks.filter(track => !track.visible)`.
- **Why that was wrong (converge pass 1):** the seeding is real, but
  `visible: false` means "never render" everywhere else in this timeline —
  `useTimelineLayout.ts:116` drops the row outright and
  `useTimelineState.toggleTrack` recomputes `visibleTrackIds` behind the same
  gate, so un-hiding leaves the track in neither list. Implemented literally,
  the lane appeared in the Tracks menu and was **inert**. The shipped fix is a
  new `defaultHidden` flag: start switched off, stay switchable, with
  `hiddenTrackIds` authoritative thereafter.

### C-2: Nesting the Log under Notes re-creates the exact burial the exclusion prevented (Product / Business, End User)

- **Location:** SS-04 Decisions (`parentTrackId: 'track-notes'`)
- **Issue:** The `notes` parent ships `collapsed: true`
  (the `notes` entry in `defaultTimelineTrackCatalog.ts`), and the session adapter's
  `buildTrack` carries `collapsed` through (`sessionTimelineAdapter`'s `buildTrack`). So
  Notes starts collapsed, and every descendant's items redirect onto the Notes
  row as an aggregate count. Adding the log means a 4-hour session's ~80 raw
  entries land on that row: it reads "Notes: 87 events" instead of "Notes: 7
  events". The promoted notes — the entire reason the timeline exists — are
  swamped by the raw capture. This is precisely the failure documented at
  `sessionTimelineAdapter`'s note filter as the reason log entries were excluded in
  the first place. Collapsing the Log lane does not mitigate it; the aggregate
  rolls up regardless.
- **Evidence:** `useTimelineLayout.ts:97-111` ("If a track's parent is collapsed,
  route its items to the parent's id. Grandchildren roll up to the nearest
  collapsed ancestor.") combined with `notes.collapsed === true` in the catalog.
- **Fix:** Make `log` a **top-level track**, not a child of Notes — the same
  treatment `npc` already gets ("a first-class campaign entity", kept as a
  top-level sibling). Drop `parentTrackId` from the `log` catalog entry, remove
  `'log'` from `NOTE_CHILD_TRACK_KINDS`, and give it its own `order` between
  `encounter` and `npc`. Combined with C-1's `defaultHidden`, the log becomes
  its own hidden-by-default row that never contaminates the Notes aggregate.
  **This changes an approved design decision ("nested under Notes") and needs
  the author's sign-off.**

### C-3: `SessionLog` as a bare route has no height container — the docked pad falls below the fold (Developer Implementer, End User)

- **Location:** SS-01 scope; SS-06 `[HUMAN REVIEW]` criterion
- **Issue:** `SessionLog` renders `flex h-full flex-col` with an inner
  `flex-1 overflow-y-auto` entry list and a docked `WritePad` beneath it. It was
  built to be mounted inside `SessionQuickActions`' explicit
  `<div className="flex h-[70vh] flex-col gap-3">`. As a bare route it renders
  into `<main className="flex-1 overflow-y-auto overflow-x-hidden pb-[140px]">` —
  itself a scroll container. The result is a nested scroller whose `h-full`
  resolves to the full main height *plus* 140px of bottom padding, pushing the
  docked `WritePad` below the visible area and making the page scroll instead of
  the entry list. On the Tab S9 with the handwriting pad open this is the whole
  screen misbehaving, and SS-01 has no criterion that would catch it — every
  listed criterion passes with a broken layout.
- **Evidence:** `ShellLayout`'s `<main>`; `SessionLog`'s render tree;
  `SessionQuickActions`' drawer wrapper (the `h-[70vh]` wrapper being deleted).
- **Fix:** Add to SS-01 a layout requirement and a matching criterion: the
  `/session/log` route must constrain itself to the `<main>` region's height so
  that the entry list is the only scrolling element and `WritePad` remains
  visible without scrolling the page. Add
  `[BEHAVIORAL] On a 1600×2560 tablet viewport, the entry list scrolls internally and the WritePad commit button is visible without scrolling the page.`

### C-4: SS-06's commit-failure criterion is untestable as written (QA Tester)

- **Location:** SS-06, `[BEHAVIORAL]` commit-failure criterion
- **Issue:** The criterion reads "with the note repository write forced to
  throw". There is no mechanism to force that. `CLAUDE.md` states plainly:
  "There is no component/DOM test setup", `npm test` covers "pure logic only",
  and `noteRepository` is imported as a module namespace by `SessionLog` with no
  injection seam. A verifier agent cannot satisfy this and will either fabricate
  a pass or block.
- **Evidence:** `CLAUDE.md` testing section; `SessionLog.tsx:5` (`import * as
  noteRepository`), no DI, no mock infrastructure in the repo.
- **Fix:** Split it into two satisfiable criteria — a `[STRUCTURAL]` check that
  `SessionLog.handleCommit` re-throws on failure and `WritePad`'s `onCommit`
  contract retains text on rejection (both already true and greppable), plus a
  `[HUMAN REVIEW]` manual check performed by temporarily throwing in
  `createLogEntry` during a dev run.

## ADVISORY Findings (6)

### A-1: The log route's header / back affordance is left undecided (Developer Implementer)

- **Location:** SS-01
- **Issue:** The design doc listed "whether `/session/log` gets its own header or
  reuses `SessionBar`" as an agent freedom, and the spec never resolves it. As a
  bare route the screen currently has no title and no back control — only the
  bottom nav. A worker may reasonably ship either.
- **Recommendation:** Commit a default in SS-01's Decisions: render a minimal
  header showing the session title, so the screen identifies itself.

### A-2: SS-02 touches 10 files, well above the 1-3 sizing heuristic (Scope Realist)

- **Location:** SS-02
- **Issue:** Nine deletions plus one modify. Sub-specs of this file count
  historically correlate with defers.
- **Recommendation:** **Do not split it.** Deletion is atomic here — any partial
  split leaves an intermediate state where `tsc -b` fails, which is worse than
  the size. Note the exception explicitly in the sub-spec so a prep pass does not
  helpfully decompose it.

### A-3: No rollback or commit strategy stated (SRE / Operator)

- **Location:** spec-wide
- **Recommendation:** State that the work happens on the current branch with one
  commit per sub-spec, so a bad deletion is revertable in isolation rather than
  as a single 14-file blob.

### A-4: The SS-06 evidence file lands in a gitignored directory (Data / Migration Steward)

- **Location:** SS-06 Files (new)
- **Issue:** `docs/` is listed in `.gitignore`, so
  `docs/specs/ss06-notes-overhaul-integration-evidence.md` will never be tracked.
  Precedent exists (`docs/specs/ss11-integration-evidence.md` is present and
  untracked), so this is expected, not broken.
- **Recommendation:** Note it in the sub-spec so the closer does not try to
  commit the file and report a failure when git ignores it.

### A-5: A worker "fixing" collapse propagation could break an existing test (QA Tester)

- **Location:** SS-04
- **Issue:** `notesToTimeline.buildTrack` deliberately does **not** carry
  `collapsed` (comment at `notesToTimeline.ts:53-58`), and
  `notesToTimeline.test.ts:28-30` asserts `ds.tracks.every(t => !t.collapsed)`.
  A worker chasing C-1 might "helpfully" propagate `collapsed` in that adapter
  too, breaking the test and then weakening it to pass.
- **Recommendation:** Add a must-not: do not change `notesToTimeline.ts`'s
  deliberate omission of `collapsed`; SS-04 touches only the session adapter,
  the session config and the catalog.

### A-6: No success metric (Product / Business)

- **Location:** Outcome
- **Recommendation:** Optional. The outcome is concrete enough to verify; a
  metric would be "entries committed per session > 0 at the next real table
  session", which is observational rather than checkable by an agent.

## Resolution — all 10 findings patched (2026-07-29)

| Finding | Applied |
|---|---|
| C-1 | SS-04 uses a new `defaultHidden` flag. The originally-accepted fix (`visible: false`) was implemented literally in the factory run and proved **inert** — `useTimelineLayout` drops `!visible` rows and `toggleTrack` won't re-add them, so the lane was listed in the Tracks menu and unreachable. Corrected in converge pass 1 and verified live. |
| C-2 | **Author decision:** Log becomes a top-level track (no `parentTrackId`), removed from `NOTE_CHILD_TRACK_KINDS`; new criterion asserts the Notes aggregate is unchanged |
| C-3 | SS-01 gains `SessionLog.tsx` as a modify target, a layout requirement, and two criteria (single scroll container; commit button visible at 1600×2560) |
| C-4 | Split into a `[STRUCTURAL]` code-path check plus a `[HUMAN REVIEW]` manual forced-throw check |
| A-1 | SS-01 Decisions commit to a minimal session-title header; bottom nav is the back affordance |
| A-2 | SS-02 gains an explicit do-not-split sizing note |
| A-3 | Constraint added: one commit per sub-spec |
| A-4 | SS-06 Decisions note that `docs/` is gitignored; closer must not try to commit the evidence file |
| A-5 | Must-not added protecting `notesToTimeline.ts`'s deliberate `collapsed` omission and its test |
| A-6 | Acknowledged; no metric added (observational, not agent-checkable) |

Path validation re-run after patching: 6 sub-specs, 20 files, all resolve cleanly.

## Role Scorecards

Developer: 3 | QA: 2 | End User: 2 | Architect: 1 | Scope Realist: 1 | Security: 0 | SRE: 1 | Data: 1 | Product: 2

**Security: 0 findings.** Skaldbok is a local-first offline PWA with no backend,
no auth, no network calls, and no PII beyond user-authored campaign content. This
change deletes UI and touches no storage, no schema and no serialization path.
There is no attack surface here — recorded as genuinely clean, not unexamined.
