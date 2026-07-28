
## 2026-07-27 — Promoted notes discarded approved wikilink suggestions

- Symptom: Approving a suggested `[[link]]` in `PromoteEntriesSheet` only
  updated the panel's local preview text; the note actually created (or
  appended to) via "Create note" / "Append to note" always used the raw,
  unresolved entry text, so the approval had no effect on saved data.
- Fix: `createNoteAndPromote` and `appendEntriesToExistingNote` now accept
  the resolved body text explicitly; the sheet tracks the running
  approved text via `SuggestedLinksPanel`'s `onApprove` callback and passes
  it through instead of recomputing from the raw entries.
- Surfaces: `src/features/notes/PromoteEntriesSheet.tsx`.
- Watch: `handleBulkApprove` can double-wrap a span if two distinct
  dictionary entries (e.g. a note and its linked creature template) match
  the exact same text — each approval re-scans the running text with a
  plain word-boundary regex that doesn't know a prior wrap already
  happened. Not hit by a single "Approve" click; only a latent risk for
  "Approve all" with duplicate-target suggestions.
  > **Correction and resolution (converge pass 2, 2026-07-27).** Two claims
  > above were wrong. It was **not** latent — it was reproduced live,
  > producing `We met [[[[Elara Ostrand]]]] at the tavern.` And it was **not**
  > exclusive to "Approve all": `handleApprove` shares the same `bodyText`
  > state across calls, so two sequential single-row Approve clicks corrupt
  > the body identically. Only multi-word names can collide (the per-token
  > loop `break`s on the first exact match, so a duplicate single-word name
  > never reaches the list twice) — but a note titled after an NPC plus that
  > NPC's creature template is ordinary campaign authoring, not a contrived
  > case. **Fixed:** `applySuggestionToBody` now skips any match already
  > enclosed in `[[…]]`. Regression test in `SuggestedLinksPanel.test.ts`,
  > verified to fail without the guard.
- Commit: factory(SS-12) — route session FAB Note action to SessionLog,
  verify end to end.

## 2026-07-27 — Link scanner fuzzy thresholds were never length-scaled

- Symptom: `scanForLinks` applied a single fixed edit distance of 2 to every
  dictionary name regardless of its length, with no minimum-length guard.
  Proved by live probe: a 2-character PC name such as "Al" fuzzy-matched
  "we", "saw", "7", "27", "PM", "00" and bare numbers; a 3-char name matched
  at distance 2 where the spec requires <=1. In any campaign with a short
  PC or NPC name the scanner would bury every log entry in garbage
  suggestions — the precise "worse than no scanner" outcome the sub-spec's
  own rationale was written to prevent. The test suite passed throughout
  because it never asserted the thresholds at all.
- Fix: added `fuzzyThresholdFor(name)` — returns null below 3 chars (name
  excluded from matching entirely), 1 for 3-4 chars, 2 for 5+. Applied in
  both the per-token pass and the missing-record pass. Missing-record
  candidates additionally skip tokens under 3 chars and purely numeric
  tokens. Separately, `PromoteEntriesSheet` was feeding the scanner
  timestamp-prefixed text, which is where the "PM"/"Entry" candidates came
  from; scan input is now raw body text while the promoted note keeps its
  timestamps.
- Surfaces: `src/features/notes/linkScanner.ts`,
  `src/features/notes/linkScanner.test.ts`,
  `src/features/notes/PromoteEntriesSheet.tsx`.
- Watch: the earlier `handleBulkApprove` double-wrap risk noted above is
  still latent and is now slightly more reachable, since better-quality
  suggestions mean "Approve all" is more likely to be used. Also: parallel
  fix agents sharing one working tree used `git stash` for recovery, which
  is a whole-tree operation that silently reverted other agents' in-flight
  edits — pathspec discipline does not constrain stash. Isolate agents in
  worktrees or serialise them.
- Commit: converge(pass-1) — close 11 spec gaps found by 4-way audit.

## 2026-07-27 — Promoted notes never reached the KB graph
- Symptom: promoting session-log entries created a correct, correctly-scoped
  note that was invisible in the Session Notes panel and the Knowledge Base.
  It only appeared after opening the Knowledge Base screen, whose mount runs
  `bulkRebuildGraph`. Both surfaces read `kb_nodes`, and no node existed.
- Fix: `PromoteEntriesSheet` wrote straight to Dexie, bypassing
  `noteRepository` and so never firing `syncNote`. Moved the three operations
  into the repository (`promoteEntriesToNewNote`, `appendEntriesToNote`,
  `addTagsToNotes`) and awaited the sync — fire-and-forget let the caller's
  refresh race it and re-query before the node existed.
- Surfaces: Session Notes panel, Knowledge Base, backlinks, wikilink edges.
  "Add to existing" was affected too — appends never re-synced.
- Watch: any new write path that touches `db.notes` directly will reintroduce
  this. The repository is the only place that fires `syncNote`.
- Commit: fix(notes) — sync promoted notes into the KB graph.

## 2026-07-28 — Long-press both selected and deleted a log entry
- Symptom: the entry row bound `onPointerDown` to a 500ms timer calling
  `softDelete` directly — no confirm, no undo, no success toast. That is also
  the gesture a touch device turns into `contextmenu`, which
  `SessionLogSelection` uses to enter selection mode, so on a tablet a
  long-press meant to select an entry deleted it. Proved with a held synthetic
  pointerdown: 900ms stamped `deletedAt` and the row vanished silently.
  SS-13 Step 1 explicitly asked for this collision to be resolved; both
  bindings shipped anyway.
- Fix: removed the row long-press delete. Delete moved into the selection
  action bar behind an explicit tap, with an Undo toast. One delete action
  shares one soft-delete txId so Undo restores exactly that set.
- Also in this pass: the write pad draft is parked in localStorage per session
  (it was `useState` only, and the sheet closes on an outside tap, so an
  interrupted sentence was lost silently); `softDelete` now drops the note's
  KB node and `restore` rebuilds it; log entries are excluded from the session
  timeline, where their empty titles rendered as blank chips.
- Surfaces: `SessionLog.tsx`, `SessionLogSelection.tsx`,
  `sessionTimelineAdapter.ts`, `noteRepository.ts`.
- Watch: the KB-node cleanup is currently **latent**, not live — the only
  reachable note soft-delete is log entries, which have no KB node, because
  `NotesGrid` (the one surface with a note delete button) is commented out of
  `SessionScreen`. There is presently no way to delete an ordinary note in the
  app at all. When that surface returns, re-verify the ghost is gone.
- Commit: fix(session-log) — stop long-press deleting entries; keep drafts and
  unclutter the timeline.

## 2026-07-28 — TypeDoc emitted 247 warnings, hiding real doc breakage
- Symptom: `npm run docs` produced 247 warnings. Because that was the steady
  state, a newly-broken link was indistinguishable from the existing noise, and
  documentation genuinely was missing from the generated site: every component
  whose `*Props` interface was unexported rendered as an opaque
  `__namedParameters` with no field list.
- Fix: exported 104 types referenced by public signatures (mostly `*Props`);
  qualified 46 cross-module `{@link}` targets as `module!Symbol | Symbol`;
  delinked 30 references to module-private helpers that can never resolve.
  Config: `excludeExternals` drops React's inherited `Component` members (25
  warnings of pure noise) and the `src/theme/**` exclusion was narrowed, since
  it was hiding `ThemeName`, which `AppSettings.theme` is typed by.
- Wrong doc facts corrected on the way: `PartyPicker` had four `@param` tags
  and inline props with no named interface; three components documented
  destructured props as `@param` tags, which cannot bind to a single
  destructured parameter; `PrintableSheet` referenced a non-existent
  `PrintableSheetScreen`; the timeline linked to `notesToTimeline`, a file
  rather than the `notesToTimelineAdapter` symbol; and
  `descriptorMentionExtension` began a line with a bare `@mention`, parsed as
  an unknown block tag.
- Surfaces: 136 files, +244/-221 — small mechanical edits, no logic touched.
- Watch: a bare `{@link Foo}` only resolves when `Foo` is in the referencing
  file's scope. Linking a type the file does not import silently produces a
  dead link, so prefer the qualified form across modules. `typedoc --emit none`
  now exits 0; keep it there so the next warning means something.
- Commit: docs(typedoc) — take the API docs from 247 warnings to zero.

## 2026-07-28 — Undocumented exports across notes, session log and KB
- Symptom: 31 exported types and components in the notes / session-log / KB
  areas had no doc comment at all. TypeDoc says nothing about this — an
  undocumented export is not a warning, it just renders as a bare signature —
  so it survived the warning cleanup in the entry above.
- Fix: documented all 31, recording the reasoning that is invisible in the
  signature rather than restating the types. The load-bearing ones:
  `linkScanner` (resolved vs missing-record suggestions, why `key` must stay
  stable because settings persist dismissals by it, and that
  `fuzzyMaxDistance` is a cap rather than the threshold); `VaultBrowser` (reads
  `kb_nodes` not `notes`, so a writer that skips the graph sync is invisible
  there, and session mode intersects against live notes); `PromoteMode` (tag
  mode writes no note and therefore no `promoted_into` link).
- Surfaces: `src/features/notes/**`, `src/features/session/sessionLog/**`,
  `src/features/kb/**`.
- Watch: two of the newly-written links were themselves cross-module and
  unqualified, so the doc build went from 0 warnings back to 2 until they were
  fixed. Adding a `{@link}` to a symbol the file does not import needs the
  `module!Symbol | Symbol` form — check `typedoc --emit none` after writing
  docs, not just after changing code.
- Commit: docs(notes,kb) — document the remaining undocumented exports.

## 2026-07-28 — Temp modifiers were written namespaced and read bare
- Symptom: every temporary modifier in the app was inert. Producers write
  namespaced stat keys — `travellerEngine.ts:303/308` and the other two adapters
  build targets with `attrKey`/`resKey` (`attr:str`), and `migrations.ts:87-93`
  rewrites legacy bare keys the same way on every read — but the only two
  production callers of `getEffectiveValue` (`SheetScreen.tsx:606` and `:697`)
  passed a **bare** id, and `derivedValues.ts:248` matches with exact string
  equality. `'attr:str' !== 'str'`, so nothing ever matched. Live and
  user-facing on Dragonbane, which renders the modifier UI; a modifier saved
  before namespacing worked and stopped the moment `upgradeCharacter` rewrote it.
- Why it looked green: `statKeys.test.ts` calls `getEffectiveValue` correctly,
  with `attrKey()`/`resKey()`. The resolver was tested; the call sites were not.
  tsc cannot help — `StatKey` (`types/character.ts:264-268`) ends in `| string`.
- Fix: pass `attrKey(id)` at both call sites, and resolve the modified base
  inside `effectiveCharacteristic` so the Traveller score and its DM badge derive
  from one number rather than two.
- Landed together deliberately. Fixing the call sites alone would have made
  things *worse* on Traveller: the score box would start showing a +1 buff while
  the DM badge, computed from the raw attribute, still read the unbuffed rung.
- Also in this pass: the Traveller characteristics panel now renders the
  modifier-delta badge the Dragonbane panel already had, and shows the damaged
  value explicitly. The box edits the *score* (base + modifiers) while the DM is
  derived from that minus damage — with STR 8 and 5 damage the panel read "8"
  next to "DM −1" and nothing explained the gap, so a player doing their own 2d6
  math off the big number rolled a full DM wrong on every attack.
- Surfaces: `travellerEngine.ts`, `SheetScreen.tsx` (both the Dragonbane
  attributes panel and the Traveller characteristics panel).
- Watch: this is one instance of a class — four producer/consumer key spaces
  exist and nothing asserts a key one side emits is one the other resolves. The
  other three are `derivedFields[].key` vs `derivedStats()`, `timeUnits[].id` vs
  `TempModifier['duration']`, and `outcomes[].id` vs `OutcomeResult`; the last
  two are closed unions with a cast hiding the mismatch. See
  `docs/plans/2026-07-28-traveller-hardening-findings.md` S1.
- Commit: fix(traveller) — apply temp modifiers by namespaced stat key.

## 2026-07-28 — The session log called every Traveller hit "Healed"
- Symptom: `flushResourceBuffer` derived the verb from the sign of the delta
  alone — `diff > 0 ? 'Healed' : 'Took … damage'`. That is right for a depleting
  pool (Dragonbane HP counts down) and exactly backwards for an accumulating
  damage track, where the stored number IS the damage taken. Tapping "+" three
  times on Endurance Damage logged `Kira: Healed 3 END`. `system.json` has
  declared `"direction": "accumulates"` on all three Traveller tracks the whole
  time; nothing read it.
- Fix: `logHPChange` takes an `accumulates` flag, the buffer carries it, and the
  label branches on direction rather than raw sign. The readout now says
  "3/8 END damage" for a track and "5/10 HP" for a pool, so the number is not
  ambiguous either.
- Second half of the same problem: `DamageHealModule` — the only surface that
  applies damage for a damage-track system, since Vitals renders a read-only
  readout — never imported `useSessionLog` at all. So the primary surface logged
  nothing and the secondary one logged the opposite of the truth; between them
  a fight left no usable record. It now logs each application, not debounced,
  because each is one deliberate button press rather than a stepper tick.
- Surfaces: `useSessionLog.ts`, `SheetScreen.tsx` (the caller reads `direction`
  off the system definition), `DamageHealModule.tsx`.
- Watch: `ResourceModule.tsx:36` still gates its own logging on the literal ids
  `'hp'`/`'wp'`. Unreachable for Traveller and SWADE (both take the damage-track
  branch first) but it bites the first pool-based non-Dragonbane system,
  including any user-authored JSON system.
- Commit: fix(session-log) — report accumulating damage tracks as damage.

## 2026-07-28 — Traveller conditions imposed a Dragonbane bane on top of damage
- Symptom: all three Traveller conditions declared `"linkedAttributeId": "end"`.
  That field has one specific meaning — `conditionEffects.ts:22-24`, whose own
  docstring says "(Dragonbane's condition model)", banes every skill linked to
  the same attribute while the condition is active. Traveller's damage track
  already reduces the characteristic, and therefore its DM, so the penalty was
  counted twice: END 7 with 5 damage puts Survival at 17%; ticking "Wounded" —
  which its own description, "Physical damage track is depleted", actively
  invites — dropped it to 5%. Mongoose 2e has no rule imposing a Bane for being
  wounded.
- Fix: dropped `linkedAttributeId` from the three conditions and bumped
  `system.json` to v10. Savage Worlds already declares its conditions without
  the field, so this matches the established pattern for a system that does not
  use the Dragonbane bane rule.
- Nothing else regresses: the field's other six readers use it for display
  grouping only (attribute-panel clustering, printable-sheet grouping,
  abbreviation chips), and Traveller's conditions do not render on the Traveller
  sheet at all — `characteristicsPanel` has no conditions block and the orphan
  fallback lives inside `attributesPanel`, which Traveller never renders.
- Watch: the principled fix is an engine field. Whether conditions bane linked
  skills is a *rule that differs between rulesets*, so by the project's own
  cardinal rule it belongs on the engine rather than being inferred from the
  presence of a data field that means something else in another system. Left as
  data for now because it is the smaller, safer change; a fourth system that
  reuses `linkedAttributeId` for grouping will reintroduce this.
- Also still open: nothing ever *writes* these flags. `applyDamage` returns a
  status but no `setsConditions`, so a knocked-out Traveller shows the
  UNCONSCIOUS banner while `character.conditions.unconscious` stays false and no
  export or printout records it.
- Commit: fix(traveller) — stop conditions double-penalising the damage track.
