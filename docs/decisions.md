
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

## 2026-07-28 — "Recover All" was a one-tap irreversible wipe next to a dead zone
- Symptom: `Recover All` sat immediately right of `Heal` in the identical
  neutral button class. `Heal` is `disabled` whenever the amount field is empty
  and the shared class carries `disabled:pointer-events-none`, so in the common
  state Heal was a dead zone and the first *live* target to its right cleared
  every damage track. No confirm, no undo — and the dashboard autosaves within
  500ms, so recovering meant remembering three numbers.
- Fix: moved it to its own row and made it two-step — the first press arms, the
  second fires, with a Cancel beside it and a five-second auto-disarm so it
  cannot be left hot. Armed state is styled with `--color-danger`; the resting
  state is muted rather than matching Heal.
- Rejected while here: **not** cascading damage through the remaining overflow
  tracks. A wave-4 finding read the single-overflow sequence as an oversight —
  a 20-point hit zeroes END and STR, strands 6, and reports 'down' rather than
  'dead'. But `damageTrack.test.ts` encodes that as deliberate in three tests
  and says so in a comment ("only one overflow target is chosen per hit"); the
  remainder is surfaced as `unassigned` for the player to place. That is a
  design choice consistent with this project's no-bundled-rules stance, not a
  defect. Left alone.
- Surfaces: `DamageHealModule.tsx`.
- Commit: fix(traveller) — arm Recover All before it fires.

## 2026-07-28 — Traveller had no way to add a temporary modifier
- Symptom: `BuffChipBar` and `AddModifierDrawer` were rendered inside the
  `attributesPanel` fragment. Traveller's engine declares `'characteristics'`,
  not `'attributes'`, so that fragment never renders for a Traveller character
  and there was **no entry point anywhere in the app** to record "the stim gives
  you +2 DEX for the scene". Meanwhile `modifiableStats` enumerates Traveller's
  `attr:*` and `res:*` targets and the sheet resolves them — the plumbing ran
  end to end with nothing attached to the front.
- Compounding: the same fragment held the orphan-conditions block, so Traveller's
  conditions were invisible on the sheet too. That mattered more after this
  session's condition fix, which removed `linkedAttributeId` and therefore made
  all three Traveller conditions orphans.
- Fix: extracted `modifierAndConditionExtras` and rendered it from both the
  attributes panel and the characteristics panel. One definition, two mount
  points, no change to the panel map or `panelAvailability`.
- Ordering note: this only became worth doing once temp modifiers actually
  applied — before the stat-key fix earlier today, adding the UI would have
  given Traveller a modifier drawer whose output did nothing.
- Surfaces: `SheetScreen.tsx`.
- Watch: `AddModifierDrawer` still defaults `duration` to the hardcoded
  Dragonbane id `'stretch'`, which is not in every system's `timeUnits`. Traveller
  happens to declare it; Savage Worlds does not, and stores an unexpirable
  modifier as a result. See `docs/plans/2026-07-28-traveller-hardening-findings.md`
  S1.
- Commit: fix(traveller) — give the characteristics panel the modifier bar.

## 2026-07-28 — Skill odds never said which target they assumed
- Symptom: the skill row read "Level 2 · DM +1 · 83%" while the app's own Quick
  Reference rendered all eight Traveller difficulty targets (Simple 2+ through
  Impossible 16+) a scroll away. The percentage is always Average (8+), and
  nothing said so, so at a Difficult (10+) call the honest figure is 42% and the
  screen still shows 83%. For a player rolling physical dice and doing their own
  arithmetic, that is the number they act on.
- Fix: extracted `TRAVELLER_DEFAULT_TARGET` — the target was five bare `8`
  literals across the two surfaces that compute odds — and appended it to the
  display string: "… · 83% vs 8+".
- Not fixed, deliberately: there is still no way to *select* a difficulty. That
  is a UI change rather than a maths one — `twoD6SuccessProbability` and
  `threeD6KeepTwoProbability` have taken `target` as a parameter all along.
  Labelling the assumption is the honest half-step; a difficulty picker on the
  skills screen is the follow-up.
- Verified in the running app: rows read "Unskilled · DM +1 · -3 unskilled ·
  17% vs 8+", and the DMs cross-check against a live buff (DEX 7+2 → +1) and
  live damage (STR 7−2 → −1).
- Surfaces: `travellerEngine.ts`, `travellerEngine.test.ts`.
- Commit: fix(traveller) — state the target the displayed odds assume.

## 2026-07-28 — Global quick-actions read the engine off the active character
- Symptom: `SessionQuickActions` called `useSystemEngine()`, which resolves from
  the *active character*. It is mounted globally from `GlobalFAB`, so it is
  reachable with no active character at all — and `useSystemEngine` falls back
  to `'classic-fantasy'` in that case. A Traveller session with no active
  character rendered Dragonbane vocabulary, a Dragon (1) / Demon (20) outcome
  grid, a Pushed chip Traveller has no mechanic for, and Rest/Death chips it
  should not offer — then logged Dragonbane outcome ids into that session's
  notes. Subtler and worse with a Dragonbane PC active from another campaign:
  plausible-looking and still wrong.
- Fix: `useSystemEngineFor(activeCampaign?.system)`, matching the peers that
  already got it right (`SessionScreen`, `CombatEncounterView`,
  `ParticipantDrawer`) and the contract stated in `engine/index.ts:88-95` —
  session-layer screens are scoped to a campaign, not to whoever is active.
- `CombatTimeline` was flagged alongside it and deliberately **left alone**. It
  already consumes `useActiveCharacter` and drives `AbilityPicker`/`SpellPicker`
  from that character's own abilities, so resolving its vocabulary from that
  character's system is defensible; it is unusable without a character anyway.
  Changing it would have been applying the finding by pattern-match rather than
  by argument.
- Surfaces: `SessionQuickActions.tsx`.
- Commit: fix(session) — scope quick-action vocabulary to the campaign.

## 2026-07-28 — Derived resource maxima offered a stepper that reverted itself
- Symptom: in edit mode the sheet rendered max ± steppers for every resource,
  including those declaring `derivedFrom`. `useSyncedResourceMaxima` rewrites
  such a max back to its source attribute on the next render, so the number
  flashed and snapped back and each tap burned an autosave. It converges, so it
  is not a loop — it is worse than that: an offered control that does nothing,
  which reads as a broken sheet.
- Fix: `maxEditable={resourceMaxEditable && !def?.derivedFrom}`. A derived max
  now renders as the read-only "/N" it actually is.
- Affects Traveller (all three damage tracks) and Dragonbane (hp/wp) — both
  declare `derivedFrom`, and both were already inert, so this removes a lie
  rather than a capability. Resources without `derivedFrom` (Savage Worlds
  Bennies) keep their steppers.
- Verified in the running app: no `... max` steppers remain on the Traveller
  sheet, and all six current-value steppers are still live.
- Surfaces: `SheetScreen.tsx`.
- Commit: fix(sheet) — stop offering a stepper for a computed maximum.

## 2026-07-28 — Outcome ids were engine data pretending to be a closed union
- Symptom: `SkillCheckEditDrawer` never touched the engine. Its result grid was
  the literal `['success','failure','dragon','demon']` and its chips were
  Boon/Bane/**Pushed**. Opening a logged Traveller check showed four Dragonbane
  buttons with **none selected** (an `exceptional-success` matches none of them)
  and offered a modifier Traveller has no mechanic for. Editing a Traveller
  check correctly was impossible.
- Correction to the review that found this: it reported that pressing Save
  silently downgraded the stored outcome to `'success'`. It does not — the
  effect at `:50-57` restores `data.result` on open and `readOutcomeTypeData`
  *casts* rather than validates (`(data.result as OutcomeResult) ?? 'success'`,
  and `??` only fires on null/undefined), so a stored `exceptional-success`
  survives open→save untouched. The value is corrupted only if the user taps a
  result button. Severity was Critical on that report; it is Important.
- Fix: `OutcomeResult` is now `string` and `OutcomeMods` is
  `Record<string, boolean>`, and the drawer renders `engine.outcomes` and
  `engine.rollModifiers`, colouring buttons by the outcome's `tone` rather than
  by matching its id. This removes the `as OutcomeResult` cast at
  `QuickLogPCTray` — which carried a comment acknowledging the mismatch — and
  the hand-built three-flag `storedMods` object beside it.
- Same cluster, also fixed: logged titles printed the machine id.
  `formatOutcomeTitle` now resolves labels from an optional vocabulary, so the
  timeline reads "— Exceptional Success" rather than "— exceptional-success".
  It only looked acceptable because Dragonbane's ids happen to be English words.
  Unknown ids fall back to a humanised form, so a row logged under a system that
  has since been edited still reads.
- Tests: `formatSkillCheckTitle.test.ts` is new — the module had none — and
  covers label resolution, vocabulary ordering, the unknown-id fallback, legacy
  field names, and that `readOutcomeTypeData` preserves an id outside the old
  four.
- Watch: this is the third of the four producer/consumer key spaces from S1.
  The remaining one is `derivedFields[].key` vs what `derivedStats()` returns.
- Surfaces: `formatSkillCheckTitle.ts`, `SkillCheckEditDrawer.tsx`,
  `QuickLogPCTray.tsx`, `SessionQuickActions.tsx`.
- Commit: fix(session) — drive logged outcomes from the engine's vocabulary.

## 2026-07-29 — `visible: false` is not "off by default" on a timeline track
- Symptom: the session timeline's new Log lane was listed in the Tracks menu as
  Off and could never be switched on. Toggling it did nothing.
- Fix: `visible` means "may this track render at all" — `useTimelineLayout`
  drops `!track.visible` rows, and `useTimelineState.toggleTrack` recomputes
  `visibleTrackIds` with the same gate, so un-hiding left the track in neither
  list. Added an explicit `defaultHidden?: boolean` to `TimelineTrack` for
  "start switched off but stay switchable"; `hiddenTrackIds` is authoritative
  once a track has been classified. The catalog's `log` entry is now
  `visible: true, defaultHidden: true`.
- Surfaces: `components/timeline/types.ts`,
  `components/timeline/config/defaultTimelineTrackCatalog.ts`,
  `features/session/sessionTimelineAdapter.ts`,
  `features/session/SessionTimelinePanel.tsx`.
- Watch: a track must take its `defaultHidden` default exactly **once**.
  `SessionTimelinePanel` tracks that in a `useRef` set, not from filter state —
  tracks arrive asynchronously (notes load after mount), and the shared hook
  prunes `hiddenTrackIds` against the current track list, so deriving
  "already classified" from state raced and the lane came up expanded. Any new
  consumer of `defaultHidden` needs the same once-only guarantee.
- Commit: converge(pass-1) — make the Log lane reachable.

## 2026-07-29 — A percentage-height child of `<main>` must not re-subtract its padding
- Symptom: `/session/log` wasted ~140px of vertical space below the WritePad —
  on the one screen where vertical space is the entire product.
- Fix: `SessionLog`'s root used `h-[calc(100%-140px)]` to "account for"
  `ShellLayout`'s `<main className="... pb-[140px]">`. Under `box-sizing:
  border-box` that padding is already inside main's height, so main's content
  box is `H - 140` and a `h-full` child measures exactly that — scroll height
  equals client height and main never scrolls. The calc subtracted it twice.
  Now `h-full`.
- Surfaces: `features/session/sessionLog/SessionLog.tsx`.
- Watch: the tempting mental model ("padding is added after the child") is
  wrong for percentage heights under border-box. Verify with
  `main.scrollHeight === main.clientHeight` in the running app rather than by
  reasoning; measured 2464 === 2464 at 1600×2560.
- Commit: converge(pass-1) — stop wasting 140px on the log route.

## 2026-07-29 — A "classified once" ref must be pruned, or a returning track comes back wrong
- Symptom: the session timeline's Log lane is meant to start switched off. It
  did on first render, but came back **expanded** after the track left and
  rejoined the dataset — reviewing a session with entries, ending it, starting a
  fresh one, then committing its first entry. `SessionScreen` renders
  `ActiveSessionContent` and `SessionTimelinePanel` without a `key`, so
  switching sessions swaps the dataset without remounting the panel and the
  bookkeeping survives.
- Fix: `classifiedTrackIdsRef` recorded which tracks had already taken their
  `defaultHidden` default, but only ever grew. `hiddenTrackIds` is recomputed
  from the *current* dataset each pass, so a departed track silently dropped out
  of it while staying in the ref; on return it read as already-classified and
  fell through to "not in hiddenTrackIds, therefore visible". The ref is now
  pruned to the live track set each pass, so a lane that leaves and returns is
  classified afresh.
- Surfaces: `features/session/SessionTimelinePanel.tsx`,
  `components/timeline/hooks/useTimelineState.ts` (`buildInitialFilterState`
  also now honours `defaultHidden`, which it ignored — any *uncontrolled*
  `TimelineRoot` would otherwise render such a track fully visible).
- Watch: the ref is mutated in the effect body, **not** inside the
  `setTimelineFilterState` updater. React may invoke an updater more than once,
  and a ref write in there lets the second invocation observe the first one's
  bookkeeping and reach the opposite conclusion. Any similar "seen set" needs
  the same treatment. More generally: a first-render check does not prove a
  default holds — verify across a dataset swap.
- Commit: converge(pass-3) — keep the Log lane hidden when a track leaves and
  returns.

## 2026-07-29 — Deleting a UI surface leaves residue three layers deep
- Symptom: five tidying scans over the branch that removed `SessionQuickActions`
  found dead weight the deletion itself never touched: 22 unreferenced files, a
  user-facing Settings panel still called "Quick Log Button" telling users to
  "only log from the Session screen", and a dozen comments describing a surface
  that no longer exists. `tsc -b` was green throughout — `noUnusedLocals` catches
  an unused variable, not an unimported file or a lying comment.
- Fix: deleted 22 orphan files; rewrote the Settings copy and the
  `showGlobalFAB` doc to name the session log and its More-screen fallback;
  re-anchored stale JSDoc in `ShellLayout`, `SessionRefreshContext`,
  `TimelineRoot`, `useNoteActions` and the `pinnedAsStamp` fields; renamed the
  engine's "quick-log palette" phrasing (that feature is live — only the name
  collided); gave the Log lane its own `colorToken`, since it had been assigned
  `--color-danger`, identical to the adjacent Encounters lane.
- Surfaces: 22 deletions across `components/{fields,layout,modals,notes,panels,primitives}`,
  `features/{combat,encounters,kb,notes,session}`, `types/noteValidators.ts`;
  edits in `SettingsScreen.tsx`, `types/settings.ts`, `types/character.ts`,
  `ShellLayout.tsx`, `GlobalFAB.tsx`, `SessionRefreshContext.tsx`,
  `SessionScreen.tsx`, `SessionTimelinePanel.tsx`, `TimelineRoot.tsx`,
  `useNoteActions.ts`, `defaultTimelineTrackCatalog.ts`, `engine/types.ts`,
  `engine/index.ts`.
- Watch: an automated "unused export" sweep is **not** trustworthy on its own —
  it reported `DEFAULT_SESSION_TIMELINE_NOTE_TRACKS` as dead when
  `resolveSessionTimelineTrackKind` uses it in the same file, and would have had
  us delete a live map. Every deletion here was re-verified by grepping for
  actual import specifiers first. Four candidates were deliberately **kept**:
  `NotesGrid`/`NoteItem` (explicit rollback insurance, and the only note-delete
  surface the app has), `notesToTimeline.ts` (spec forbids touching it),
  `renderCampaignIndex.ts` (unreferenced, but that looks like an export-pipeline
  gap rather than dead code) and `SpellCard.tsx` (a live TypeDoc `{@link}`
  target). Also still open: `SuggestedLinksPanel`'s `onCreateNote` prop is never
  supplied by any caller, so its "Create note" button is a permanent no-op —
  that is a wiring bug, not dead code.
- Commit: tidy — remove dead code and stale references to the deleted
  quick-action surface.

## 2026-07-29 — A tidy pass replaced stale comments with confidently wrong ones
- Symptom: an audit pass told to verify **every factual claim** in the previous
  commit's comments — by grepping, not reading — found two that were simply
  false, both written during a sweep whose stated purpose was removing
  inaccuracy. `useNoteActions` claimed its `syncNote` call existed for
  "auto-logged skill checks, HP changes, rests"; that hook's `createNote` has
  exactly one caller (`NoteEditorScreen`), and auto-logging never touches it —
  `useSessionLog` writes `db.notes.add()` directly in its own Dexie transaction
  and fires its own `syncNote`. (This line itself said "writes via
  `noteRepository`" until converge pass 10 — the correction to a false comment
  was recorded here in a form that was also false. Third revision.)
  `SessionRefreshContext` claimed mutating components call `bumpSessionNotes`;
  it had **zero** call sites anywhere.
- Fix: both comments rewritten against the actual call graph. `bumpSessionNotes`
  removed outright — dead API, not just a wrong doc; `sessionNotesRefreshToken`
  is only ever advanced through `bumpAll`. Also qualified `Ability.pinnedAsStamp`
  ("read by the magic list" is true only for `type: 'spell'` rows) and corrected
  `GlobalFAB`'s opening line, which claimed it "appears on every route" three
  lines above the two early returns that prove otherwise.
- Surfaces: `useNoteActions.ts`, `SessionRefreshContext.tsx`, `character.ts`,
  `GlobalFAB.tsx`, plus three JSDoc blocks still naming `CombatTimeline` and
  `SessionBar` after those files were deleted.
- Watch: a stale comment and a false comment fail the same way, and rewriting
  prose feels safe enough that nobody re-checks it. If a comment asserts "X is
  read by Y" or "callers do Z", grep it before committing. Also: the spec itself
  was corrected here rather than the code — it prescribed `visible: false` for
  the Log lane, which converge pass 1 proved makes the lane permanently
  unreachable, and a Must-Not said "MUST NOT touch the system engine" when what
  was meant was "MUST NOT change its behaviour". When implementation and spec
  disagree, establish which one is wrong before editing either.
- Commit: converge(pass-6-7) — correct false comments, drop dead
  bumpSessionNotes, fix stale spec.

## 2026-07-29 — Deleting a log entry orphaned its `promoted_into` edge
- Symptom: `SessionLog`'s delete path soft-deleted the note and nothing else.
  A promoted entry carries a live `promoted_into` edge to a note that is still
  active, so the edge outlived the entry. Export then shipped an `entityLink`
  whose `fromEntityId` names a note the bundle excludes (collectors read notes
  through `excludeDeleted`, but pull links for the *live* target), and the merge
  engine inserts links verbatim with no referential check — a round-trip
  produced a permanently orphaned edge. Undo appeared to work only because the
  edges were never deleted in the first place.
- Fix: cascade `entityLinkRepository.deleteLinksForNote(id, txId)` before
  `softDelete`, under the same transaction id — matching
  `useNoteActions.deleteNote`, which had always done this. Sharing the txId is
  also what makes Undo restore the edges, via `restoreLinksForTxId`.
  Verified live: entry and edge both carry `deletedAt` and the same
  `softDeletedBy`.
- Surfaces: `src/features/session/sessionLog/SessionLog.tsx`.
- Watch: two delete paths for the same entity type existed and only one
  cascaded. When adding a delete path, diff it against the established one
  rather than writing it fresh — `softDelete` alone is never the whole
  operation for an entity that owns edges.

## 2026-07-29 — An executable check in a phase spec would have reverted a fixed bug
- Symptom: `docs/specs/notes-overhaul-completion/sub-spec-4-timeline-log-lane.md`
  still prescribed `visible: false` for the Log lane after converge pass 1 proved
  that mechanism makes the lane permanently unreachable and replaced it with
  `defaultHidden`. The master spec was corrected; the phase spec was not. Its
  `[STRUCTURAL]` gate — `grep -q "visible: false" … || exit 1` — was run and
  **failed against correct code**. `/forge-run` and `/forge-converge` read the
  phase spec, not the master, so a re-run of SS-04 would have "fixed" the code
  back to the broken mechanism.
- Fix: rewrote the phase spec's C-1 rationale with an explicit "do not restore
  that" note, inverted the gate to assert `defaultHidden: true` **and** the
  absence of `visible: false`, added gates for the `types.ts` declaration and
  the `useTimelineState` seeding, and corrected the Files list and `git add`
  step, which named only 3 of the 6 files the change actually needs. Also
  corrected both copies of the red-team report, whose C-1 Resolution still
  recorded `visible: false` as the accepted fix.
- Surfaces: `sub-spec-4-timeline-log-lane.md`, both `redteam-report.md` copies,
  and the master spec's SS-06 `docs/`-tracking Decision (which claimed files
  under `docs/` are "never tracked by git" — 28 are, via force-add, including
  the `decisions.md` this hook makes us commit every pass).
- Watch: a spec is executable here, not just descriptive. When a converge pass
  corrects a mechanism, grep every artifact that encodes it — master spec, phase
  specs, red-team reports, and any embedded check command — or the next
  automated run silently undoes the fix. Correcting only the prose is worse than
  useless: the gate still enforces the old behaviour.
- Commit: converge(pass-8-9) — cascade log-entry edges, unstick the phase spec.

## 2026-07-29 — "It can't be atomic" was wrong, and the whole defect chain hung off it
- Symptom: three consecutive fixes to log-entry deletion each introduced a new
  defect. The root was a comment asserting the loop could not be wrapped in a
  Dexie transaction because `noteRepository.softDelete` awaits a dynamic
  `import()`. It does not: `softDelete` opens no transaction and the KB cleanup
  is fire-and-forget `.then()`. `restore` had been wrapping the identical
  note+edges pair in `db.transaction` since long before. Atomicity was available
  the entire time; believing otherwise forced a non-atomic loop, and every
  subsequent defect — half-deleted state, an unreachable Undo, an unguarded
  `refresh` that surfaced as an unhandled rejection — was downstream of it.
- Fix: `noteRepository.softDeleteWithLinks` removes a note and its edges in one
  transaction. Put in the repository, not the component, because CLAUDE.md
  forbids UI touching Dexie tables — and because the two-call form has no safe
  failure order: stopping after the links leaves a live note that has lost its
  `promoted_into` provenance and **cannot** be repaired (`restore` no-ops on a
  live note, so `restoreLinksForTxId` is unreachable), while stopping after the
  note leaves a dangling edge that exports into a bundle excluding its target.
- Surfaces: `noteRepository.ts`, `sessionLog/SessionLog.tsx`.
- Watch: a wrong explanation is more expensive than no explanation. This one
  read as authoritative, so four passes accepted it and built on it. When a
  comment says "we can't do X because Y", verify Y — especially when a sibling
  function in the same file already does X.

## 2026-07-29 — Every spec correction this branch made was uncommitted
- Symptom: an audit compared the commit messages against `git show --stat` and
  found them describing files the commits did not contain. `docs/` is
  gitignored; only 28 files under it are tracked, via force-add. The master
  spec, all six phase specs, both red-team reports, the design doc and every
  converge artifact were **untracked** — so eight passes of spec corrections,
  including the phase-spec gate whose stale version would have reverted a fixed
  bug, existed only in the working tree and would vanish on a fresh clone.
- Fix: force-added the spec/plan/converge set for this work, matching the
  existing precedent for the 2026-07-27 session-log docs.
- Surfaces: `docs/specs/**`, `docs/plans/**`, `docs/converge/**`.
- Watch: `git add -A` silently skips gitignored paths, and a commit message is
  not evidence. If a commit claims to change a file, `git show --stat` should
  list it — the discrepancy is invisible unless something checks. Note also that
  a *tracked* file inside a gitignored directory keeps working normally, which
  is exactly why the problem hid: `docs/decisions.md` committed on every pass
  while everything beside it was dropped.
- Commit: converge(pass-12) — make log-entry deletion atomic, correct a false
  rationale.

## 2026-07-29 — Approving a wikilink suggestion always persisted it unresolved
- Symptom: the link scanner exists to turn a typed name into an edge to the real
  character, creature or note. It resolved correctly — `applySuggestionToBody`
  builds a `wikiLink` node carrying `suggestion.target.entityId` — and then
  `PromoteEntriesSheet` did `setApprovedText(docToText(updatedBody))`, flattening
  the doc back to `[[label]]` text. `createNoteAndPromote` re-parsed it with
  `textToDoc`, which cannot recover an id and hardcodes `id: null`. **Every**
  approved link persisted unresolved, so `linkSyncEngine` minted an
  `unresolved-<label>` placeholder node instead of an edge. The feature's entire
  output was discarded one line after being computed.
- Fix: carry the ProseMirror doc end to end — `approvedBody` instead of
  `approvedText`, `promoteEntriesToNewNote` takes a body doc, and "Add to
  existing" concatenates the two docs instead of flattening both to text (which
  had also been destroying ids already present in the target note). `textToDoc`
  now returns `ProseMirrorNode` rather than `unknown`; the `unknown` return is
  what let a text/doc mixup type-check for as long as it did.
- Surfaces: `PromoteEntriesSheet.tsx`, `SuggestedLinksPanel.tsx` (`onApprove`
  now typed to the doc), `textToDoc.ts`.
- Watch: `unknown` on a boundary that carries structure is a place bugs hide.
  Also: an approval computed against one selection is now discarded when
  `entries` changes, since the sheet stays open while the log keeps accepting
  commits.

## 2026-07-29 — The capture screen ate in-progress thoughts
- Symptom: two data-loss paths on the one screen whose premise is that a thought
  written at the table is never lost. (1) Tapping any entry in the list — the
  natural gesture for re-reading one, and the list sits directly above the pad —
  ran `setDraft(docToText(entry.body))` unconditionally, destroying the
  half-written draft *and*, via the park effect on the next tick, its
  localStorage backup. (2) Edit mode had no exit and no indicator: once
  `editingId` was set there was no cancel, no banner, and the label still read
  "Commit", so the next new thought overwrote an existing entry instead of
  adding one. Neither had a confirmation or an undo.
- Fix: tapping an entry now refuses while an uncommitted draft is present and
  says so; a banner plus a "Cancel edit" button make edit mode visible and
  escapable. Separately, `handleCommit` now refreshes *before* clearing the pad
  — clearing first meant a failed re-read showed "failed to save" over an empty
  pad, so the user retyped and produced a duplicate — and `WritePad.commit`
  guards on `committing` at entry, since the disabled button never stopped
  Ctrl/Cmd+Enter or a double-firing stylus.
- Surfaces: `sessionLog/SessionLog.tsx`, `components/notes/WritePad.tsx`.
- Watch: these came from a hardening pass aimed specifically at "how does a user
  lose text", not at spec compliance — the spec was fully satisfied while both
  bugs were live. Remaining known gaps in the same area: two tabs on one session
  share a draft key and clobber each other, committing onto an entry another tab
  soft-deleted succeeds silently into a tombstone, and `textToDoc` round-tripping
  rewrites CRLF and collapses blank runs.
- Commit: harden(notes) — stop losing drafts, and persist resolved wikilink ids.

## 2026-07-29 — Imported notes were invisible, and exports shipped edges the importer destroyed
- Symptom: two halves of the same round-trip were broken independently.
  (1) `mergeBundle` writes straight to `db.notes` / `db.entityLinks` and never
  fires `syncNote`, and `kb_nodes` is not part of a bundle — but the Session
  Notes panel and the whole Knowledge Base read `kb_nodes`. An import therefore
  landed every row correctly and showed the user **nothing** until some
  unrelated action happened to rebuild the graph. (2) Collectors gather links as
  "every edge touching a collected entity" while gathering *entities* by much
  narrower rules — characters only via party membership, notes only within the
  campaign, nothing for a soft-deleted or cross-campaign target. Every edge
  reaching outside that set shipped in the bundle, and the importer's
  `danglingLinkEndpoint` then rejected exactly those, so the relationship was
  destroyed on round-trip and surfaced only as an error count.
- Fix: `useImportActions` runs `bulkRebuildGraph` for the imported campaign
  after a successful merge, non-fatally. New `closeBundleReferences` prunes
  edges whose endpoints the bundle does not carry, and warns with what was
  dropped — so the bundle is honest about what it contains and everything in it
  imports cleanly. Its endpoint-type map deliberately mirrors the importer's
  `LINK_ENDPOINT_TABLES`; if those drift, export and import stop agreeing again.
- Surfaces: `features/import/useImportActions.ts`,
  `utils/export/referentialClosure.ts` (new), `utils/export/collectors.ts`.
- Watch: pruning makes the bundle self-consistent but still loses the edge. The
  better long-term answer is closure by *inclusion* — pull the missing endpoint
  into the bundle — which needs a decision about cross-campaign leakage first.

## 2026-07-29 — Private notes leaked into every Markdown and ZIP export
- Symptom: `applyPrivacyFilter` was wired into the three JSON bundle exports and
  into **none** of the Markdown/ZIP paths. `exportAllNotes`,
  `exportSessionMarkdown` and `exportSessionBundle` rendered
  `visibility: 'private'` notes verbatim into files whose entire purpose is
  sharing. Two export routes, sitting in the same hook, disagreed about what
  "private" meant.
- Fix: new `excludePrivateNotes` predicate (the Markdown paths never build a
  `BundleContents`, so they cannot use `applyPrivacyFilter`). Applied to the
  three bulk paths, and links are gathered only for surviving notes so a private
  note leaves no trace in front matter either. Single-note export is untouched —
  that is an explicit choice about one named note, not a bulk share.
- Surfaces: `utils/export/privacyFilter.ts`, `features/export/useExportActions.ts`.
- Watch: any new export path needs the filter wired in deliberately; there is no
  chokepoint enforcing it, which is exactly how these three were missed.

## 2026-07-29 — The timeline rebuilt itself on every render, and stacked every marker on one lane
- Symptom: `nowValue` was computed inline as `session.endedAt ?? new
  Date().toISOString()` and used as a dependency of the dataset memo, so for any
  live session it was a new string every render and the memo never held. Every
  render rebuilt every track, item and marker and re-derived ~100 log labels
  through `docToText` — and the session screen re-renders at least once a minute
  from its own elapsed timer, plus once per keystroke in the timeline search box.
  Separately, `coerceItemToRange` gives points zero duration, so the free-lane
  test `startMs >= laneEndTime` was trivially true and all 60-100 log markers
  landed on lane 0, overlapping into unreachable diamonds.
- Fix: `nowValue` is memoized against a 60-second tick (and no tick at all for
  an ended session, which has a fixed end). Point items now get a
  `minimumDurationMs` **collision footprint** for lane assignment only —
  rendered position and width are unchanged. The lane sort tiebreak switched
  from `id.localeCompare` to original array order, since ids are random uuids and
  same-millisecond entries were rendering in an order that contradicted the log.
- Surfaces: `features/session/SessionTimelinePanel.tsx`,
  `components/timeline/utils/lanes.ts`.
- Watch: `now` at render resolution is a memo-buster wherever it appears. Also
  still open from the same audit: the viewport is seeded once at mount and only
  self-heals because every commit unmounts `TimelineRoot`, which discards the
  user's zoom and pan.
- Commit: harden(notes) — fix the seven triaged findings.

## 2026-07-29 — E2E suite tested a deleted UI and reported 100% while crashing
- Symptom: `tests/e2e_full_test.py` drove surfaces removed by the notes
  overhaul — the Quick Note / Quick NPC drawers, the 14-chip
  SessionQuickActions toolbar, the SessionLogOverlay FABs, PartyPicker, and a
  "Start Combat" button that never existed under that name. Separately the
  harness scored a crashed iteration as all-PASS: `results["exception"] =
  str(e)` is truthy, and the `exception` key was excluded from the tally, so
  the suite could report a 100% pass rate having barely run.
- Fix: replaced the dead phases with `session_log` (FAB → /session/log, commit,
  draft protection, escapable edit mode), `promote_flow` (right-click select,
  click extend, and the load-bearing assertion that raw entries survive
  promotion), and `timeline_log_lane` (hidden on load AND revealable). Rewrote
  the encounter phase against the real flow: starting one surfaces "Open
  Active Encounter", and the title plus End Encounter live inside the
  encounter view, not on the session screen. Reporting now seeds phases to
  `None`, distinguishes pass / fail / did-not-run, and exits non-zero when an
  iteration crashes; the report file carries the same three-state tally.
- Surfaces: tests/e2e_full_test.py, tests/test_report.txt.
- Watch: a green suite is only meaningful alongside the "Did not run: 0" and
  "Iterations that crashed: 0" lines — read those before trusting a pass rate.
  One console warning is left visible rather than filtered: a Radix
  `DialogContent` without `aria-describedby`, a real unfixed a11y gap.
- Commit: test(e2e) — cover the log-and-promote flow and make the tally honest.

## 2026-07-29 — Approving a second wikilink suggestion unresolved the first
- Symptom: `SuggestedLinksPanel` held its working body as **text** and called
  `applySuggestionToBody(bodyText, …)` per approval, re-serializing with
  `docToText` in between. `docToText` renders a `wikiLink` back to a bare
  `[[label]]` and `textToDoc` re-parses it with `attrs.id = null`, so approving
  two suggestions silently unresolved the first and "Approve all" kept an id
  only for whichever link it handled last. The earlier PromoteEntriesSheet fix
  (persist the doc, not `docToText` of it) was necessary but not sufficient —
  it only held for a single approval, because the panel flattened internally.
- Fix: added `applySuggestionToDoc(doc, suggestion)` — the shape SS-06
  originally specified — and switched the panel's state to a doc. Untouched
  nodes now survive byte-for-byte, ids included. Working structurally also
  makes the double-wrap class unreachable: an applied link is a `wikiLink`
  atom, not the characters `[[…]]`, so a later substring suggestion has no text
  node to match and cannot produce `[[Sir [[Aldric]]]]`.
- Surfaces: features/notes/SuggestedLinksPanel.tsx (+6 tests),
  docs/specs/session-log-note-capture/sub-spec-06-suggested-links-panel.md.
- Watch: the 2026-07-27 converge pass **accepted** the text-in deviation as
  "Low" risk on the grounds that it was "the form verified working end to end
  by the SS-12 Playwright run". That run only ever approved one suggestion, so
  it could not have caught this. A browser-verified path is only evidence for
  the path it actually exercised.
- Commit: fix(notes) — chain wikilink approvals through the doc, not text.

## 2026-07-29 — Two dead buttons in the link panel, and a Tracks menu that outgrew the screen
- Symptom: three separate defects in the suggested-links surface. (a) The
  "Create NPC note" action called an `onCreateNote` prop that **no caller ever
  supplied**, so it was a permanent no-op. (b) The session review sweep rendered
  Approve / Approve all and silently discarded the result — it scans every entry
  concatenated into one body, so an approved span cannot be mapped back to the
  entry it came from and there was nowhere to persist it. (c) The timeline's
  Tracks menu had no bounded height; once a session contained enough note types
  the panel overflowed the viewport, Radix kept repositioning it, and every row
  past the fold — including the Log lane toggle — became unreachable.
- Fix: `onCreateNote` now returns `Promise<string | null>`; the panel awaits it,
  and on an id creates the link so the span resolves. `PromoteEntriesSheet`
  supplies it, creating an empty `npc`-typed stub (an empty body is deliberate —
  inventing content would put words in the GM's mouth). A new `allowApply` prop
  hides the apply actions where they cannot persist; the review sweep sets it
  `false` and keeps Dismiss, which does persist. Both timeline dropdowns are now
  `max-h-[60vh] overflow-y-auto`.
- Surfaces: features/notes/SuggestedLinksPanel.tsx,
  features/notes/PromoteEntriesSheet.tsx,
  features/session/sessionLog/SessionLogSelection.tsx,
  components/timeline/TimelineToolbar.tsx, tests/e2e_full_test.py.
- Watch: (c) was found only because a new E2E phase added one more note type and
  pushed the menu over the fold — the test failed as an unstable-element
  timeout, which reads like a flaky locator. Two test-side "fixes" (`:visible`
  scoping, `scroll_into_view_if_needed`) did not help, which is what showed the
  instability was the app repositioning an overflowing panel. Prefer suspecting
  the app when a locator is never *stable* rather than never *present*.
- Commit: fix(notes) — wire the create-record action and bound the timeline menus.

## 2026-07-29 — The participant drawer contradicted itself about health
- Symptom: `ParticipantDrawer` rendered the literals `HP` / `Armor` / `Mv` on the
  creature-template base-stat tiles while its own editable health field, five
  lines below, already read `engine.labels.participantHealth` — "Current END"
  under Traveller. One drawer, two vocabularies, disagreeing on screen.
- Fix: added `creatureHealth` / `creatureArmor` / `creatureMovement` to
  `SystemLabels` and to all three adapters (Dragonbane HP/Armor/Mv, Traveller
  END/Armour/Mv, SWADE Wounds/Armor/Pace), and mirrored the three keys into
  `schemas/system.schema.ts`. The stale `placeholder="HP"` on the health input
  now uses the same label as its own visible heading.
- Surfaces: features/systems/engine/types.ts, all three engine adapters,
  schemas/system.schema.ts, features/encounters/ParticipantDrawer.tsx,
  features/systems/engine/systemDefinitionSchema.test.ts.
- Watch: the schema is a **hand-maintained mirror** of `SystemLabels` and Zod
  strips unlisted keys, so a new label added only to `types.ts` is silently
  dropped before the engine merge and can never be overridden from
  `system.json`. The schema test now asserts the three new keys survive parsing,
  which is the only thing that catches that class of omission. Note also that
  only the labels are engine-driven: `creatureTemplate.stats` is still a fixed
  `hp`/`armor`/`movement` triple, so a system with a different stat *shape* needs
  a data-model change rather than another label.
- Commit: fix(engine) — source the creature base-stat headings from the engine.

## 2026-07-29 — Only Dragonbane could actually cast
- Symptom: `MagicScreen` and `MagicSpellCard` restated Dragonbane's magic economy
  as literals — `character.resources['wp']`, `powerLevel * 2`, trick costs 1,
  power levels `[1, 2, 3]`, and the string "WP" in five places. `engine.magic`
  (E11) exists precisely to supply all of that, and `MagicModule` already reads
  it correctly. **Any system whose `magic.resourceId` is not `wp` showed 0
  available and could never cast.** Separately `toSpells` projected
  `wpCost: a.cost?.wp ?? 0`, so a spell costing `{ psi: 3 }` read as free.
- Fix: the screen resolves `engine.magic.resourceId` and spends from that pool;
  `MagicSpellCard` takes the `magic` model and `resourceTerm` as props (kept
  presentational — it does not reach for the hook) and derives every cost and
  level from them. `toSpells`/`fromSpell` gained an optional `resourceId`
  defaulting to `'wp'`, so all six existing call sites are unchanged.
- Surfaces: screens/MagicScreen.tsx, components/fields/MagicSpellCard.tsx,
  utils/abilities.ts (+2 tests).
- Watch: Dragonbane's numbers remain as an explicit fallback for a system that
  declares `hasMagic` with a null `magic` model, so the screen degrades rather
  than rendering a card with no power levels. Still open and catalogued: the
  spell edit drawer writes a literal `wpCost: 2` default, and `SpellCard` prints
  the header "WP Cost:".
- Commit: fix(magic) — drive the casting economy from engine.magic.

## 2026-07-29 — One hit could never kill, and being knocked out was never recorded
- Symptom: two defects in the Traveller damage track. (a) `applyDamage` built its
  sequence as `[primary, exactly one overflow]`, so with STR/DEX/END all 7 a hit
  of 20 filled END and STR, **silently stranded the last 6**, left DEX untouched
  and reported `down`. `deadAtDepleted: 3` was therefore unreachable in a single
  application — death needed three separate hits. (b) `result.status` only ever
  fed the on-screen message, so a knocked-out character showed the UNCONSCIOUS
  banner while `conditions.unconscious` stayed false; neither the print sheet nor
  any export recorded that they were out of the fight.
- Fix: (a) the sequence continues through the model's remaining `overflowTo`
  entries after the player's chosen one; the choice still decides which track is
  hit *first*. An out-of-range choice now falls back to the model order rather
  than stranding the damage — losing points silently is worse at the table than
  defaulting. (b) new `DamageTrackModel.statusConditions` declares which
  conditions a status implies, and `statusConditions()` maps status → flags.
  Synced inside `writeResources`, the single choke point for damage, heal and
  Recover All, and computed from the post-write resources so healing out of it
  clears the flag as reliably as the hit set it.
- Surfaces: utils/damageTrack.ts (+10 tests), features/systems/engine/types.ts,
  travellerEngine.ts, features/playDashboard/DamageHealModule.tsx.
- Watch: **three existing tests encoded the bug** and had to be rewritten —
  "reports damage that has nowhere left to go", "ignores an overflow target the
  system does not allow", and "never exceeds a track maximum", the last of which
  asserted DEX stayed untouched "because only one overflow target is chosen per
  hit". That premise was the defect, not the rule. A green suite is no evidence
  when the assertions were written from the implementation. Only ids a model
  claims are ever synced, so a manually-ticked `fatigued` is never touched.
- Commit: fix(traveller) — cascade damage through every track, and record being down.

## 2026-07-29 — The engine contract test could not fail
- Symptom: `engineContract.test.ts` asserted referential integrity of string ids
  *within* one engine object. It never imported a component, never invoked a
  function-valued field (`derivedStats`, `modifiableStats`, `currency.read/write`,
  `attributeBadge` — not once), and never checked which adapter a system resolves
  to. **Every finding in the 2026-07-28 wave-4 report passed it cleanly**,
  including the inert-modifier bug and the damage-cascade bug. Separately
  `TempModifier.duration` was still the closed Dragonbane union
  `'round'|'stretch'|'shift'|'scene'|'permanent'` while its producer
  (`engine.timeUnits`) is engine data, so every consumer cast into it — and
  `AddModifierDrawer` initialised to the literal `'stretch'`, absent from Savage
  Worlds' units, giving a chip reading "+2 stretch" that nothing could expire.
- Fix: `duration` is now `string` (a union that is always cast into asserts
  nothing while reading as safety), and the drawer defaults to `timeUnits[0]`.
  Added behavioural contract assertions — adapter routing via function identity,
  producer/consumer key agreement, capability coherence, and actual invocation of
  the function-valued fields — plus a new `engineConsumers.test.ts` that scans
  source for the consumer-side mistakes no engine-internal assertion can catch:
  a bare id passed to `getEffectiveValue`, a hardcoded time-unit id,
  `panels.includes('rest')` instead of `rest !== null`, and `systemId ===`
  outside the resolver.
- Surfaces: features/systems/engine/engineContract.test.ts (+33 assertions),
  engineConsumers.test.ts (new), types/character.ts,
  components/panels/AddModifierDrawer.tsx.
- Watch: every new assertion was **mutation-tested** — a bogus condition id, a
  lying `hasMagic`, a reintroduced bare-id call and a reintroduced `'stretch'`
  default each make it fail. Adding assertions that pass is worthless here; the
  defect being fixed *was* a suite that passed. The comment stripper is not a
  parser: a breach hidden in a trailing same-line comment is missed, accepted
  against mangling string literals containing `//`.
- Commit: test(engine) — make the contract test capable of failing.

## 2026-07-29 — Dead-code cluster, and the missing configuration selector layer
- Symptom: eight catalogued items, all verified present. `renderCampaignIndex`
  had no caller while every sibling renderer was wired into `useExportActions`,
  so a campaign export shipped a flat pile of notes with no landing page.
  `notesToTimeline.buildTrack` silently dropped `defaultHidden`, so the two
  timeline adapters disagreed about the same catalog entry.
  `applySuggestionToBody` survived with no production caller as a chainable-
  looking function that cannot be chained. `ProseMirrorNode` was declared twice,
  interoperating by accident. `useEncounter.startEncounter` was dead and unsafe —
  it wrote `status: 'active'` with no one-active-encounter check. `SpellCard` was
  entirely unreferenced and carried a hardcoded "WP Cost:". `MagicScreen` still
  defaulted a new spell to `wpCost: 2`. And `TagPicker`/`PartyInventoryTab`
  imported their defaults directly.
- Fix: wired the campaign index into `exportAllNotes`; carried `defaultHidden`;
  deleted `applySuggestionToBody`, `SpellCard` and `startEncounter` (the last of
  which orphaned two hook params and two screen props, also removed);
  `ProseMirrorNode` now has one owner and is re-exported; the spell-cost default
  is `magicModel.costPerLevel`. Added `src/hooks/useConfigurableDefaults.ts` plus
  `config/defaults/tagPresets.ts` and two settings fields.
- Surfaces: features/export/useExportActions.ts, timeline notesToTimeline.ts,
  notes SuggestedLinksPanel/PromoteEntriesSheet, encounters useEncounter +
  EncounterScreen, screens SessionScreen/MagicScreen, components fields
  (SpellCard deleted), notes/TagPicker, party/PartyInventoryTab, types/settings.ts.
- Watch: CLAUDE.md's Configuration Over Hardcoding rule has three steps — a
  default in `config/defaults`, the value in settings, and a **selector** the
  component reads. Only step one existed, so every component that wanted a
  configurable list had no choice but to import the constant; C1 and C2 were
  symptoms of a missing layer, not of two careless components. Any future
  grouping should read through `useConfigurableDefaults`.
- Commit: refactor — wire the campaign index, drop dead code, add a config selector.

## 2026-07-29 — The session-log cluster: four ways capture lost data or state
- Symptom: (S1) two tabs open on one session shared the localStorage key
  `skaldbok-log-draft-<sessionId>` and overwrote each other's in-progress text on
  every keystroke. (S2) `logToSession` early-returns when `activeSession` is
  null, and the flush effect fires *because* the session went null — so
  end-of-combat damage and coin lines buffered in the last three seconds of a
  session were silently dropped; the unmount flush additionally used `[]` deps
  and closed over the mount-time callbacks, flushing into the wrong session
  after a switch. (S3) `text.split(/\n\s*\n/)` only consumed carriage returns
  adjacent to a blank line, so editing an entry typed on a CRLF device
  round-tripped invisible `\r`s into the body. (S4) `setLoading(true)` on every
  refresh swapped `TimelineRoot` for a div, and remounting discarded the
  viewport — committing a log entry threw away the user's zoom and pan.
- Fix: the draft key is now per-tab (id in `sessionStorage`), and a tab with no
  draft adopts the newest orphan left for that session, so closing and reopening
  the app still recovers the text while two live tabs never share a key. Buffers
  record the session they were opened against and `logToSession` takes an
  explicit `options.session`, so a late flush still lands. The unmount flush
  reads its callbacks from a ref — running once, but with current bindings.
  CRLF is normalised before splitting. The timeline placeholder shows only
  before the first load completes.
- Surfaces: features/session/sessionLog/SessionLog.tsx,
  features/session/useSessionLog.ts, features/notes/textToDoc.ts (+2 tests),
  features/session/SessionTimelinePanel.tsx.
- Watch: S2's two halves have opposite fixes and it is worth not confusing them.
  A buffered write needs the session **captured at buffer-open time**, because
  by flush time the active one may be gone. The unmount cleanup needs the
  **latest** callbacks, because `[]` deps freeze them at mount — listing them as
  deps instead would flush on every change, which is not what "on unmount"
  means.
- Commit: fix(session) — stop the log losing drafts, entries and viewport state.

## 2026-07-29 — The data-integrity cluster: reference groups, and a lossy import
- Symptom: (D2) reference sections joined to their card on the card's **title**,
  so two cards named "New Card" shared and clobbered each other's sections and
  neither could be deleted, and renaming a card had to rewrite every section in
  it. (D3) both reference tables hard-deleted — the last two in the app to do so.
  (D4) the envelope schema nests the contents schema, and Zod strips unenumerated
  keys, so parsing discarded every field outside the fixed shape *before*
  per-entity validation ran; only `characters` survived, because it alone is
  typed `z.array(z.record(z.any()))`. (D5) the v7 reference-note migration
  spread a ReferenceNote into `notes` without `campaignId`/`body`/`status`, so
  `baseNoteSchema` dropped it on read. (D6) nothing cross-checked the envelope's
  declared `type` against its contents.
- Fix: schema **v14** adds `groupId` and soft-delete columns, backfilling from
  the title map and materialising real groups for categories the screen used to
  synthesise at render time. The repository soft-deletes with a cascade and a
  `restoreGroup`. A new `bundleEnvelopeParseSchema` keeps `contents` permissive
  for parsing while `bundleEnvelopeSchema` stays strict as the type source. The
  v7 migration fills the required fields, and a scope mismatch now raises a
  warning.
- Surfaces: storage/db/client.ts (+ exported `upgradeReferenceGroupsToV14`),
  types/reference.ts, referenceSectionRepository.ts, screens/ReferenceScreen.tsx,
  types/bundle.ts, utils/import/bundleParser.ts, +6 migration and +4 parser tests.
- Watch: D4 turned out to have a **second** half nobody had recorded — because
  every non-character array was strictly typed inside the envelope schema, one
  malformed row failed the whole envelope parse, so the documented
  warn-and-skip path was unreachable for those types entirely. Fixing the strip
  fixed that too. Also: the migration test imports the **exported** upgrade
  function rather than a copy, since a duplicated migration in a test passes
  happily while the shipped one drifts.
- Commit: fix(data) — key reference groups by id, soft-delete them, stop import stripping.

## 2026-07-29 — Keyboard traps, dead policy, and an ignored print parameter
- Symptom: (A1) fourteen dialogs are built as a bare overlay `<div role="dialog">`
  rather than through the Radix wrappers. Each is visually correct and each is
  missing the same three behaviours — Tab escapes into the page behind, Escape
  does nothing, and focus never returns to whatever opened them. A modal that
  claims to be modal while the page underneath stays reachable is a trap for
  anyone on a keyboard. (A2) note cards in `NotesGrid` were `<div onClick>`,
  mouse-only. (E1) six of the eight `PLAY_MODE_EDITABLE_PREFIXES` had no call
  site — policy that decided nothing, hardcoding Dragonbane resource ids. (L1)
  `PrintableSheetScreen` accepted `?characterId=` and ignored it. (D7) collectors
  gathered characters only via party membership, so an edge to a non-party
  character was pruned on export.
- Fix: new `useModalBehaviour` gives a hand-rolled dialog the focus trap, Escape
  and focus restore Radix would have, applied to the eight whose dialog is the
  component's top-level return. Note cards get `role="button"`, `tabIndex` and an
  Enter/Space handler that ignores keys bubbling from the actions button inside.
  The six dead prefixes are gone. The print route loads the requested character
  directly, so printing a party member no longer means switching the active one
  and switching back. Collectors pull in characters an edge references.
- Surfaces: hooks/useModalBehaviour.ts (new), eight dialog components,
  features/notes/NotesGrid.tsx, utils/modeGuards.ts,
  screens/PrintableSheetScreen.tsx, utils/export/collectors.ts.
- Watch: removing the six prefixes is behaviour-neutral **by definition** — an
  allow-list entry nothing queries cannot change an outcome. The surfaces they
  named (current HP, conditions, weapons) are not gated through this guard at
  all; they are simply always editable. If one ever should be gated, the entry
  alone will not do it — the `useFieldEditable` call has to exist too. Six
  dialogs are still unconverted: their `role="dialog"` is nested rather than the
  component's top-level return, so the same uniform transform does not apply.
- Commit: fix(a11y,export) — trap focus in hand-rolled dialogs, drop dead policy.

## 2026-07-29 — Concurrent KB syncs of one note raced into duplicate edges
- Symptom: every caller fires `syncNote` and forgets it — `noteRepository` starts
  it with `.then().catch(() => {})` from create, update and append — so two edits
  landing close together ran two syncs over the same node at once. Each read the
  existing edge set before either wrote, both concluded the same edges were
  missing, and both inserted them. Result: duplicate `kb_edges` rows and a
  backlink counted twice.
- Fix: `syncNote` chains onto the note's in-flight sync via a per-note map, so
  the read-then-write sequence is atomic with respect to other syncs of the *same*
  note while unrelated notes still run in parallel. The chain links onto
  `previous.catch(…)` so a failed sync does not poison the queue behind it.
- Surfaces: features/kb/linkSyncEngine.ts, +3 tests.
- Watch: B2 (Notes lane collapsed by default) turned out to need **no change**.
  The catalog already sets `collapsed: true` and `sessionTimelineAdapter` —
  the adapter a screen actually mounts — honours it, so it has been live all
  along. I carried `collapsed` into `notesToTimeline` for consistency and a test
  ("does not start any track collapsed") failed: that adapter is the generic one
  used by the mock example, and its contract is deliberately that nothing arrives
  hidden. Reverted. A test that contradicts a change is worth reading before
  assuming it is stale.
- Commit: fix(kb) — serialise KB syncs per note.
