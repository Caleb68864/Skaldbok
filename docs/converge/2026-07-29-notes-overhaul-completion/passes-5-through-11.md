# Passes 5–11 — consolidated record

Passes 1–4 have their own artifacts. This file covers 5 through 11, which were
run after the tidy sweep and mostly found defects in *corrections* rather than in
the factory's original output.

## Pass 5 — constraints + data angle

**7 gaps, 5 fixed, 2 declined.** All documentation drift or latent; none touched
a requirement or a Must-Not.

Fixed: stale JSDoc in `SessionRefreshContext`, `SessionScreen`, `ShellLayout`,
`TimelineRoot`; the `pinnedAsStamp` docs naming a deleted tray.
Declined: the zero-entry Log lane edge case (matches `npc`, and the edge case was
declined when the spec's edge cases were chosen); the `Ability` union nuance,
deferred to pass 7.

## Interlude — tidy sweep (commit `e155215`)

Five scan-and-fix rounds on the user's instruction to remove dead code. **22
orphan files deleted**, user-facing Settings copy corrected ("Quick Log Button" →
"Session Log Button"), the FAB's inert `cn()`/`transition-transform` removed, the
engine's colliding "quick-log palette" phrasing renamed, and the Log lane given
its own `colorToken` (it had been assigned `--color-danger`, identical to the
adjacent Encounters lane).

`git grep` at the fork point separated residue from pre-existing: this branch
orphaned `PartyPicker` and `CounterControl` (both `SessionQuickActions` imports);
the other 20 were already dead.

**Kept deliberately:** `NotesGrid`/`NoteItem` (rollback insurance, and the app's
only note-delete surface), `notesToTimeline.ts` (spec forbids touching it),
`SpellCard.tsx` (live TypeDoc link target), `renderCampaignIndex.ts` (unreferenced,
but that reads as an export-pipeline gap rather than dead code).

**One scan finding was wrong** and would have deleted live code: the unused-export
sweep reported `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS` as dead when
`resolveSessionTimelineTrackKind` uses it in the same file. Every deletion was
re-verified by grepping for real import specifiers.

## Pass 6 — deletion safety

**Clean on the deletions; 3 doc gaps.** No import specifier, dynamic import,
string-keyed lookup, barrel re-export, TypeDoc `{@link}`, CSS class or asset
reference to any of the 22 files survives in `src/`, `tests/`, `scripts/`,
`index.html`, `vite.config.ts` or the JSON configs. Confirmed live: 11 routes
walked in the running app, zero console errors or warnings.

## Pass 7 — doc-claim audit (commit `baaac07`)

**4 gaps. Two were comments written during the tidy sweep that were simply
false** — the sweep replaced stale claims with new wrong ones:

- `useNoteActions` justified its `syncNote` call with "auto-logged skill checks,
  HP changes, rests". That hook's `createNote` has one caller, `NoteEditorScreen`.
- `SessionRefreshContext` claimed components call `bumpSessionNotes`. Zero call
  sites — dead API, since removed.

Also corrected `Ability.pinnedAsStamp` (true only for `type: 'spell'` rows) and
`GlobalFAB`'s opening line, which claimed it "appears on every route" three lines
above the two early returns that disprove it.

Two further gaps were **spec** defects, not code: the spec still prescribed
`visible: false`, and a Must-Not said "MUST NOT touch the system engine" when it
meant "must not change its behaviour".

## Pass 8 — fix verification

**3 gaps.** The pass-7 fix to `useNoteActions` was *still* false: it said
`useSessionLog` "writes via `noteRepository`". It writes `db.notes.add()`
directly. Also found `SkillCheckEditDrawer`'s `onSaved={bumpTimeline}`, which
left the Session Notes panel showing a stale title after an edit — now `bumpAll`.

## Pass 9 — data / document integrity (commit `6ccf93a`)

**5 gaps**, including the two most valuable findings of the whole loop:

1. **Orphaned `promoted_into` edge.** `SessionLog`'s delete path soft-deleted the
   note and nothing else, so a promoted entry's edge outlived it. Export then
   shipped an `entityLink` whose `fromEntityId` names a note the bundle excludes,
   and the merge engine inserts links verbatim with no referential check. Fixed
   by cascading `deleteLinksForNote` under the same txId — verified live: entry
   and edge share one `softDeletedBy`.
2. **A phase spec that would have reverted a fix.** `sub-spec-4` still prescribed
   `visible: false` and encoded it as an executable `[STRUCTURAL]` gate. That gate
   **fails against correct code**, and `/forge-run` reads the phase spec rather
   than the master — a re-run would have restored the broken mechanism. Gate
   inverted; Files list corrected 3 → 6; both red-team copies fixed.

## Pass 10 — code-fix audit

**3 gaps**, all in the pass-9 fix:

- The delete loop was not transactional and its `catch` only toasted. A mid-batch
  failure left earlier entries deleted with **no Undo path** (the toast was inside
  the `try`), and rows still rendering. Worse, the new cascade introduced the
  mirror of the bug it fixed: if `deleteLinksForNote` succeeded and `softDelete`
  threw, the result was a live note whose edges were gone.
- The Undo loop abandoned on first error. Because `restore` reinstates links by
  *transaction* id, the first successful call already brings back the whole
  batch's edges — bailing then left every entry's edges live while some notes
  stayed deleted.
- The `useNoteActions` comment was wrong a **third** time ("the one sanctioned
  exception" — `db/client.ts` writes notes in upgrade hooks, and
  `SettingsScreen` clears them at runtime).

Fixed: per-entry success tracking, refresh and Undo offered for whatever
succeeded, an accurate partial-failure message, and a resilient Undo that
attempts all and reports what failed.

> **Superseded by pass 12.** This pass also justified *not* wrapping the loop in
> a Dexie transaction, on the grounds that `softDelete` awaits a dynamic
> `import()`. That was false — `softDelete` opens no transaction and the KB
> cleanup is fire-and-forget. Atomicity was available, and the non-atomic loop is
> what made the remaining defects possible. Pass 12 replaced the pair with
> `noteRepository.softDeleteWithLinks`, which is atomic.

## Pass 11 — document-set consistency

**8 gaps, all prose/bookkeeping.** Every one of the **51 embedded check commands
across all six phase specs exits 0**, so the executable layer is sound; the drift
was in the layer the correction pass did not sweep.

The design doc still described the lane as "nested under Notes, collapsed by
default"; the master spec's SS-04 Files list was still 3 files while its own
prose said otherwise; SS-06's integration criterion still said "collapsed →
expand"; `sub-spec-6` still carried the false "docs/ is never tracked by git"
claim that the master spec had already had corrected; and `decisions.md` repeated
the false `noteRepository` claim.

The pass's own closing observation is the lesson: the previous commit's
decisions entry says *"grep every artifact that encodes it"*, and that commit
then failed to sweep the master spec and the design doc.

## Standing pattern

Passes 7, 8, 10 and 11 all found defects introduced by **corrections**, not by
the original factory output. Rewriting prose feels safe, so nobody re-checks it —
and a false comment fails exactly like a stale one. The rule that came out of it:
if a comment asserts "X is read by Y" or "callers do Z", grep it before
committing.
