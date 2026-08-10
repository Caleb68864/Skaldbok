
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

## 2026-07-30 — The last six hand-rolled dialogs, and two assertions that proved nothing
- Symptom: six of the fourteen `role="dialog"` overlays were left unconverted in
  the previous pass because their dialog element is rendered conditionally or
  nested inside a backdrop, so the uniform top-level transform did not reach
  them: the portrait lightbox, the session review sheet, the bestiary statblock,
  the participant picker, the start-encounter modal and the stale-session
  warning.
- Fix: all six now use `useModalBehaviour`. Where the element is conditional the
  hook takes the open flag rather than being called conditionally, and where the
  dialog is nested inside a click-away backdrop the ref goes on the **inner**
  panel — trapping focus on the backdrop would enclose nothing. Start-encounter
  passes `undefined` as the closer while submitting, matching the guard its
  backdrop click already had. All 14 are covered.
- Surfaces: CharacterPortrait, SessionLogSelection, BestiaryScreen,
  EncounterScreen, SessionScreen, CampaignContext, tests/e2e_full_test.py.
- Watch: the first two E2E assertions written for this — "focus moves into the
  dialog" and "Escape closes the dialog" — **passed with the hook removed**.
  That modal already had its own Escape effect and an `autoFocus`, so both
  assertions described pre-existing behaviour and demonstrated nothing about the
  change. Replaced with a focus-trap assertion (Tab from the last focusable must
  wrap back inside), which fails with the hook removed and passes with it. Note
  also that the first mutation attempt was itself void: deleting the `ref` left
  an unused variable, the build failed, and the E2E silently ran the previous
  bundle — a green run against a stale `dist` looks identical to a real pass.
- Commit: fix(a11y) — trap focus in the last six hand-rolled dialogs.

## 2026-07-30 — Unresolved wikilink placeholders: three defects in one id
- Symptom: a `[[label]]` with no matching record creates an `unresolved`
  placeholder node keyed `unresolved-${label.toLowerCase().replace(/\s+/g,'-')}`.
  (a) **No campaign in the id.** `[[Ostrand]]` in two campaigns produced one
  shared row whose `campaignId` was whichever synced last, so one campaign's
  edges pointed at a node claiming to belong to the other. (b) **Slugging merged
  distinct labels** — `Sir Aldric` and `Sir-Aldric` both collapsed to
  `sir-aldric`. (c) **Nothing ever revisited a placeholder**: creating the note
  it was waiting for left every earlier reference pointing at the stub, so
  backlinks showed nothing and the graph kept a permanent orphan beside the real
  node. Placeholders were also never reaped, so removing the last link to a name
  left its stub forever.
- Fix: ids are now `unresolved:<campaignId>:<normalised label>` — scoped, and
  built from the label rather than a slug. `absorbPlaceholder` repoints a stub's
  inbound edges onto the real node and deletes it, called when a note *or* a
  character node is upserted. `reapOrphanPlaceholders` drops stubs with no
  inbound edges at the end of each sync.
- Surfaces: features/kb/linkSyncEngine.ts, +5 tests.
- Watch: whitespace is still collapsed and case still folded, because
  `getNodeByLabel` resolves with `equalsIgnoreCase` — the two normalisations
  have to agree or a placeholder could never match the note that resolves it.
  An inbound edge whose source already links to the real node is deleted rather
  than repointed, since repointing would duplicate the edge it becomes. The
  reaper also clears stubs stranded by the id-format change, which are
  unreachable by construction — nothing can link to an id no code generates.
- Commit: fix(kb) — scope, resolve and reap unresolved link placeholders.

## 2026-07-30 — P1 investigated: the screens "ignoring play mode" are not a defect list
- Symptom (as catalogued): "most screens ignore play/edit mode" — CharacterLibrary
  (16 write affordances), NoteEditor (9), Session (8), Trash (5), plus "the
  portrait file-picker is the one input still enabled in play mode (69/70)".
- Finding: **there is almost nothing to fix here, and gating those four screens
  would be a regression.** The original spec scopes play mode to the character
  sheet — "wire mode guards into the Sheet screen as the initial enforcement
  point", allowing HP, WP, death rolls, conditions and equipped state. It locks a
  character's *build* so a mistap at the table cannot rewrite it. Writing notes
  and running a session are what play mode exists *for*; `NoteEditorScreen` and
  `SessionScreen` write no character data at all (verified). `TrashScreen` only
  restores — `hardDelete` has no UI caller anywhere — so there is nothing
  destructive to guard. `CharacterLibrary`'s Delete already goes through a
  confirm dialog and is a soft delete, recoverable from Trash.
- Fix: one line. The hidden `<input type="file">` behind the portrait now carries
  `disabled={!isEditMode}`.
- Surfaces: components/fields/CharacterPortrait.tsx.
- Watch: the audit's counts were **reachability-blind**. The portrait upload
  button is already inside `{isEditMode && (`, so the file input it triggers was
  unreachable in play mode; the two story-beat inputs the same sweep would flag
  sit inside `{isEditMode && (` as well; and the rest-prompt roll input is
  deliberately live, because resting happens during play. Counting raw `<input>`
  elements without checking whether anything can reach them manufactures work
  that does not exist — and here it would have manufactured a regression.
- Commit: fix(sheet) — disable the portrait file input outside edit mode.

## 2026-07-30 — SS-04 worker succeeded without committing
- Symptom: the factory reported `agent SS-04 → success` after 5m16s, then
  immediately downgraded it to `deferred_manual` with
  `worker-success-without-commit`. The work was real and sitting uncommitted in
  the tree: `src/features/notes/ink/` (stroke model, pen-latch state machine, pen
  capability detection, and their tests) plus 93 lines of ink persistence on
  `noteRepository`.
- Fix: verified the output independently before trusting it — `npm run build`
  clean and the 12 new unit tests passing — then committed it in the factory's
  own `factory(SS-04): worker output [factory-managed]` form so the run can
  advance past it.
- Surfaces: features/notes/ink/{strokeModel,penLatch,penCapability}.ts (+2 test
  files), storage/repositories/noteRepository.ts.
- Watch: this is the **second** time this session a factory worker has written
  correct code and skipped the commit — the same gate caught SS-02 during the
  notes overhaul. The orchestrator's commit-advance gate is what makes it
  visible rather than silently lost, so treat `worker-success-without-commit` as
  "inspect the tree", not "the work failed". Note also that the commit is *not*
  bypassed by the decision-log hook despite the `[factory-managed]` tag: that
  bypass requires the committer email to equal `forge.json:git_username`, which
  it does not here, so a real entry is required — this one.
- Commit: factory(SS-04) — worker output.

## 2026-07-30 — The handwriting pad squeezed the entry list out of existence
- Symptom: after the factory built SS-01–SS-06, the E2E crashed in the promote
  phase — `main li button` nth(1) never became clickable, with the sticky
  selection toolbar and the log header both reported as intercepting pointer
  events. Not a test artefact: a user selecting two entries would find the second
  one unclickable, covered by the toolbar their own selection had just opened.
- Fix: two changes. `SessionLog` passed `dockedHeight="28rem"` (448px) where the
  previous default was `14rem`, and SS-01 had turned that prop from a fixed
  height into a **floor** — so the pad could never be smaller than 448px, and on
  a tablet in landscape the header, pen-help panel, pad and toolbar together left
  the list no usable height. The floor is back to `14rem`; auto-grow is what
  delivers the large writing surface, climbing to `maxHeightFraction` of the
  viewport as the user writes. `SessionLogSelection` also now reserves the sticky
  toolbar's own height beneath the list.
- Surfaces: features/session/sessionLog/SessionLog.tsx,
  features/session/sessionLog/SessionLogSelection.tsx.
- Watch: the factory's own verification passed this. Its checks are largely
  structural greps and per-file spec compliance; nothing it runs opens the app
  and clicks a row, so a layout regression that makes a control unreachable is
  invisible to it. The spec even states the constraint this broke — "the list is
  not decoration: tap-to-edit and selection both live there" — and the build
  still violated it while every gate reported green. Run the E2E against factory
  output before believing the run summary.
- Commit: fix(handwriting) — keep the entry list usable beside the writing pad.

## 2026-07-30 — Device test: DirectWriting docks regardless, and Ink was hidden
- Symptom: first real Tab S9 run. Two findings. (a) **The pivotal unknown
  resolves against Approach A**: Samsung DirectWriting docks its panel no matter
  how tall the textarea is, so a taller text pad buys more visible text but never
  the notebook page that was asked for. (b) Handwriting works with **Samsung
  Keyboard** and not with Gboard — which is exactly what `PenHelpPanel` already
  tells the user, so that guidance is now confirmed rather than assumed.
- Fix: `hasFinePointerMedia` probed `matchMedia('(pointer: fine)')`. `pointer`
  describes the **primary** input, which on a touchscreen tablet is the finger,
  so a Tab S9 reports `pointer: coarse` even with an S Pen — the query was false
  on precisely the device the feature exists for. It now probes
  `any-pointer: fine` as well.
- Surfaces: features/notes/ink/penCapability.ts.
- Watch: the Ink toggle is gated on `penAvailable`, so with that probe false the
  toggle only appeared **after** an S Pen touch was observed anywhere on the log
  (`onPointerDownCapture` on the root). The mode that actually delivers a
  full-page writing surface was therefore reachable only by accident — a
  discoverability failure that reads as "the feature doesn't work". Worth
  remembering that a capability probe gating a UI affordance fails *silently*:
  nothing errors, the control is simply absent.
- Watch also: Approach A has now hit its documented ceiling. The design predicted
  this — "if it docks regardless, Approach A's ceiling is much lower and the ink
  layer becomes the primary answer." That is now the position, not a hypothesis.
- Commit: fix(ink) — detect a stylus via any-pointer, not the primary pointer.

## 2026-08-05 — Traveller characteristics are stats, not derived values
- Symptom: the play-dashboard panel showed a bare DM per characteristic ("STR
  -2") under the heading "Derived Stats". At the table a player is asked for the
  score at least as often as the DM, and had to read it off another screen.
  Nothing in the panel is derived in the Dragonbane sense either — a Traveller
  characteristic is authored, and its DM is just how that score reads.
- Fix: `computeTravellerDerivedValues` now publishes `characteristicScores`
  alongside `characteristicDMs`, both taken from a single
  `effectiveCharacteristic` call per characteristic. `DerivedStatsModule` leads
  the tile with the score and shows the DM beside it in muted text.
  `labels.derivedPanel: 'Stats'` renames the panel.
- Surfaces: features/systems/engine/travellerEngine.ts,
  features/playDashboard/DerivedStatsModule.tsx.
- Watch: the score/DM pair MUST stay derived from one number. A screen that
  recomputes the score from `character.attributes` would print a score and a DM
  that disagree the moment the character takes damage — damage in Traveller
  lands on the characteristic itself. That is why the map is published from the
  engine rather than recomputed at the call site.
- Watch also: the render is gated on `characteristicScores` being present, not
  on `systemId`; an engine that publishes only DMs renders modifier-only as
  before. Keep it that way.
- Commit: feat(traveller) — show characteristic score alongside its DM, titled "Stats".

## 2026-08-05 — PWA manifest identity pinned; maskable icon left alone
- Symptom: an installed home-screen shortcut on the tablet lost its icon and
  went blank. Suspicion was that a recent change broke the icons.
- Fix: none needed for the icons themselves — they were never touched. `git log
  --follow` on public/icons/* shows two commits, the most recent long before any
  of this work; the built manifest still lists all three; `png` is in the Workbox
  globPatterns so they are precached. What was actually wrong is device-side: on
  a self-signed LAN origin Chrome cannot mint a WebAPK (Google's WebAPK service
  fetches the manifest and icons server-side and can reach neither a private IP
  nor an untrusted cert), so it falls back to a legacy bookmark shortcut whose
  icon is fetched from the page at add-time — which on a cert-interstitial origin
  comes back empty. Reinstall is the remedy.
- Fix, hardening only: added `id: '/'` to the manifest and made the icon `src`
  paths absolute.
- Surfaces: vite.config.ts.
- Watch: `id` is the important one. Without it an install's identity falls back
  to `start_url`, so it is pinned to whichever LAN IP served it that day; a DHCP
  change mints a *new* app rather than updating the old one. Do not remove it,
  and do not change it — changing `id` has the same effect as never having had
  one.
- Watch also: `icon-maskable-512.png` is still byte-identical to
  `icon-512.png` — no safe-zone padding. This was measured rather than assumed:
  the gold emblem spans exactly 80% of the icon width, which is precisely the
  maskable safe-zone circle, and every launcher squircle is larger than that
  circle. Three attempts at a padded rebuild (shrink-on-flat-fill,
  crop-emblem-on-sampled-fill, crop-on-blurred-backdrop) each left a visible
  rectangle seam, because the plaque interior is a vignette that no flat fill
  matches. Reverted. If this is ever revisited, the fix is a new export from the
  original art with padding baked in, not a composite of the existing PNG.
- Commit: fix(pwa) — pin manifest id and use absolute icon paths.

## 2026-08-05 — Ink capture: palm rejection, draft parking, edit routing, DPR
- Symptom: a scanning pass over everything committed since the 2026-07-29
  sweep — the handwriting feature, which had never been reviewed. Five real
  findings, four fixed here.
- Fix 1, palm rejection: `PenLatch` reset both the per-contact latch and the
  time-based suppression window whenever the active pointer set emptied. The
  set is empty at precisely the moment a pen lifts with no palm down, which is
  the only scenario the window exists for — so `PEN_SUPPRESSION_WINDOW_MS` was
  cleared on every normal stroke and a palm landing 50ms later was accepted as
  ink. Split into `releaseLatch()` (set empties) and `resetAll()` (cancel only).
- Fix 2, draft parking: the text draft was parked to localStorage on every
  keystroke; the ink page was plain React state. Same pad, same
  closes-on-outside-tap sheet, and handwriting is the one thing on that screen
  that cannot be retyped from memory. `ParkedDraft` now carries `ink` + `mode`.
- Fix 3, edit routing: an entry's ink was never read back into the pad. Tapping
  an ink row only set `editingId`, so the next ink Commit replaced that entry's
  page with whatever was on the pad, and a text Commit wrote a body onto a note
  that still rendered as its ink preview — stored but invisible. Tap now loads
  the strokes and switches surface; `handleSelectMode` drops a mismatched edit
  target; `handleInkCommit` re-checks the target itself.
- Fix 4, DPR: the canvas backing store was sized in CSS pixels, so on the target
  tablet every stroke rendered at ~1/2.25 of panel resolution and was upscaled.
- Surfaces: features/notes/ink/penLatch.ts, components/notes/InkPad.tsx,
  features/session/sessionLog/SessionLog.tsx.
- Watch: the latch's three suppression tests all held a *second* touch pointer
  down for the duration, with a comment saying this "isolates the
  suppression-window behavior from the separate 'set empties' reset rule". That
  is how a green suite covered a dead code path for a week — the tests were
  written around the scenario that mattered. The replacement test asserts the
  bare pen-down/pen-up/palm sequence with nothing else touching.
- Watch also: two things left standing. The eraser draws with
  `strokeStyle = '#ffffff'` instead of `destination-out`, which would smear
  white on a dark theme — latent only because no eraser UI is wired; fix it
  before exposing one. And the park effect runs in the same commit as the
  restore effect, before restore's state lands, so it momentarily removes the
  record it just read; it self-heals on the next render and predates this work.
- Commit: fix(ink) — make palm rejection real, park handwriting, route entry edits.

## 2026-08-05 — Engine: stop the template layer failing in silence
- Symptom: an engine-improvement pass, verified against current code rather than
  against the 2026-07-26 audit notes. The theme in what remained was not missing
  capability but missing *signal* — the template layer knew when something was
  wrong and never said so. Same failure mode as the ink feature earlier today.
- Fix 1: `useSheetTemplate` built an `error` for a malformed bundled or cached
  template and both consumers destructured `{ template }` only. A broken
  sheet.json fell back to the built-in order with nothing reported anywhere.
  Both screens now toast it.
- Fix 2: an unrenderable panel key vanished without a word, so a typo and a
  deliberate omission looked identical. DEV warn now separates them — unknown
  key is `warn` ("typo"), known-but-unavailable is `info`. Not a useEffect: at
  that point in SheetScreen we are past the component's early returns, so a hook
  would break hook order on the loading render. Module-level dedupe instead.
- Fix 3: bundled templates are checked by `sheetTemplates.test.ts`, NOT by a
  schema refine. A refine was the original plan and would have been wrong —
  `CardRenderer` supports community components passed in via `componentRegistry`
  at render time, and those are legitimately not `CARD_REGISTRY` keys, so
  rejecting unknown keys in the schema would reject them too. Bundled templates
  ship no registry, so only for those is the key set closed.
- Fix 4: `when` guards are honored on the sheet surface, via the same `GUARDS`
  map the play surface uses. No bundled template uses `when` under `sheet`, so
  this is behaviour-preserving today.
- Fix 5: `resolution` and `currency` deleted from the system schema and from the
  two bundled system.json files that carried them (versions bumped). Both had
  zero readers; the real values live on the engine.
- Surfaces: schemas/system.schema.ts, features/systems/panelOrder.ts,
  features/systems/cards/sheetTemplates.test.ts, screens/SheetScreen.tsx,
  screens/PlayDashboardScreen.tsx, systems/{traveller,savage-worlds}/system.json.
- Watch: the new test was checked against injected typos (`vitalz`,
  `attribbutes`) and failed naming both, before being trusted. Do that with
  every guard test added here — this file records one that passed for a week
  while covering a dead code path.
- Watch also: `SHEET_PANEL_KEYS` must stay a superset of `panelAvailability`'s
  keys in SheetScreen. Nothing enforces that pairing yet; a panel added to the
  screen but not the list renders only when a template names it explicitly.
- Deliberately NOT done, with reasons: opening the `DerivedValues` shape (the
  SWADE build already concluded the extended-object pattern works and the
  refactor is risk with no functional gain); deriving `hasMagic` from
  `magic !== null` (MagicScreen now documents the two as decoupled on purpose);
  panels/currency to data (structural, and its payoff arrives with system #4).
- Commit: fix(engine) — surface template errors, guard bundled templates, drop dead schema fields.

## 2026-08-05 — The sheet's three panel lists now move together or fail the build
- Symptom: `beb6e41` left `SHEET_PANEL_KEYS` as a list a comment *asked* you to
  keep in step with `panelAvailability` and `allPanels`. Three hand-maintained
  lists, no enforcement. A panel added to the screen but not the list rendered
  only when a template happened to name it; a key added to the list with no
  panel rendered nothing. Both are silent.
- Fix: `SheetPanelKey` = `typeof SHEET_PANEL_KEYS[number]`, and both objects in
  SheetScreen are keyed by it (`SheetPanelAvailability` and
  `Record<SheetPanelKey, ReactNode>`). A `Record` over a closed union is missing
  a key *and* rejects an extra one, so all three drift directions are compile
  errors.
- Surfaces: features/systems/panelOrder.ts, screens/SheetScreen.tsx.
- Watch: verified by breaking it in all three directions rather than by reading
  the types — adding `inventory` to the key list failed at BOTH objects
  (TS2741 twice), and adding a `bogusPanel` availability rule failed with
  TS2353. A constraint nobody has watched fail is a constraint nobody knows the
  shape of.
- Watch also: `Object.entries` widens keys to `string`, so the `panelMap` build
  needs one narrow cast back to `[SheetPanelKey, ReactNode][]`. That cast is
  sound by construction and is the only place the union is asserted rather than
  inferred — if it ever needs a second, prefer a typed-entries helper.
- Commit: fix(sheet) — key the panel maps by SheetPanelKey so the three lists cannot drift.

## 2026-08-05 — Autosave's last-chance save, and the session log's render cost
- Symptom: a follow-on sweep for the day's recurring theme — a signal the code
  computes and then drops. Two candidates were investigated; ONE was real.
- Non-finding, recorded because the wrong conclusion is easy to reach again:
  `GearScreen`, `MagicScreen`, `ProfileScreen` and `SettingsScreen` all call
  `useAutosave(...)` bare and discard the return value, which reads like a save
  failing in silence. It is not — `useAutosave` toasts the failure itself
  (`erroredRef` streak-guards it to once per failure, not once per keystroke).
  Those four screens lack only the redundant inline banner Sheet and
  PlayDashboard additionally render. Read the hook, not just the call sites.
- Fix, real: the unmount flush was `saveFn(...).catch(console.error)`. That is
  the most dangerous save path there is — it fires precisely when the user
  navigates away mid-edit, it persists the change made in the final debounce
  window, and nothing retries after it: the component is gone, so there is no
  next tick and no banner left to render. It now toasts. The flush registers
  with an empty dep array, so `showToast` is read through a ref rather than a
  stale closure; `ToastProvider` sits above the routes, so reporting from a
  child's unmount cleanup is safe.
- Fix, perf: `hasInkPayload` was `readInkPage(note).strokes.length > 0` — a full
  validate-and-copy of every point of every stroke, called once per entry per
  render from `renderEntry`, on the surface that stays open for a whole session.
  Replaced by `noteRepository.hasInkPage`, a structural check on `typeData`.
- Surfaces: hooks/useAutosave.ts, storage/repositories/noteRepository.ts,
  features/session/sessionLog/SessionLog.tsx.
- Watch: `hasInkPage` deliberately reports TRUE for a page whose strokes are
  malformed. It is not a validator, and it must not become one — answering false
  would render a handwritten entry as an empty text row, which looks exactly
  like data loss even though the strokes are still on disk. `readInkPage` is
  what drops bad strokes, permissively, after the routing decision is made.
  `inkPayload.test.ts` pins both that and the agreement with `readInkPage`.
- Watch also: the day's real gap is unchanged — there is still no component/DOM
  test setup, so every UI-behaviour fix shipped today (ink draft parking, entry
  edit routing, the mode-switch guard) is verified by reading only. That is the
  investment that stops this pattern, not another sweep.
- Commit: fix(persistence) — report a failed last-chance save, stop decoding ink to ask a yes/no.

## 2026-08-05 — Storage durability: ask to keep the data, and say when it was last backed up
- Symptom: `CLAUDE.md` states the architecture as "treat IndexedDB as the source
  of truth; there is no server reconciliation to defer to" — and the app never
  called `navigator.storage.persist()`. Zero hits in the codebase. Without that
  grant a browser classifies origin storage as best-effort and may evict it
  under storage pressure, with no prompt and no warning. The app was one
  storage-pressure event from losing every campaign and never asked not to be.
  Nothing tracked exports either, so the user had no way to protect themselves.
- Why this is worse here than it sounds: Chrome usually grants persistence
  automatically to an *installed* PWA. This app frequently is not one — it is
  served from a self-signed LAN origin, which Google's WebAPK minting service
  cannot reach, so it commonly runs as a plain bookmark shortcut (see the PWA
  entry earlier today). Asking explicitly is not redundant with installing; it
  is the only reliable path.
- Fix: `storage/persistence.ts` — `ensurePersistentStorage()` called from
  main.tsx before render and deliberately NOT awaited (advisory; must never gate
  first paint). Idempotent, so a granted origin never re-prompts. Plus
  `readStorageEstimate()` for a usage readout.
- Fix: `lastBackupAt` recorded on a completed **campaign** export only, and a
  Data Safety card in Settings showing persistence state, usage, and backup age.
- Surfaces: storage/persistence.ts, config/defaults/backup.ts,
  features/settings/StorageSafetyCard.tsx, main.tsx, types/settings.ts,
  hooks/useConfigurableDefaults.ts, features/export/useExportActions.ts.
- Watch: `lastBackupAt` is written ONLY by `exportCampaign`. A note or session
  export is sharing, not redundancy — recording one would report the campaign as
  backed up when nothing capable of restoring it exists. That is worse than
  tracking nothing, because it is false reassurance. Do not widen it.
- Watch also: `classifyBackup` treats a future-dated timestamp as `never`, not
  as fresh. A clock that moved backwards must not be able to silence the
  warning; failing safe here means over-warning, which is the correct direction.
- Commit: feat(storage) — request persistent storage and surface backup age.

## 2026-08-05 — Tests for the privacy boundary and the storage grant
- Symptom: asked whether `StorageSafetyCard` needed coverage. It does not — its
  risk is `classifyBackup`/`describeBackup`, already tested; the rest is an
  effect setting state and ternaries picking strings, which breaks on every copy
  edit and would catch nothing. But the question surfaced two real gaps.
- Fix 1: `utils/export/privacyFilter.ts` had ZERO tests. It decides whether a
  note marked private leaves the device — filtering the note, entity links
  pointing at it in either direction, and its attachments — across six call
  sites in every export path. Its failure is silent and one-directional: a
  leaked note produces a bundle that looks entirely normal.
- Fix 2: `storage/persistence.ts` (written the same day) had none either. Its
  load-bearing behaviour is the short-circuit that must NOT re-request a grant
  the origin already holds — re-prompting a user who already said yes is how a
  permission gets revoked. That was asserted in a comment and never verified.
- Surfaces: utils/export/privacyFilter.test.ts, storage/persistence.test.ts.
- Watch: BOTH suites were mutation-checked, and that is what earned them.
  Removing the persistence short-circuit failed 2 tests. But removing the
  `fromEntityType === 'note'` guard in the privacy filter failed NOTHING on the
  first attempt — the id-collision test only exercised the `to` side, and the
  guard exists twice. The test was widened to cover both directions and both
  mutations now fail. A test written and passing is not evidence; a test that
  has been watched fail is.
- Watch also: `excludePrivateNotes` defaults to excluding. The default is
  load-bearing — every caller that forgets the second argument must get the safe
  behaviour, not the share-everything one. There is a test pinning exactly that.
- Commit: test(export,storage) — cover the privacy boundary and the persistence grant.

## 2026-08-07 — The full Traveller skill list, and what it exposed
- Symptom: `system.json` shipped 35 skills against Mongoose 2022's 103. Every
  speciality a character actually had — Gunner (Turret), Drive (Wheeled) — had
  to be invented as a custom key, which made it invisible everywhere but the
  print sheet's six "secondary" slots.
- Fix: enumerated all 103 as flat ids across 7 categories. Parent ids now mean
  their first speciality, following the pattern the file already used
  (`gunCombat` = Slug, `science` = Physics), so `gunner` = Gunner (Turret) and
  relinks INT -> DEX. Definition version 12 -> 13.
- Surfaces: src/systems/traveller/system.json.
- Watch: nothing caches a computed DM — every DM is derived at render from
  `character.attributes` + `resources`. The only stale copy is the IndexedDB
  system definition, and `useSystemDefinition` only refreshes on a strictly
  higher `version`. The bump is the whole migration. `sheet.json` has its own
  independent counter and was not touched, so it needed none.
- Watch also: `sensors` is retained as "Sensors (legacy)" rather than deleted.
  Deleting a skill id from the definition does not delete it from any character
  — `SkillsScreen` iterates definitions, so the value would vanish from the UI
  while surviving on the record and reappearing as a raw-id row in print.
  Removing it needs a migration, not an edit.
- Commit: feat(traveller) — expand to the full Mongoose 2022 core skill list.

## 2026-08-07 — Jack of All Trades was decorative
- Symptom: the -3 unskilled DM was a literal constant in both
  `formatSkillDisplay` and `probability.chance`. Jack of All Trades' entire rule
  is to reduce that penalty by its level, and nothing implemented it. Harmless
  at 35 skills; at 103 it overstates the penalty on ~80 rows of a JoT
  character's sheet.
- Fix: `unskilledPenalty(character)` derives it once, floored at 0 so JoT 3+
  cancels the penalty but never becomes a bonus. Both surfaces read it through
  the existing `travellerRollContext` helper, which is what stops display and
  chance disagreeing (they did once). The label now names the penalty actually
  applied — "-1 unskilled", or "no unskilled penalty" — instead of printing a
  -3 the character does not suffer.
- Fix 2: `SkillDisplayContext` gains an optional `skillId`. JoT must not reduce
  its own untrained penalty, or an untrained JoT roll bootstraps off a level it
  does not have. Hardcoding the id in the *Traveller adapter* is correct — an
  adapter owns ruleset facts; the banned `systemId ===` branch is a different
  thing.
- Surfaces: travellerEngine.ts, engine/types.ts, SkillsScreen.tsx,
  playDashboard/SkillModule.tsx.
- Watch: mutation-checked, and the third mutation is why this entry exists.
  Removing the `Math.min` floor failed a test. Removing the JoT self-exclusion
  failed a test. But changing `jot && (jot.trained || jot.value > 0)` to a bare
  `jot` failed NOTHING — because `!trained && value <= 0` implies `value === 0`,
  so the clause could not change any result. It read as a meaningful guard and
  was dead code. It was deleted, not test-covered. A guard no mutation can kill
  is not a guard.
- Commit: fix(traveller) — reduce the unskilled penalty by Jack of All Trades.

## 2026-08-07 — 103 skills needed more than two filter chips
- Symptom: `SkillsScreen` offered only Relevant/All. Adequate at 35 skills;
  "All" is now one unbroken 103-row scroll with no search, and "All" is exactly
  where you go to *add* a skill, so Edit Mode was the unusable case. Play Mode
  was already fine — the relevant filter shows only the character's own rows.
- Fix: collapsible category headings plus a name search. A category opens by
  default when the character actually has something in it, so Edit Mode starts
  as seven headings rather than a wall. An active query forces matching
  categories open — a search must never be filtered behind a collapsed heading.
  An explicit toggle beats both defaults.
- Fix 2: extracted the rules to `features/characters/skillCategoryViews.ts`.
  There is no DOM test setup, so logic left inline in the component is logic
  that cannot be tested; the screen now only renders.
- Surfaces: features/characters/skillCategoryViews.ts (+ test),
  screens/SkillsScreen.tsx. Play dashboard untouched — `SkillModule` already
  had its own "Other skills (N)" collapse.
- Watch: the per-category empty state ("No trained skills in this category")
  is gone. It could only ever render in All mode for a genuinely empty
  category, where its text was a lie. One screen-level message replaces seven.
- Watch also: mutation-checked. Search-forces-open and override-wins each
  failed a test. Computing `relevantCount` from the visible rows instead of the
  full list failed NOTHING and cannot be made to — the `query.length > 0`
  clause already covers every case where the two differ. The code was kept (it
  is the right base if that clause is relaxed) but the doc comment now says
  outright that it is untested, rather than describing it as a guarantee.
- Commit: feat(skills) — collapsible categories and a name search.

## 2026-08-07 — Retiring `sensors` needed a migration, not a delete
- Symptom: `sensors` was never a Mongoose 2022 core skill. The book's
  equivalent, Electronics (Sensors), now ships as `electronicsSensors`, so the
  old id had to go. Deleting it from `system.json` does not delete it from any
  character: `SkillsScreen` iterates the definition, so a stored level would
  vanish from the UI while surviving on the record and reappearing as a raw-id
  row in the print sheet's secondary slots.
- Fix: `migrateCharacterV4ToV5` moves the level into `electronicsSensors`,
  `CURRENT_SCHEMA_VERSION` 4 -> 5, and only then is the id dropped from the
  definition (version 13 -> 14). Order matters — the data moves first.
- Fix 2: merge, don't overwrite. A character holding both keeps the higher
  level and stays trained if either entry was, so the migration cannot cost
  anyone a level. Trained matters independently of level here: trained-at-0 is
  a real Traveller skill, and losing the flag silently re-applies the -3
  unskilled DM.
- Surfaces: utils/migrations.ts (+ test), systems/traveller/system.json.
- Watch: scoped by `systemId === 'traveller'`. `sensors` is a plausible skill
  id for a user-authored sci-fi system and rewriting someone else's data would
  be worse than leaving it. Naming a system inside a *data migration* is not
  the banned `systemId ===` branch — that rule is about ruleset behaviour
  leaking into screens.
- Watch also: mutation-checked, four mutations, all killed — overwrite instead
  of merge, dropping the systemId guard, losing the trained OR, and forgetting
  the `delete`. This is the ladder rung most likely to be copied for the next
  retired skill; the merge semantics are the part worth copying.
- Commit: fix(traveller) — migrate `sensors` into `electronicsSensors`.

## 2026-08-07 — Speciality groups: membership, not hierarchy
- Symptom: skills are a flat list, so nothing knew Gun Combat (Slug/Energy/
  Archaic) are one skill. Traveller grants level 0 in *every* speciality of a
  group when you gain it at 0 — five near-identical rows to enter by hand, per
  group, and the omissions show up as a -3 unskilled DM the character should
  not be taking.
- Fix: `SkillGroupDefinition` on the system + optional `groupId` on
  `SkillDefinition`, populated for all 80 Traveller specialities across 17
  groups (version 14 -> 15). The Skills screen renders a group header per run
  of specialities with an "All at 0" action in Edit Mode.
- Why membership and not `parentId`: there is no parent *row* to hang it from.
  In Traveller there is no plain "Gun Combat" — you always have a speciality,
  which is why this file's convention already makes the bare id mean the first
  one (`gunCombat` = Slug). A parent pointer would have to point at a peer.
  Groups are also declared flat on the system rather than nested in
  `skillCategories`, so a group may span categories.
- Why NOT an engine rollup: `isRelevant` receives only the stored
  `CharacterSkill` — no id, no definition — and `computeValue` only
  `{baseChance, linkedAttributeId}`. Deriving the group baseline needs both
  widened across three adapters. Worse, a derived baseline stops being a fact
  on the record: `PrintableSheet` and the export bundle would each have to
  re-derive it. The action writes real entries instead. Explicit data, one
  tap.
- Surfaces: types/system.ts, schemas/system.schema.ts (+ tests),
  features/characters/skillGroups.ts (+ test), screens/SkillsScreen.tsx,
  systems/traveller/system.json.
- Watch: `trainGroupAtZero` is additive only and returns the *same* bag when
  nothing is missing, so a no-op cannot dirty the record or fire an autosave.
  It never touches a member that already has an entry — including an explicit
  untrained-at-0, which is a player saying "I do not have this" and must not be
  flipped by a bulk action.
- Watch also: Zod strips unknown keys, so `groupId` had to be added to the
  *schema* as well as the type or imported systems would silently lose it while
  bundled ones kept it. There is a test parsing the real Traveller definition
  and asserting the field survives. Mutation-checked: overwrite-instead-of-skip,
  vacuous empty-group completeness, fresh-bag-on-no-op, and dropping the
  schema's group-membership check each fail a test.
- Commit: feat(systems) — speciality groups and a level-0 group action.

## 2026-08-07 — Custom skills existed only as a dead end
- Symptom: Language, Profession, Art and Science are open-ended in Traveller —
  the book prints some specialities and expects the table to invent the rest.
  There was no path at all. No add-skill UI anywhere; `migrateSystem` validates
  a user-supplied system.json but **is never called at runtime** (the only
  `systemRepository.save` callers write bundled definitions), so importing an
  edited system was not a path either. A key that did reach `character.skills`
  rendered only in `PrintableSheet`'s six "secondary" slots, printing its raw
  id as the name, while `SkillsScreen` and `SkillModule` never saw it.
- Fix: `CharacterRecord.customSkills` — the *definition* on the character that
  owns it, values still in `skills` under the same id.
  `resolveSkillCategories` merges them into the system's categories on read, so
  the skills screen, play dashboard and printed sheet all treat them like
  declared skills without any of them knowing custom skills exist. Add/delete
  live in Edit Mode on the skills screen.
- Why per-character and not per-system: "Language (Zhodani)" belongs to one
  Traveller. Editing the shared definition would put it on every character in
  the library — and bump a version counter that force-refreshes everyone's
  cached copy.
- Surfaces: types/character.ts, schemas/character.schema.ts,
  features/characters/customSkills.ts (+ test), screens/SkillsScreen.tsx,
  playDashboard/SkillModule.tsx, components/PrintableSheet.tsx,
  utils/characterNormalization.ts.
- Watch: no migration rung. The field is optional and additive, every read path
  goes through `?? []`, and a record without it is already correct — a rung
  would only stamp a version. `CURRENT_SCHEMA_VERSION` stays 5.
- Watch also: ids are generated, never derived from the name, so renaming a
  skill cannot orphan its stored value. Deleting removes the definition *and*
  the value in one patch — leaving the value behind recreates the exact
  invisible state this fix removes. A custom skill whose `categoryId` no longer
  resolves is filed into a trailing "Custom" category rather than dropped, for
  the same reason: a skill you cannot see is one you cannot delete.
- Watch also: the export path was checked, not assumed. `bundle.ts` types
  characters as `z.array(z.record(z.any()))` and `characterRecordSchema` is
  `.passthrough()`, so custom skills survive export/import. The schema
  enumerates the field anyway — passthrough would let a malformed entry reach
  the UI as a nameless row.
- Commit: feat(characters) — player-authored custom skills.

## 2026-08-07 — Situational characteristics, and the creation cap
- Symptom 1: every skill declares one `linkedAttributeId`, but the rules
  routinely allow another for the circumstance — Persuade with INT when you are
  reasoning rather than charming, Athletics with STR/DEX/END by feat. The
  displayed DM and odds were simply wrong for those rolls, with no way to say
  so.
- Fix: `SessionState.skillAttributeOverrides`, a per-skill characteristic swap,
  set from a select on the skill's own attribute tag. Session-scoped like
  `skillOverrides` — it describes one moment at the table, and persisting it
  would quietly change every future roll of that skill.
- Watch: `SkillModule` now reads it too. It had no reason to care, but leaving
  it out meant the dashboard and the skills screen would show different odds
  for the same roll — the exact split that `travellerRollContext` exists to
  prevent between display and chance. Both surfaces resolve the id once and
  feed everything (abbreviation, DM badge, odds, condition-imposed bane) from
  it.
- Symptom 2: Mongoose caps total skill levels at creation to 3 × (INT + EDU).
  Nothing surfaced the one arithmetic constraint creation imposes.
- Fix: `skillLevelTotal` / `creationSkillCap` on the Traveller derived values,
  declared `surfaces: ['print']`. It is a creation-time check — a permanent
  sheet tile reading "18 / 51" is noise for the rest of a character's life, but
  it is exactly what you want on the sheet you build against. Not overridable:
  it is arithmetic over the character's own data, so an override could only
  ever hide going over.
- Watch: the cap reads *base* characteristics, deliberately. The first attempt
  to mutation-test that failed to kill anything, because the test damaged END —
  and INT/EDU have no damage track, so base and effective are identical there.
  The observable difference is a **temp modifier**: a drug that raises INT for
  a scene would otherwise appear to grant retroactive creation budget. The test
  now buffs `attr:int` and asserts the cap holds while the INT DM moves, so it
  proves the buff is live and the cap ignores it.
- Commit: feat(skills) — situational characteristics and the creation cap.

## 2026-08-08 — Hardening pass 1: `derived:` modifiers were inert
- Symptom: `engine.modifiableStats` offers `derived:movement`, `derived:hpMax`,
  `derived:wpMax` (classic-fantasy) as temp-modifier targets. The picker wrote
  them, the buff bar listed them, and **nothing read them**. `getEffectiveValue`
  is the only consumer of `tempModifiers` in the whole app, and its three call
  sites all pass `attrKey(...)`. Only `attr:` modifiers have ever done anything.
- Root cause: four surfaces render derived stats — the sheet's Derived Values
  panel, the play dashboard, the gear screen's carry limit, and the printed
  sheet — and each reimplemented the override fold slightly differently. None
  folded modifiers. The print sheet's fold also named six Dragonbane keys by
  hand, so any *other* overridable field printed its computed value and ignored
  its override entirely.
- Fix: one `resolveDerivedField(character, derived, field)` in
  `utils/derivedValues.ts`, used by all four. The print sheet now loops over
  `engine.derivedFields` instead of the hardcoded six.
- Watch: order is the rule and is tested. An override *replaces* the computed
  value ("the rules say 10, mine is 12"); a modifier *adjusts* whatever the
  value currently is. So +2 on an overridden 12 is 14, not 12.
- Watch also: a string-valued field (Dragonbane's `+D6` damage bonus) cannot
  take a numeric delta. Modifiers aimed at one are reported in `modifiers` but
  leave `display` untouched — visible rather than silently dropped.
- Watch also: `armor:`, `res:` and `skill:` modifiers are STILL inert. Same
  root cause, different consumers (armour rating is read raw in three places;
  Traveller's `res:*` damage-track targets have no reader at all). Next pass.
- Mutation-checked: dropping modifiers, ignoring the override, ignoring the
  `overridable` flag, and matching on a bare id each fail a test.
- Commit: fix(derived) — apply temp modifiers to derived stats.

## 2026-08-08 — Hardening pass 2: `armor:` and `res:` modifiers were inert too
- Symptom: same root cause as pass 1, different readers. Armour rating was read
  raw in three places — the gear screen, the printed sheet, and Savage Worlds'
  `computeToughness`, where it is real arithmetic and not display. Traveller's
  `effectiveCharacteristic` read `resources[id].current` raw, so every
  damage-track target `modifiableStats` offers did nothing.
- Fix: `resolveArmorRating(character, slot)` for the three armour readers, and
  `effectiveCharacteristic` now reads damage through `getEffectiveValue` under
  `res:<id>` — the same resolver it already used for the score.
- **Behaviour change, deliberate.** A test asserted `effectiveCharacteristic`
  stayed 7 under a `res:dex +2` modifier. That was pinning the bug. The
  namespace exists so `attr:dex` and `res:dex` are *distinct* targets — the
  score versus the damage against it — not so one of them is inert. A
  "Radiation: +2 END damage for the scene" modifier has to reach the END DM or
  the target is decorative. The test now asserts DEX reads 5 while
  `attributes.dex` is still 7, which pins distinctness the way that is actually
  true.
- Watch: both resolvers floor at 0. Negative armour would turn a penalty into a
  bonus for the attacker; negative damage would inflate a characteristic above
  its own score.
- Watch also: a modifier on an *empty* armour slot resolves to 0 rather than
  conjuring a rating from nothing — the slot is checked before the fold.
- Remaining from this class: `skill:` targets. No engine currently offers one
  in `modifiableStats`, so nothing is being written; the resolver supports it
  whenever one does.
- Mutation-checked: both floors, the empty-slot guard, and reverting the
  Traveller damage read each fail a test.
- Commit: fix(modifiers) — apply armor: and res: temp modifiers.

## 2026-08-08 — Hardening pass 3: the net that catches inert modifiers
- Symptom: passes 1 and 2 fixed three instances of one bug — a modifier target
  the picker offers that no consumer reads. Nothing stopped a fourth. The
  existing contract test asserted `Number.isFinite(getEffectiveValue(id).base)`,
  which passes for a key that resolves to nothing, because the resolver returns
  0 for an unknown key. It could not have caught any of the three.
- Fix: "every modifiableStats target changes something the app displays".
  Fingerprints the engine's whole visible output — derivedStats, every
  attributeBadge, every resolved derivedField, both armour ratings, every
  attribute as the sheet reads it, and `skill.display` — then applies a +3
  modifier to each offered target and asserts the fingerprint moves.
- Why a fingerprint and not per-namespace probes: a new namespace or a new
  consumer is covered without editing the test, and the failure message names
  the target and its label. Per-namespace probes would need updating exactly
  when someone adds the thing they are meant to catch.
- Plus a static check that each target names something real for its namespace
  (`attr:` in system.attributes, `res:` in system.resources, `derived:` in the
  derivedStats output, `armor:` one of the two slots the record has).
- **It caught one immediately**: SWADE's `savageTraitPenalty` read
  `resources.wounds.current` and `.fatigue.current` raw, so `res:wounds` and
  `res:fatigue` modifiers were inert — the same bug, in the adapter that
  computes SWADE's core roll penalty. Both now read through the resolver.
- Also: `res:bennies` is no longer offered. Bennies are a pool you spend and
  refresh, not a stat anything derives from, so a temp modifier on them could
  never change a displayed number. Offering a control that silently does
  nothing is the thing this pass exists to stop.
- Watch: `skill.display` was added to the fingerprint because SWADE's penalty
  feeds only the roll line. The contract suite's own note says function-valued
  engine fields were never invoked; that gap is why a penalty affecting every
  trait roll in the system was invisible to it.
- Verified by reverting each of the three fixes in turn: all three are caught.
- Commit: test(engine) — fail when a modifier target changes nothing.

## 2026-08-08 — Hardening pass 4: "HP" in a Traveller encounter
- Symptom: `CombatEncounterView` wrote a literal "HP" into the session log line
  and the participant chip, and both participant-creation forms
  (`EncounterParticipantPicker`, `QuickCreateParticipantFlow`) labelled their
  fields HP/Armor/Movement. `ParticipantDrawer` — opened by tapping a row in
  that very list — already read `engine.labels`, so a Traveller encounter
  contradicted itself between the row and the drawer.
- Fix: the two views read `engine.labels.creatureHealth`.
  `QuickCreateParticipantFlow` stays presentational and takes the three
  headings as a `labels` prop with Dragonbane defaults, since the engine
  belongs to the feature that owns the encounter, not to a form component.
- Watch: only the *words* moved. `creatureTemplate.stats` keys stay
  `hp`/`armor`/`movement` — a fixed shape, and deriving a storage key from a
  label is the thing this project explicitly forbids.
- Fix 2: `vocabularyLeaks.test.ts` scans the encounter and play-dashboard
  surfaces for standalone health nouns in user-visible lines. Deliberately
  narrow — engine adapters are entitled to their own ruleset's words, and a
  broader sweep would drown in false positives and get suppressed rather than
  fixed. The regex requires a word boundary, so `currentHp`, `maxHp` and
  `stats.hp` (deliberately fixed field names) do not match.
- Watch: the guard asserts it scanned more than five files. A lint-style test
  whose glob silently matches nothing is worse than no test.
- Verified by reintroducing the hardcoded chip: caught.
- Commit: fix(encounters) — read the health noun from the engine.

## 2026-08-08 — Hardening pass 5: guard paths that named one ruleset's fields
- Symptom: `useFieldEditable` was asked about `'attributes.str'` and
  `'resources.hp.max'`. Both are strings that *look* specific but mean "any
  attribute score" and "any resource's maximum" — and both name Dragonbane ids
  in shared, system-neutral code. STR is not an attribute in Savage Worlds, and
  Traveller's damage tracks are str/dex/end, so the guard read as though it were
  about one ruleset when it governs a category in every ruleset. `'skills.any'`
  was an invented path with no such field at all.
- Fix: `FIELD_PATHS` in `utils/modeGuards.ts` names the five categories the app
  actually guards, plus the two allowlist literals so they are not retyped at
  each call site. Behaviour is unchanged — none of the five were ever in
  `PLAY_MODE_EDITABLE_PREFIXES`, so they all lock in play mode, which is what
  play mode is for.
- Watch: `modeGuards.test.ts` now fails on any `useFieldEditable('literal')`
  anywhere in `src`. Any string was a valid argument, which is why this drifted
  silently; new questions now have to be added to `FIELD_PATHS` where they get
  a name and a review.
- Watch also: the guard fails *closed* — an undeclared path is not editable —
  and there is a test for that. A prefix match must also not leak
  (`armor.equipped` must not unlock `armor.rating`); tested both ways.
- Verified by reintroducing a literal path: caught.
- Commit: refactor(mode) — name the guarded field paths.

## 2026-08-08 — Polish pass 6: SkillsScreen was doing five jobs
- Symptom: 675 lines. The screen owned the add-a-skill form, the group header
  and its bulk action, the row, the search box, the category collapse, and the
  boon/bane selector — with the add-form's markup inlined in the middle of the
  render, 70 lines before the list it sits above.
- Fix: extracted `AddCustomSkillForm` and `SkillGroupHeader` into
  `components/fields/`. Both are presentational, own no state, and make no
  decisions — the name-collision check needs the character *and* the system, so
  it arrives as a `nameAvailable` prop rather than being recomputed inside.
  675 → 600 lines.
- Deliberately NOT extracted: the skill row. It reads ~15 interdependent values
  (resolved characteristic, DM badge, odds string, three override states, two
  mark flags, editability, custom-skill-ness). A component with fifteen props
  is not more readable than the loop that computes them, and threading them
  costs the locality that makes the row easy to follow. Extraction is a means,
  not a score.
- Watch: no behaviour change, and no test could have proved that — there is no
  DOM test setup. The safety here is that both extracted pieces are pure
  presentational functions whose props are all directly derived from what the
  inlined JSX already read, verified by `tsc` and by re-reading the diff.
- Commit: refactor(skills) — extract the add-skill form and group header.

## 2026-08-08 — Hardening pass 7: `hiddenBuiltIns` failed open in both directions
- Symptom: `itemFields.hiddenBuiltIns` is matched with
  `!hiddenBuiltIns.includes(id)`. That fails **open** twice over. A mistyped id
  (`"durabilty"`) silently leaves the field showing; and an id the schema
  accepts but no component checks does nothing at all. Neither is a type error,
  neither warns. The valid ids existed only as prose in a doc comment.
- Fix 1 (author side): `WEAPON_BUILT_IN_FIELD_IDS` / `ARMOR_BUILT_IN_FIELD_IDS`
  in `types/system.ts`, and the schema now uses `z.enum` over them instead of
  `z.array(z.string())`. A typo is a load-time validation error.
- **Fix 2 (consumer side), a real bug**: the schema advertised armour `weight`
  as hideable and `GearScreen` never checked it, so a system declaring it
  hidden still got the field. Now guarded like `bodyPart` and
  `movementPenalty`. Traveller happens not to hide it, so nothing was visibly
  broken — the contract was.
- Watch: the test pins **both** directions. One half asserts the schema rejects
  a typo; the other walks the three consumer files and asserts every id the
  schema accepts is actually guarded somewhere. A capability that validates but
  does nothing is the failure mode a schema-only test would have missed — it is
  exactly what fix 2 was.
- Watch also: the weapon-side check accepts either a direct `shows('id')` call
  or membership of `WeaponEditor`'s filtered field array, because four of the
  nine are guarded through that array rather than individually.
- Verified by un-guarding armour weight again: caught.
- Commit: fix(gear) — validate and honour hiddenBuiltIns.

## 2026-08-08 — Pass 8: `skill:` was the last dead namespace
- Symptom: `skill:<id>` was the one stat namespace with neither a producer nor a
  consumer. "+1 Gun Combat while the scope is on" / "−2 Stealth in this armour"
  is among the most common things a GM calls for mid-scene, and there was no way
  to express it. Every surface read `character.skills[id].value` directly.
- Fix: `resolveSkillValue(character, skillId, storedValue)`, wired into the
  skills screen and the play dashboard. Traveller now offers every skill as a
  modifier target, grouped by category.
- **Savage Worlds deliberately does not offer them.** A SWADE trait value is
  die *sides*, so a "+2" would silently mean a die step (d6 → d8), which is not
  what a SWADE bonus is — those are flat modifiers on the roll, which the engine
  already models through `savageTraitPenalty`. Offering the target would have
  been a control whose meaning differs from what the ruleset means by a bonus.
  Dragonbane is left out for now too: a roll-under target is unambiguous, but it
  is a live ruleset and this change did not need to touch it.
- Watch: **the value input binds to the STORED level, never the effective one.**
  Binding it to `effective` would write a temporary buff back as the character's
  real level the instant the field was touched — a scene-long +1 baked in
  permanently. The modifier shows as a separate `→N` chip beside the input, with
  the contributing labels in its title. `resolveSkillValue` keeps `base` and
  `effective` separate specifically so the two bindings cannot be confused, and
  there is a test pinning that.
- Watch also: the contract-test fingerprint gained every declared skill, so the
  new targets are covered by the pass-3 net rather than trusted.
- Verified by un-wiring the dashboard and blanking the fingerprint's skill list:
  caught (2 failures).
- Commit: feat(modifiers) — per-skill temporary modifiers.

## 2026-08-08 — Pass 10: sheet templates promised panels that never rendered
- Symptom: `sheetTemplates.test.ts` validated that a `sheet.json` key is a
  *real* panel key. It could not ask whether *that system* can ever show it, and
  the screen answers that by silently dropping the panel behind a DEV-only info
  log. So a template could promise a section the app had never once rendered.
- Found four dead keys across two systems:
  - Traveller `attributes` — its engine declares `characteristics`, the same
    panel under the ruleset's own noun.
  - Traveller `rest` — its `rest` model is `null`, which is exactly how a
    ruleset with no rest procedure hides the panel.
  - Traveller **and** Savage Worlds `derived` — the panel exists to *override*
    derived stats, and both engines' only overridable field
    (`encumbranceLimit`) is surfaced on dashboard+print, not sheet. Neither has
    a sheet Derived panel. I did not spot this one; the test did.
- Fix: `sheetPanelAvailability(engine, runtime)` extracted from `SheetScreen`
  into `panelOrder.ts`, so the test asks the same question the screen answers
  rather than restating it. Dead keys removed; traveller sheet.json 6 → 8,
  savage-worlds 3 → 4.
- Watch: `ships` is exempt from the check. It is gated on the character owning
  one at runtime, not on the engine, so a template may legitimately list it —
  the availability helper takes it as a flag with a permissive default.
- Watch also: this checks the *sheet* surface only. The play surface's `derived`
  is a card, not a panel, and is guarded by its own `when` expressions — the
  Traveller template's `abilities`/`magic` cards are correctly gated behind
  `when: hasMagic` and are inert by design, not dead.
- Commit: fix(sheets) — drop panel keys the engine never provides.

## 2026-08-08 — Pass 11: Savage Worlds' declared-but-unread rule
- Symptom 1: `damageTrack.penaltyPerLevel: -1` was read by **nothing**. It
  stated the rule that `savageTraitPenalty` separately hardcoded, so editing the
  declaration would have changed no behaviour while looking as though it had —
  the same "config that reads as policy and decides nothing" removed from
  `modeGuards` in pass 5. `levels: 3` and the penalty's own `Math.min(..., 3)`
  were likewise the same number written twice.
- Fix: `SAVAGE_PENALTY_PER_LEVEL` / `SAVAGE_MAX_WOUND_LEVELS` /
  `SAVAGE_MAX_FATIGUE_LEVELS` as one source, consumed by both
  `savageTraitPenalty` and `damageTrack`. The declaration is now the number the
  penalty actually applies.
- Symptom 2: SWADE returned `movement: 6` — Pace's value under Dragonbane's
  name. Not read, because SWADE does not declare `movement` in `derivedFields`…
  until a system cloned from this adapter does, at which point it prints a Pace
  nobody computed. Exactly the landmine Traveller's old `hpMax: END` was, and
  the Traveller adapter's comment already warns about it.
- Fix: `movement: 0`, plus a contract test — a mandated `DerivedValues` key an
  engine does **not** declare in `derivedFields` must be neutral (0 / '+0').
  Declared keys are exempt, so Dragonbane's real `movement` is untouched.
- Watch: the neutrality test is per-system *and* per-key, so a failure names
  both ("Savage Worlds > movement") rather than pointing at a whole adapter.
- Mutation-checked: restoring `movement: 6` fails exactly one test; flipping
  `SAVAGE_PENALTY_PER_LEVEL` to +1 fails two existing SWADE penalty tests,
  which is the proof the constant is genuinely wired rather than decorative.
- Commit: refactor(swade) — wire the wound penalty, neutralise the placeholder.

## 2026-08-08 — Pass 12: `allowsPlus` promised d12+1 and delivered nothing
- Symptom: `AttributeDefinition.scale.allowsPlus` is in the type, validated by
  the schema, and set `true` on all five SWADE attributes — and read by
  **nothing**. The fourth instance of this pass's recurring class. SWADE really
  does advance past d12, and the app could not express it.
- Fix: a stored value above the top rung means `d12+N`. `decodeTraitDie(value)`
  splits it, and every SWADE read site goes through it — Toughness, Parry, Load
  Limit, the die code, `formatSavageSkill`, and `probability.chance`.
- Watch: the ladder now runs `[4,6,8,10,12,13,14]`. Without those rungs
  `SkillsScreen`'s snap-to-nearest pulls a stored 13 straight back to 12 the
  first time the field is touched — a Legendary advance silently undone by
  opening the screen. Extending the ladder, rather than special-casing the snap,
  is what keeps that one code path correct for every system.
- Watch also: the flat bonus adds **whole** to Parry and Toughness (half the
  *die*, plus the bonus), not halved with the die.
- **A test corrected me.** I wrote that reading 13 as a d13 "always favours the
  player". It does not: a flat +1 shifts the whole curve while a bigger die
  dilutes probability per face, so at TN 8 a d12+1 (58%) *beats* the d13 (54%)
  it was being rolled as, and at other targets it loses. That is what made the
  bug hard to see — the odds shown were always plausible and always for a die
  that does not exist. The comment in `savageMath` said the wrong thing until
  the assertion failed; both are fixed.
- Watch also: attribute `max` raised 12 → 14 in system.json (v4) so the stepper
  permits the range the ladder now offers.
- Mutation-checked: disabling the decode fails 4 tests; un-extending the ladder
  fails 1.
- Commit: feat(swade) — support d12+1 and d12+2 trait advances.

## 2026-08-08 — Pass 13: sweeping for the rest of the declared-but-unread class
- Four passes had each found one instance, so this swept every field on the
  engine interface for readers instead of waiting to trip over the next.
- Result: `attributeReadout`, `stabilizedLabel`, `triggerAtOrBelow`,
  `clearsRestTracker` and all seven `*Panel` labels are **live** — the low
  reference counts were declaration-plus-one-consumer, not deadness.
- **`engine.advancement` is dead.** The whole `AdvancementModel` —
  `sessionEvents`, `usesMarks`, `maxSkillValue`, `rollPrompt` — is declared,
  populated for Dragonbane, and consumed by nothing. So is
  `CharacterRecord.advancementChecks`. The advancement checklist is designed and
  unbuilt.
- **Not deleted, deliberately.** Passes 5 and 11 removed dead *config entries*;
  this is a whole feature's scaffolding with real Dragonbane content someone
  authored. Deleting a planned capability is a product call, not a hardening
  one. Flagged for the user instead.
- Fixed the part that is wrong regardless: `advancementChecks` was four literal
  optional booleans (`combat`/`explore`/`weakness`/`heroic`) — Dragonbane's
  session events hardcoded into the system-neutral character record, where a
  ruleset with different or more events could not be represented and adding one
  would have been a schema change rather than a `system.json` edit. Now
  `Record<string, boolean>` keyed by `sessionEvents[].id`. Zero behaviour change
  (nothing reads it), and whoever builds advancement starts system-neutral.
- **Bug in my own pass-3 work.** `SkillsScreen.cycleSkillMark` looked the skill
  definition up in `system.skillCategories` rather than the merged list, so a
  player-authored skill resolved to `undefined` and its fallback came from
  `baseChance: 0` with no linked attribute. Silent, and only reachable by
  marking a custom skill in a roll-under system. Fixed, with a regression test
  pinning the general rule: anything needing a skill *definition* goes through
  `resolveSkillCategories`, because a character's own skills exist nowhere else.
- Known limitation, documented not fixed: `modifiableStats(system)` receives
  only the system, so Traveller's per-skill modifier targets cover declared
  skills but not custom ones. Widening it to take the character would change the
  interface for all three adapters.
- Commit: fix(skills) — resolve custom skill definitions in the mark path.

## 2026-08-08 — Pass 14: Savage Worlds shipped 13 of 33 core skills
- Symptom: the same gap Traveller had at the start of this work. `system.json`
  declared 13 skills against SWADE core's 33, so two thirds of a character's
  sheet had nowhere to live.
- Fix: full core list — 33 skills across 5 categories (Core, Combat & Physical,
  Vehicles, Knowledge & Trades, Arcane). The five Core Skills every SWADE
  character starts with at d4 keep their own category. Version 4 → 5. No
  existing id was dropped or renamed, asserted in the migration script itself
  before writing.
- Arcane skills (Faith, Focus, Psionics, Spellcasting, Weird Science) are
  included even though they require an Arcane Background. The app does not gate
  skills on edges, and a GM running a magic campaign needs them present more
  than a mundane one is inconvenienced by five extra rows in the All view —
  which now collapses by category anyway (pass 6).
- Watch: **`fighting` is load-bearing.** `computeSavageWorldsDerivedValues`
  reads `skills['fighting']` by literal id, so renaming it in `system.json`
  would silently drop every character's Parry to 2 with nothing failing — a
  derived stat quietly wrong rather than absent. There is now a test pinning
  both the id and the Parry it produces; mutation-checked by renaming it to
  `melee`.
- Watch also: a test asserts every skill links to a real attribute. The schema
  already refuses an unknown `linkedAttributeId`, but that check runs on the
  *bundled* object; this one runs over the same data through the registry, so a
  registry/definition mismatch surfaces too.
- Commit: feat(swade) — the full SWADE core skill list.

## 2026-08-08 — Pass 15: a control I added was a 14px tap target
- Symptom: the characteristic-swap `<select>` from pass 8 was rendered *inline
  inside the skill name*, styled `p-0 text-xs` with no height. On the tablets
  this app is built for that is roughly a third of `--touch-target-min`, sitting
  flush against the skill's text. It reviewed fine and reads fine on a desktop
  with a mouse.
- Fix: moved it out of the name into its own control slot in the row, with
  `min-h-[var(--touch-target-min)]`, padding, and a border that appears only
  when the characteristic is actually swapped — so the default state stays
  visually quiet while the hit area stays full size.
- **A lint for this was written and then deleted.** It scanned `src/screens` and
  `src/components/fields` for interactive elements without the token, and
  reported dozens. Most were false: `GearScreen`'s inputs are sized through a
  shared `inputClasses` constant using padding rather than `min-h`, and a source
  scan cannot follow that indirection or evaluate whether the result clears
  44px. A lint that reports mostly false positives gets suppressed rather than
  fixed — the exact failure mode pass 4's entry warned about when scoping the
  vocabulary guard narrowly. Shipping it would have been worse than shipping
  nothing.
- Open, not fixed: whether `inputClasses`' padding-based sizing actually clears
  the minimum. That needs a rendered measurement, not a grep, and there is no
  DOM test setup to do it in.
- Commit: fix(skills) — give the characteristic picker a real tap target.

## 2026-08-08 — Pass 16: the damage log claimed wounds the character never took
- Symptom: `resolveDamage` returns the true rules outcome unbounded — a big
  enough hit really is 7 wounds — while the wounds *track* caps at 3.
  `DamageHealModule` clamped correctly when writing the resource, then built its
  log line from the **unclamped** figure, so a character who took 3 wounds and
  went Incapacitated was logged as "+7 Wounds". The sheet and the session log
  disagreed about the same hit.
- Fix: compute what actually lands *before* applying it, from the current
  character, and use that one number for both the resource update and the
  message.
- Watch: the engine deliberately still returns the unbounded figure. Pre-clamping
  in `resolveDamage` would throw away the difference between "exactly dead" and
  "obliterated", which a consumer may legitimately want; the cap belongs to the
  track, and there is now a test pinning that split.
- Added the boundary cases the suite was missing: exactly at Toughness (Shaken,
  no wound), one under (bounce), 3 over vs exactly 4 over (the raise boundary),
  and an unshaken target taking wounds without the already-Shaken bonus.
- Mutation-checked: `floor` → `ceil` on the raise division fails 2 tests;
  dropping the already-Shaken bonus wound fails 1.
- Commit: fix(swade) — log the wounds that actually landed.

## 2026-08-08 — Pass 17: Bennies never refreshed
- Symptom: `ResourceDefinition.refresh: 'session'` — declared on SWADE's
  Bennies, documented on the type ("refreshed at the start of each session
  (Savage Worlds Bennies)"), validated by the schema — and **read by nothing.**
  The fifth instance of this sweep's recurring class. A SWADE table reset three
  counters by hand every week.
- Fix: `sessionRefreshPatch(system, character)` as a pure rule, wired into
  `startSession` for every character in the active party.
- Watch: resolved against **each character's own system**, not the campaign's. A
  party may legitimately mix systems, and refreshing against the wrong
  definition would reset the wrong resource.
- Watch also: it refills to the *character's* `max`, not the definition's
  `defaultMax`. An edge or house rule may raise the pool, and refreshing to the
  default would silently cap it back down every single week — the kind of bug
  that looks like the player mis-remembering.
- Watch also: returns `null` when nothing changed, so a session start does not
  bump `updatedAt` on every party member for no reason. Polarity is read from
  `direction`, so a session-refreshing *accumulating* track empties rather than
  fills.
- Watch also: the refresh runs after the session is created and its failures are
  swallowed per character. Failing to top up a benny must not cost the group
  their session, and one unreadable character must not stop the others.
- `refresh: 'rest'` is still unimplemented, deliberately — that fires on a rest
  action, which belongs to the rest model, not a session boundary.
- Mutation-checked: ignoring the refresh flag fails 2, always returning a patch
  fails 2, refilling to `defaultMax` fails 1.
- Commit: feat(swade) — refresh Bennies at the start of a session.

## 2026-08-08 — Pass 18: a guard for the class instead of the sixth instance
- This sweep found the same bug five times in five unrelated places: `derived:`
  / `armor:` / `res:` modifier targets, `hiddenBuiltIns.armor: ['weight']`,
  `damageTrack.penaltyPerLevel`, `scale.allowsPlus`, and
  `resource.refresh: 'session'`. Every one type-checked, validated, and did
  nothing. Declaring a capability and consuming it are separate edits and only
  the first was ever enforced.
- Fix: `declaredCapabilities.test.ts` — every property declared on
  `types/system.ts` or `engine/types.ts` must be *read* somewhere in `src`
  (`.field` / `['field']`), or be listed in `KNOWN_UNIMPLEMENTED` with a reason.
- It found seven more, all now documented rather than merely absent:
  `advancementMax`, `valueLabel`, `defaultValue` (read only via
  `computeValue`, never as a field), `roleFallback`, `sectionLayouts`,
  `themesSupported`, and `penaltyPerLevel` — which pass 11 single-sourced the
  *number* of without ever creating a reader for the *field*.
- Watch: the allowlist has its own test asserting each entry is **still**
  unread, so it cannot rot into a list of things fixed long ago. That check
  fired immediately — on a doc comment I wrote in pass 13 mentioning
  `sessionEvents[].id`, which the read-detector counted as a reader. Comments
  are now stripped from the corpus.
- Watch also: the first version filtered declaration files and adapters out of
  the corpus by path, and the Windows path handling silently dropped files —
  eight false positives. It excludes only tests now. It does not need to exclude
  the others: a declaration is `field: Type` and a population is `field: value`,
  neither of which matches `.field`. A guard whose own correctness is hard to
  check is a guard that gets disabled.
- Mutation-checked both directions: a new unread field fails, and wiring a
  reader for an allowlisted field fails the staleness check.
- Commit: test(systems) — fail when a declared capability has no reader.

## 2026-08-08 — Pass 19: the library card only described Dragonbane characters
- Symptom: `CharacterLibraryScreen` built each card's subtitle from
  `metadata.kin` and `metadata.profession` — Dragonbane's identity field ids,
  hardcoded in the one screen that lists characters from *every* system.
  Traveller declares callsign/species/homeworld; Savage Worlds declares
  concept/rank/ancestry. Both have neither of the hardcoded two, so their cards
  showed the system name and nothing else no matter how much identity the
  player had filled in.
- Fix: `summariseIdentity` reads the system's own `identityFields` in
  declaration order and takes the first two non-empty values, so each ruleset
  volunteers what identifies a character. Returns nothing for a system this
  build does not bundle, rather than guessing at arbitrary metadata keys.
- Fix 2: the skill value input had **no accessible name at all** — every other
  control in that row has one, and a screen reader announced a bare spinbutton
  with a number. It now reads "Gun Combat (Slug) Level" / "Fighting Die" /
  "Axes Value", which is exactly what `engine.skill.valueLabel` was declared
  for and never used for. One fewer entry in `KNOWN_UNIMPLEMENTED`.
- Watch: mutation-checked by replacing the label with a literal "Value" — the
  pass-18 guard flags `valueLabel` as unread again, and correctly ignores the
  doc comment above the input that also mentions it.
- Commit: fix(library) — describe characters by their own system's fields.

## 2026-08-08 — Pass 20: closing the sweep
- Final state: 707 tests across 45 files (from 483/39 at the start of the day),
  `tsc -b` and `vite build` clean, everything on Production.
- Version gates all consistent: traveller system v15 / sheet v8 (102 skills),
  savage-worlds v5 / v4 (33 skills), classic-fantasy v3 / v6 (33 skills). Every
  bundled-data edit this sweep bumped its own counter — the two are independent
  and nothing cross-checks them, so this is worth eyeballing at the end of any
  session that touches JSON.
- The sweep's single finding, recorded in CLAUDE.md and AGENTS.md: **declaring a
  capability and consuming it are separate edits, and only the first was ever
  enforced.** Five instances, none of which any type check or schema could have
  caught, all of which read as working configuration.
- Two guards now hold that line: the modifier fingerprint (pass 3) proves an
  offered target moves a number the user can see, and
  `declaredCapabilities.test.ts` (pass 18) proves a declared field is read at
  all.
- Deliberately left undone, all recorded above: `engine.advancement` (designed,
  unbuilt — a product call, not a hardening one); `refresh: 'rest'`; whether
  `inputClasses`' padding-based sizing clears the touch-target minimum (needs a
  rendered measurement and there is no DOM test setup); and per-skill modifier
  targets for custom skills (`modifiableStats` receives only the system).
- Commit: docs — record the declared-capability rule.

## 2026-08-08 — Advancement, built
- Pass 13 found `engine.advancement` entirely dead — `sessionEvents`,
  `usesMarks`, `maxSkillValue`, `rollPrompt`, and `CharacterRecord
  .advancementChecks` — declared, populated for Dragonbane, consumed by nothing.
  Flagged as a product call rather than deleted. The call was: build it.
- Shape: a sheet panel gated on `engine.advancement !== null`, exactly as `rest`
  is. Dragonbane gets it; Traveller and Savage Worlds declare `null` and get
  nothing. Adding the key to `SHEET_PANEL_KEYS` made `tsc` demand the panel in
  `allPanels` — the three-list typing doing its job.
- **The app does not roll.** Each marked skill shows the system's own
  `rollPrompt` ("Roll above 12 on a d20 to advance") and offers *Advanced* /
  *No change*. The player rolls a real d20 and records what happened, matching
  every other probability surface here, which shows odds and never resolves
  them.
- **The checklist is a tally, not a marking UI.** Each ticked box earns the
  right to mark one skill, and marking already lives on the Skills screen where
  the skills are. Duplicating it would give two places to do the same thing and
  two chances to disagree about the count.
- **Both marks advance.** A dragon (critical success) and a demon (critical
  failure) are tracked as distinct states because they mean different things at
  the moment they happen, but Dragonbane marks a skill for advancement on
  either — you learn from a triumph and a disaster alike, and
  `AdvancementModel` speaks of "marks" generically. `isMarkedForAdvancement` is
  the single place to change this if a table plays dragons-only.
- Two guards, not one: ticking the checklist stays editable in **play** mode
  (it records what happened this session), while applying an advancement is
  gated by `FIELD_PATHS.skills` like any other build change — a stray tap
  mid-session must not permanently raise a skill. `advancementChecks` is the
  first genuine addition to `PLAY_MODE_EDITABLE_PREFIXES` since it was pruned in
  pass 5, and it follows that entry's own instruction: add the path *and* the
  call that asks about it.
- Watch: `applyAdvance` returns `null` for an unmarked skill, so a double-tap or
  a stale render cannot advance twice. A skill at the ceiling keeps its value
  but still loses its mark — leaving it would offer the same dead roll again
  next session.
- Watch also: candidates are read from *resolved* categories, so a
  player-authored custom skill can be marked and advanced like any declared one.
- classic-fantasy sheet.json 6 → 7. Mutation-checked: removing the ceiling cap,
  dropping demon marks, removing the double-advance guard, and listing the panel
  in a system without the model each fail.
- Commit: feat(advancement) — end-of-session advancement.

## 2026-08-08 — Traveller themes, drawn from the 2026 sheet
- Two new themes, separate from `starfarers-cockpit` (which stays as it was):
  **Traveller — Printed Sheet** (light) and **Traveller — Black Book** (dark).
- Sampled from the Mongoose 2026 character sheet PDFs: slate header bars
  (#565C6B) with white condensed caps, a diagonal chamfer on the right end of
  every bar, white pages on a grey surround, near-black rules, and hard corners
  throughout. The sheet carries **no colour at all**; the books supply it (black
  covers, red titles), so red appears only on the seam under a header, active
  state and focus — never as decoration.
- Watch: fields are **ruled writing lines**, not boxes — the sheet's single most
  recognisable feature. The faint side borders are dropped and the baseline
  thickened. Selects keep their box: a control you tap open needs to look like
  one.
- Four iterations, each fixing something only visible on screen:
  1. Themes did not apply at all — `settings.theme` in IndexedDB overrides
     `localStorage`, so setting the attribute or the storage key is undone on
     the next render. Themes must be switched through the Settings UI.
  2. Panel interiors fell through to `--color-bg`, so the sheet read
     inside-out: grey page, white boxes. `.section-panel` now paints
     `--color-surface`.
  3. The chamfer **sliced the collapse chevron in half** — a clip-path removes
     real estate the header's own content still occupied. Fixed with matching
     right padding. It looked like a rendering fault, not a design.
  4. The ruled-field rule styled almost nothing: most inputs in this app render
     with **no `type` attribute**, and `input[type="text"]` does not match those.
     Now `input:not([type=checkbox])…`, excluding the native controls.
- Two stable hooks added to `SectionPanel` (`section-panel`,
  `section-panel-header`) so a theme can restyle a header without reaching
  through Tailwind utilities. Purely additive.
- Workflow walked end to end in a real browser: library → create → sheet →
  skills (All view, search, category expand, group action) → gear → play
  dashboard → print → settings → reference. **No console errors.** The
  collapsed-category view turns 102 skills into 7 headings with counts, and
  expanding one reveals the group header and its "All at 0" action.
- Commit: feat(theme) — Traveller printed-sheet and black-book themes.

## 2026-08-08 — Selectable task difficulty
- Every Traveller probability was computed against a fixed 8+, and the display
  said so ("83% vs 8+"). But Traveller sets a target per task, from Simple (2+)
  to Impossible (16+), and the odds move by roughly one row per point — so the
  one number shown was right for exactly one difficulty and misleading for the
  other seven.
- `TRAVELLER_DEFAULT_TARGET`'s own comment had said for months that the maths
  already took the target as a parameter and a selector was "a UI change, not a
  maths one". That turned out to be true.
- Fix: `ProbabilityModel.difficulty` — an engine-declared ladder with a label,
  a default and named options. Traveller declares Mongoose's eight; Dragonbane
  declares none, because it is roll-under and the skill value *is* the target,
  so no selector renders there at all. `SkillDisplayContext.target` threads the
  choice through `skill.display` and `probability.chance` alike.
- Session-scoped, like boon/bane: the GM calls a difficulty for *this* task, not
  for the character. Every skill's odds move together, which is the point —
  "what are my chances if this one is Difficult?" is a question about the whole
  sheet at once.
- Watch: the ladder is declared in the adapter, **not** read from the Quick
  Reference card of the same name. That card is display copy a user may reword
  or delete; the odds must not depend on prose.
- Watch also: boon and bane recompute at the selected target, not the default.
  Verified in a browser on real data — at Difficult (10+), normal 8% / boon 20%
  / bane 2%, and the label reads "vs 10+" with no stale "vs 8+" anywhere.
- A test asserting boon > normal at every target **failed correctly**: at Simple
  (2+) a level-2 skill already succeeds on any roll, and a boon cannot beat
  certainty. The assertion now requires monotonicity always and strict gaps only
  where the roll is genuinely uncertain.
- The pass-18 staleness guard fired too: `defaultValue` was listed as unread and
  now has a reader (`difficulty.defaultValue`), so it left the allowlist. That
  is the guard working, not a false alarm.
- Mutation-checked: dropping the target from `chance` fails 4 tests, dropping it
  from `display` fails 3.
- Commit: feat(traveller) — selectable task difficulty.

## 2026-08-08 — First live Traveller session: debts, and the S Pen panel
- Symptom 1: the Book's Finances block has one `Debt (Cr)` line. It is a total
  — a mortgage figure — and cannot say *who* you owe or *what for*. A crewmate
  fronting 10,000 Cr for a vacc suit is the real case: nobody writes it down,
  everybody half-remembers it, and it resurfaces three sessions later as an
  argument.
- Fix: `CharacterRecord.debts`, itemised — counterparty, amount, direction,
  note — rendered under the existing total, which stays because it is the
  Book's own line and holds existing data.
- Watch: `direction` (`'owed'` / `'due'`) carries the sign rather than a
  negative `amount`. A debt of -10,000 reads as "they owe me" only if you
  already know the convention, and eventually someone types the wrong sign.
- Watch also: settling **keeps the row** and marks it, behind a "Settled (n)"
  toggle, with Reopen to undo a mis-tap. "Did I ever pay that back?" is asked
  months later, and a deleted row answers with silence.
- No migration rung: the field is optional and additive, every read goes
  through `?? []`, and a record without it is already correct.
- Symptom 2: `PenHelpPanel` persisted its expanded state. That sounds helpful
  and is not — you open it once to read the device checks, and it then eats the
  top of the session log in every session afterwards. Troubleshooting is a
  one-off; the writing area is what you came for. It now always starts
  collapsed, and the localStorage plumbing is gone.
- Commit: feat(traveller) — itemised debts, and stop the S Pen panel re-opening.

## 2026-08-08 — Logging a note without leaving the Play tab
- Symptom, from the first live session: capturing a note meant leaving Play for
  the session log — and "Characters" in the bottom nav returns you to the
  *sheet*, not to Play. So every note cost two navigations and a
  re-orientation while the table waited.
- Fix: `QuickLogBar`, a composer docked to the bottom of the Play screen.
  Collapsed it is one line; focused it is an input with the play screen still
  visible behind and above it — which is the point, since you are usually
  writing *about* something you can see. Enter commits, Escape closes.
- Watch: deliberately **not** a dashboard card. A card scrolls away with the
  rest of the layout, and the one thing this must never do is require scrolling
  to find mid-session. It is `sticky bottom-0` outside the card flow.
- Watch also: renders nothing without an active session. There is nowhere for
  the note to go, and an input that silently discards is worse than no input.
- Watch also: after committing it clears and re-focuses rather than toasting.
  The next note usually follows straight after, and a toast that moved focus
  would cost a tap to get back.
- Verified in a browser on real imported data: hidden with no session, visible
  with one, input focuses, clears on commit, **stays on /character/play**, and
  the note lands in `notes` with the right `sessionId` and type. The
  `/session/log` *display* was not exercised by the harness (it is the ink
  capture view, untouched here).
- Commit: feat(play) — log a note without leaving the Play tab.

## 2026-08-08 — Money the engine can render without a character
- Symptom: the campaign ledger needs to print an amount, and `CurrencyModel`
  could not. Its whole surface — `read` and `write` — takes a `CharacterRecord`,
  because until now every amount in the app belonged to someone. A campaign
  cashbook belongs to the crew, and there is no character to hand it.
- "Print the integer" is not a fallback either. The ledger is ungated (every
  system has money), so Dragonbane's three-denomination `coins` mode has to
  render from the same stored number as Traveller's single credit.
- Fix: two additive members — `baseDenominationId` (the unit ledger amounts are
  counted in) and `formatAmount(baseUnits)` — implemented in all three adapters
  over a shared `decomposeAmount` helper now living in `utils/currency.ts`
  alongside `remakeCurrency`, which already did the same greedy change-making.
- Surfaces: `engine/types.ts`, the three adapters, `utils/currency.ts`, and
  `cards/guards.test.ts`'s fake engine (the members are required, so every
  fixture has to satisfy them).
- Watch: **additive only**. No existing signature moved, which is what makes
  "Dragonbane is unchanged" a claim rather than a hope — `engineContract.test.ts`
  fingerprints the engine's visible output and still passes.
- Watch also: `baseDenominationId` has no consumer *yet*. Its reader is the
  ledger's amount-input label, landing with the ledger screen. Declaring a
  capability with nothing reading it is the exact bug
  `declaredCapabilities.test.ts` exists to catch — it has found that shape five
  times in this repo. If the ledger screen is abandoned, this member must come
  out rather than be added to `KNOWN_UNIMPLEMENTED`.
- Commit: feat(engine) — render money without a character.

## 2026-08-08 — The ship fund is retained, not paid out
- Symptom: caught in design review, before any code. The first schema for a
  crew payout stored one signed `amount` equal to the whole sum distributed.
  But the crew's agreement takes 50% off the top for the *ship fund* — fuel,
  mortgage, maintenance — and that money never leaves the crew's account. Only
  the remainder reaches anybody's pocket.
- Storing the gross as the outflow would have drifted the running balance
  downward-wrong by the fund's share of **every** payout. Silent, compounding,
  and undetectable until the book disagreed with the table by a wide margin —
  months later, with no way to reconstruct which entry was wrong.
- Fix: `gross` and `amount` are separate fields. `gross` is the sum being
  divided and the legs sum to it; `amount` is the **net** cash movement and
  excludes anything retained. Two invariants, asserted in code rather than
  assumed:
  - **I1** `sum(legs.amount) === gross` — every credit is accounted for.
  - **I2** `net === -(gross - shipFundLeg.amount)` — only money that left is
    subtracted.
  A breach throws instead of writing a plausible wrong row.
- Surfaces: `utils/ledgerMath.ts` (`computeDistribution`, `computeRunningBalance`,
  `validateSplit`, `evenSplit`), `types/ledger.ts`, and the three repositories.
- Watch: **`gross` and `amount` are different numbers and must stay different.**
  `gross` is the whole sum being divided; `amount` is only the cash that left the
  book. On a 50% ship-fund payout they differ by half. Anything that folds the
  balance must read `amount` and nothing else — summing `gross` re-creates the
  original bug exactly, and the legs sum to `gross`, so a leg-based total is
  wrong too. If a future change makes them equal for a distribution, that is the
  regression, not a simplification.
- Watch also: **the ledger stores a signed integer, deliberately diverging from
  the itemised-debts convention.** That feature carries direction in a
  `direction: 'owed' | 'due'` field, and its own Watch line predicted somebody
  would eventually type the wrong sign. A cashbook whose balance is a plain sum
  of signed integers cannot have that bug. The user still sees In and Out
  columns and never types a sign — the Out path negates on write.
- Watch also: the running balance is **never persisted**. It is folded on read,
  so an edited, restored or soft-deleted row cannot leave a stale total behind.
  Fold order is `date`, then `createdAt`, then `id`; the `id` tiebreak is what
  stops two entries logged in the same millisecond reshuffling between reloads.
- Watch also: a split totalling under 100% still distributes, and the shortfall
  becomes a visible `unallocated` leg. It is never spread across the payees —
  a hand-entered percentage error should show up in the books, not silently
  inflate somebody's cut. Over 100% refuses outright.
- Watch also: rounding residue folds into the ship fund, which is the residual
  pot by nature. `-(0)` is `-0` in JavaScript, so the net is normalised — it
  would otherwise render as "-0" on a fully-retained payout.
- Mutation-checked, all three restored afterwards: inverting the residual fold
  fails *"holds both invariants across inputs chosen to force rounding"*;
  removing the ship-fund exclusion from the net fails *"retains the ship fund
  and pays out only the rest"* plus three others; flipping `evenSplit`'s
  remainder fails *"puts the remainder on the leading rows"*.
- Commit: feat(ledger) — distribution arithmetic, repositories and route ordering.

## 2026-08-08 — A route planner only the systems that want one can see
- Symptom: the crew wanted a jump route — an ordered list of worlds with UWP,
  hex and parsec distance. All three are meaningless in Dragonbane, so the
  screen cannot simply always exist. The obvious fix, `if (systemId ===
  'traveller')`, is banned for good reason.
- Fix: `SystemDefinition.routePlanner` — a system declares `{ label,
  distanceFieldId, fields[] }`, and both the screen and its nav link exist only
  where a declaration does. Traveller declares name/UWP/hex/jump/notes.
- Surfaces: `types/system.ts`, `schemas/system.schema.ts`,
  `traveller/system.json` (version bumped), `screens/RouteScreen.tsx`,
  `features/route`, `CampaignHeader.tsx`, `utils/export/renderRoute.ts`.
- Watch: gating was only half the reason. The same declaration supplies the
  **labels**, so "UWP" and "parsecs" are Traveller's words, not the app's — a
  hex-crawl system could declare name/region/days-travel and get the identical
  screen with no code change. An engine panel flag would have gated correctly
  and left the vocabulary hardcoded, which is the half that hurts when a fourth
  system arrives.
- Watch also: the Zod entry in `schemas/system.schema.ts` shipped in the same
  change as the type, deliberately. Zod strips unknown keys, so a type without
  a schema entry works for bundled systems and silently vanishes for **imported**
  ones. `systemDefinitionSchema.test.ts` now asserts the parsed Traveller
  definition still has all five fields, which a bare "does it parse" check would
  not have caught.
- Watch also: `readNumericField` in `utils/routeMath.ts` is the only place in
  the feature that parses a string to a number. Values are stored as strings
  regardless of a field's declared `type`, and a half-filled route is the normal
  state mid-session — so the distance total reads 0 for a blank leg rather than
  rendering `NaN`. The export names any stop whose distance could not be read,
  so a typo is visible rather than silently counting as zero.
- Watch also: reorder is up/down buttons, not drag. The app is used on a tablet
  with a stylus, and there is no existing drag primitive in the codebase to
  reuse. `routeRepository.reorder` writes every affected row in one transaction,
  so an interrupted write cannot leave two stops sharing an index.
- Watch also: the **Ships** link next to these is ungated — a Dragonbane
  campaign sees it. That is a pre-existing wart, left alone here rather than
  copied.
- Commit: feat(traveller) — the crew's cashbook and their jump route.

## 2026-08-08 — Ledger movements belong in the session log too
- Symptom: the ledger and the session log were two separate records of the same
  evening. "When did we pay for that?" gets asked of the log as often as of the
  book, and the log had no idea money had moved.
- Fix: every ledger movement — money in, money out, a distribution, a removal —
  mirrors into the active session as a `log` note carrying
  `typeData.ledgerEntryId` back to the row. A distribution's line names **every
  share**, because by the time anyone re-reads it the split will have changed,
  so the numbers have to be written down at the moment they were true. Session
  Markdown export appends the cashbook; the session ZIP ships it as `ledger.md`.
- Surfaces: `features/ledger/useLedger.ts`, `features/session/useSessionLog.ts`,
  `features/export/useExportActions.ts`.
- Watch: **the mirror is best-effort and never blocks the ledger write.** The
  ledger entry is the load-bearing record; a log failure must not lose it. With
  no active session there is nowhere for the note to go and the ledger still
  works — the money still gets recorded.
- Watch also: found while verifying this — **`logToSession` never wrote a note
  body.** `SessionLog` renders `docToText(entry.body)`, *not* the title, so
  every note logged with a title alone appeared in the log as a row containing
  nothing but a timestamp. `LogToSessionOptions` gained an optional `body`,
  converted to a ProseMirror doc inside the hook because a raw string
  round-trips to nothing through `docToText`.
- Watch also: **`QuickLogBar` still logs title-only and is still affected.** The
  fix is now one argument away but was left alone as out of scope. Its own
  decisions entry (2026-08-08) notes the `/session/log` display "was not
  exercised by the harness" — this is what that gap was hiding.
- Watch also: **the ledger and route exports are deliberately unfiltered.** The
  note export paths call `excludePrivateNotes` (`useExportActions.ts:131,189`),
  and a comment there records that they were once unfiltered *by mistake*. These
  two are not the same case: a campaign cashbook and a jump route are shared
  crew data by definition, and neither entity carries a private flag to filter
  on. Adding one would be new scope, not a bug fix. This is recorded because
  `useExportActions.ts` points at this entry by date — without it the code cites
  a decision that does not exist, and the next reader re-litigates it or
  "fixes" it.
- Verified in a browser against the real Session 1 numbers from *Pirates of the
  Spinward Main*: the Cr819,000 hold split 50% ship / 36/36/18/10 produced
  Cr409,500 retained and Cr147,420 / Cr147,420 / Cr73,710 / Cr40,950 paid, with
  the balance falling by Cr409,500 and not Cr819,000. Renegotiating the split
  afterwards left the written entry byte-identical. Full evidence:
  `docs/specs/ss10-ledger-route-integration-evidence.md`.
- Commit: feat(ledger) — mirror movements into the session log and export.

## 2026-08-09 — Quick-logged notes never reached the session log
- Symptom: a note typed into `QuickLogBar` on the Play tab saved fine and then
  **never appeared in `/session/log`**. Not blank — absent. The composer said
  "Saved", the row existed in `notes` with the right `sessionId`, and the log
  read "No log entries yet."
- Two separate faults stacked, which is why it looked like it worked:
  1. **Wrong type.** `listLogEntriesBySession` filters `type === 'log'`;
     `QuickLogBar` wrote `'generic'`, so the entry was filtered out before
     anything tried to render it.
  2. **No body.** `SessionLog` renders `docToText(entry.body)` and the timeline
     derives a log item's label from the body too — never the title. So even
     once it was listed, it arrived as a row holding nothing but a timestamp.
- Fix: `logToSession(title, 'log', {}, { body: title })`. `'log'` is documented
  as exactly this — a freeform entry captured during play. `LogToSessionOptions`
  gained `body`, converted to a ProseMirror doc inside the hook because a raw
  string round-trips to nothing through `docToText`.
- Surfaces: `features/playDashboard/QuickLogBar.tsx`,
  `features/session/useSessionLog.ts`.
- Watch: both `log` and `generic` are timeline tracks, so retyping does not
  remove the entry from the timeline — it moves it to the `log` track, where the
  adapter labels it from the body it now has.
- Watch also: **the other title-only `logToSession` callers still pass no body**
  — `DamageHealModule`, `GearScreen` (acquire/remove), `CombatEncounterView`.
  Those log `'generic'`, so they were never listed by the session log either and
  are unaffected by this change; but if any is ever retyped to `'log'` it will
  need a body in the same edit or it will land as a bare timestamp.
- Watch also: the QuickLogBar entry (2026-08-08) recorded that the
  `/session/log` **display** was not exercised by its harness. This is what that
  gap was hiding — the feature was verified as far as the database and no
  further.
- Verified in a browser on real imported data (Milo Aer, Traveller): typed a
  note on Play, confirmed the stored body is a real ProseMirror doc, and read
  the text back in `/session/log`.
- Commit: fix(session) — quick-logged notes now reach the log they were written for.

## 2026-08-09 — Converging the ledger back onto its own spec
- Symptom: a spec-vs-codebase convergence run over
  `docs/specs/2026-08-08-campaign-ledger-and-route-planner.md` found 15 gaps in
  shipped, tested, already-pushed code. Three mattered.
- **A test the spec named was never written.** SS-09 lists
  `src/utils/export/renderLedger.test.ts` under `Files (new)`. It did not exist.
  The renderer's output — the exported cashbook, the artifact the whole feature
  exists to produce — had no test at all. Fixed: 14 tests.
- **`/route` rendered an error page the spec explicitly forbade.** SS-08's
  Decisions say a ruleset with no `routePlanner` gets a *redirect*, and "do not
  render an error page". It rendered "Not available". Telling someone a feature
  is unavailable implies it exists and is unconfigured; for their ruleset it
  does not exist. Now `<Navigate to="/session" replace />`.
- **An invariant breach showed as inline text, not a toast.** Both the SS-07
  criterion and the edge-case table say toast. Inline text in a modal is easy to
  miss at a table mid-session, which is the only moment this fires.
- Surfaces: `screens/RouteScreen.tsx`, new `features/route/useRoute.ts`,
  `features/ledger/DistributeModal.tsx`, `utils/export/renderLedger.ts`,
  `renderRoute.ts`, and three new test files.
- Watch: **fixing the redirect introduced a worse bug, caught only by running
  the app.** The guard was gated on the hook's `isLoading`, which tracks the
  *stops* query — but `planner` comes from the *system definition* load. They
  race, stops win, and the redirect fired before the declaration arrived,
  bouncing a Traveller crew off their own route screen. Now gated on
  `systemResolved`. This is the second guard in this feature to key on the wrong
  async source; the first was `useSystemEngine` (active *character*) where
  `useSystemDefinition` (active *campaign*) was needed. When a screen depends on
  two independent async loads, name which one the guard means.
- Watch also: `yamlValue` is now privately duplicated across **six** renderers.
  Extracting it touches four files unrelated to any gap, so it was escalated
  rather than folded in — see `docs/converge/2026-08-09-*/pass-1.md`.
- Watch also: the spec's `Must-Not: push to any remote` is recorded as violated.
  It was written before the instruction to push to prod; a later explicit
  instruction overrides a spec constraint. Recorded rather than suppressed so
  the divergence is visible.
- Commit: converge(pass-1) — close 12 spec gaps in the ledger and route planner.

## 2026-08-09 — The guard against the repo's most-repeated bug was never written
- Symptom: convergence pass 2 found that `routePlanner` appeared in **zero test
  files**. `systemDefinitionSchema.test.ts` asserted only `safeParse().success`
  and never looked at `result.data`.
- Why that matters more than it sounds: Zod strips unknown keys. Deleting the
  `routePlanner` entry from `schemas/system.schema.ts` would have left the whole
  suite green — bundled Traveller reads its definition straight off the module,
  so it would keep working — while every **imported** system silently lost its
  route planner. The screen and its nav link would simply never appear, for
  somebody else's JSON, with no error anywhere.
- This is the exact trap CLAUDE.md documents, and the exact reason SS-05's
  acceptance criterion demanded a test that inspects the parsed result. The
  criterion was written and never implemented. The file already held a sibling
  test — "preserves groupId and skillGroups through the parse" — written for the
  identical failure mode.
- Fix: two tests. One pins the five field ids, non-empty labels, and that
  `distanceFieldId` names a field that exists — otherwise the parsec total reads
  0 for every stop and nothing complains. The other pins that a system declaring
  no planner parses to `undefined`, because that absence is what gates the
  feature off.
- Surfaces: `src/features/systems/engine/systemDefinitionSchema.test.ts`.
- Watch: the guard is now **compile-time, not assertion-time**. Removing the
  schema entry makes the test file stop type-checking, so the suite becomes
  uncollectable rather than merely red. That is stronger than the criterion
  asked for and is deliberate — a silently-stripped key should not be able to
  reach a test run at all.
- Watch also: "the schema entry ships in the same change as the type" was
  satisfied and still insufficient. Both landed together and the key was still
  unprotected, because nothing read it back. Shipping a schema entry and pinning
  that it survives are two separate obligations.
- Commit: converge(pass-2) — pin the Zod survival of routePlanner.

## 2026-08-09 — The ledger and the route get tabs, not a hamburger
- Symptom, from the table: both screens were reachable only through the campaign
  header's overflow sheet. Two things used constantly during play sat three taps
  deep behind a menu that also holds Settings and export — the place you go when
  you want to *configure* something, not when the crew just got paid.
- Fix: `SessionSubNav`, the campaign-side counterpart to `CharacterSubNav`.
  Session / Log / Ledger, plus the route when the ruleset declares one. Both
  links are removed from the overflow sheet rather than duplicated — a second,
  slower path to the same screen is clutter, not redundancy.
- Surfaces: new `components/shell/SessionSubNav.tsx`; `ShellLayout` renders it;
  `BottomNav` and `CampaignHeader` updated.
- Watch: **these are campaign-scoped, not character-scoped**, which is why they
  sit beside the session rather than on the character row. The character tabs
  only exist when a character is open — `/character/*` redirects to the library
  otherwise — and the ledger must work with no character loaded at all.
- Watch also: the system is resolved with `useSystemDefinition(campaign.system)`,
  **not** `useSystemEngine()`. The engine hook keys off the active *character*,
  so the route tab would vanish whenever no character was open, which on the
  session side is most of the time. Third place in this feature where the wrong
  async source would have produced a plausible, quiet bug.
- Watch also: `SESSION_SECTION_PREFIXES` is exported and shared, because the
  shell decides whether to show the sub-nav and the bottom bar decides whether to
  light "Session". If those two lists ever drift, a user on `/ledger` sees the
  session tabs while the bottom bar highlights nothing — the navigation
  contradicting itself about where they are.
- Watch also: the icons are lucide, not `GameIcon`. `GameIcon` resolves against a
  fixed path map and **returns `null` for an unknown name** — the first draft
  used four names that did not exist and would have shipped four tabs with no
  icons, no error, and no failing test. There is no money or route glyph in that
  map; lucide has both.
- Verified in a browser on both rulesets: Traveller shows
  Session/Log/Ledger/<declared label> and reaches each in one tap with the bottom
  bar still on Session; Dragonbane shows Session/Log/Ledger and no route tab; the
  character row is unchanged and no session tab leaks into it; neither screen
  appears in the overflow sheet any more.
- Commit: feat(nav) — surface the ledger and the route as session tabs.

## 2026-08-09 — Tests for the module that writes the money, and a one-step payout
- Symptom 1: `ledgerRepository` was the only one of the three new repositories
  with no test file, and it is the one that persists every credit.
- Fix: 28 tests. The load-bearing ones cover the split snapshot being frozen at
  write time and the fold order reads come back in.
- Watch: **two of the first drafts could not fail.** Mutation-checking caught
  both, and the reasons are worth keeping:
  - Asserting the snapshot deep-copy by reading the row back proves nothing.
    IndexedDB structured-clones every value on write, so `getById` returns a
    fresh object whether or not the repository copied anything — the test passed
    identically with `structuredClone` deleted. The assertion has to be against
    the object `create` **returns**, which is what callers hold and what the
    repository is actually responsible for.
  - The `id` tiebreak in `inFoldOrder` cannot be exercised through
    `listByCampaign` at all: Dexie's `where('campaignId').equals()` already
    returns primary-key order, so removing the tiebreak changes nothing. The
    tiebreak that matters is in `computeRunningBalance`, which folds an
    arbitrarily-ordered array and is mutation-proven in `ledgerMath.test.ts`.
    The repository's is defence in depth, and the test now says so instead of
    pretending to guard it.
  - A third draft passed for a subtler reason: the two fixture ids sorted in the
    same direction as their timestamps, so dropping the `createdAt` comparison
    fell through to the id tiebreak and produced the same answer. The ids now
    sort *against* the timestamps.
- Symptom 2: Distribute records only the outflow. Nothing said so, and "we got
  paid, split it now" is one act at the table — so hitting Distribute without
  first entering the fee sent the book negative for no visible reason.
- Fix: an opt-in "Record the payment coming in as well" checkbox writing the
  income line immediately before the payout, and the red-balance warning now
  names the likely cause rather than just stating the fact.
- Watch: two entries, not one. They are two events, and folding them together
  would hide the income from the In column — the balance would be right and the
  book would be unreadable.
- Commit: feat(ledger) — test the repository that writes the money, and offer a one-step payout.

## 2026-08-09 — Debts can be paid down, not just settled outright
- Symptom: a debt could only be Settled — all or nothing. Real repayment is
  partial: Milo owes Johnathan Cr10,000 for the vacc suit and hands over Cr4,000
  when the first job pays. The sheet had nowhere to put that, so the debt stayed
  at its full figure and the totals lied.
- Fix: `payments: DebtPayment[]` on the debt, with `outstanding()` = amount minus
  paid. `netDebt` and `totalByDirection` count what remains, so a repayment
  actually moves the numbers. The row shows the balance with "4,000 Cr paid of
  10,000 Cr" underneath. A Pay button opens an inline field with an All shortcut.
- Watch: **`amount` is never reduced.** Payments accumulate as their own rows, so
  the sheet keeps both the original figure and the balance. "You said you'd pay
  me back 10,000 and you've given me 4" needs both numbers, and writing the
  balance back over the original destroys the one that gets argued about.
- Watch also: a payment that clears the balance settles the debt in the same
  write, and sets `autoSettled: true`. That flag exists because removing a
  mis-typed payment must reopen a debt that closed *because* of that payment,
  but must **not** override someone who deliberately marked a debt square after
  forgiving the remainder. Without it the code cannot tell the two intentions
  apart — the first version guessed, and its test caught it.
- Watch also: `outstanding` clamps at zero. An overpayment is a data-entry slip,
  not a debt that runs negative and starts counting the other way in `netDebt`.
  Overpaying is accepted rather than refused, because rejecting a repayment
  mid-session over a rounding difference is worse than recording what was
  actually handed over.
- Watch also: additive and backward-compatible — `payments` is optional, every
  read goes through `?? []`, and a debt without it already behaves correctly. No
  migration rung. The 14 pre-existing debt tests passed unchanged.
- Mutation-checked, all restored: making the totals use `amount` instead of
  `outstanding` fails the totals tests; removing the zero clamp fails two; and
  dropping the auto-settle fails four.
- Verified in a browser on the real Session 1 debt: recorded Cr10,000, paid
  Cr4,000, saw Cr6,000 outstanding with the original still shown, then used All
  to clear it and watched the row move into Settled.
- Commit: feat(debts) — pay a debt down in instalments.

## 2026-08-09 — Import a route planned somewhere else
- Symptom: planning a jump route is exactly the kind of arithmetic worth handing
  to an AI in a chat — but the result then had to be retyped stop by stop.
- Fix: an Import action on the route screen. Paste JSON or pick a file, see a
  preview, then either replace the route or append to it.
- Surfaces: `utils/route/parseRouteImport.ts`, `features/route/RouteImportModal.tsx`,
  `routeRepository.importStops`, `useRoute.importStops`.
- Watch: **forgiving about shape, strict about fields.** Whatever produced the
  file has not read `routePlanner`, so a bare array, `{stops:[]}`, `{route:[]}`,
  `{worlds:[]}` and `{legs:[]}` are all accepted, keys match on id *or* label,
  and case and separators are ignored — `UWP`, `uwp` and `U_W_P` all land. But a
  key matching no declared field is **dropped and reported**. Keeping it would
  put data in the record that no screen renders and no export prints, which is
  worse than losing it visibly.
- Watch also: the preview is not decoration. It is the only place the user sees
  what was *ignored*, and finding that out after the import is how a route ends
  up quietly missing half its data. Nothing is written until it has been shown.
- Watch also: `importStops` does the whole file in one transaction, and
  `replace` soft-deletes the old stops inside it. A half-imported route reads as
  a successful one; and replacing must never leave the route empty if the write
  fails partway.
- Watch also: values are stored as strings whatever the JSON says, matching the
  record — `"jump": 2` becomes `"2"`. `readNumericField` remains the only place
  anything parses them back.
- Verified in a browser with the real Feast Contract route: five stops imported
  with UWP, hex, parsecs and notes intact, a 27-parsec total, an unknown
  `population` field reported rather than swallowed, a nameless sixth entry
  skipped by position, and Replace leaving exactly the new route with the old
  five soft-deleted rather than destroyed.
- Commit: feat(route) — import a route from JSON.

## 2026-08-09 — The jump route knows what day it is
- Symptom, straight from Session 1: the trake fruit has to reach Regina by
  235-1105, the Zila round trip is most of a 26-week budget, and nobody at the
  table could tell whether it fit. The route planner held distances and no time.
- Fix: a Schedule panel — journey start, deadline, and what the deadline is for
  — plus per-stop estimated days and recorded arrival/departure. It projects each
  arrival, totals the travel, and says how much slack is left.
- Surfaces: `utils/route/calendar.ts`, `utils/route/schedule.ts`,
  `types/routePlan.ts`, `routePlanRepository`, `version(16)`, `useRoute`,
  `RouteScreen`, and a `routePlanner.calendar` declaration on Traveller.
- Watch: **dates are the ruleset's, not the player's.** Traveller declares
  `{ kind: 'day-of-year', daysInYear: 365, example: '097-1105' }` and the schedule
  reads in the same form as the campaign's own notes. A system declaring no
  calendar still schedules — dates fall back to plain day numbers — so this is a
  formatting declaration, not a feature gate.
- Watch also: **the projection re-bases on the latest recorded arrival.** Once a
  leg has run long, every date after it moves; projecting from the original start
  would keep showing a plan that stopped being true at the first delay. Time in
  port counts too — the next leg departs from `departedOn` when it is recorded,
  because a week sat at a starport is a week the rest of the route loses.
- Watch also: **variance is measured against the original plan, not the re-based
  projection.** Comparing an actual against a projection that already contains
  the delay would always read zero. Mutation-checked: making variance use the
  re-based value fails three tests.
- Watch also: dates are stored as typed, not as day numbers. The calendar is a
  per-system declaration, and a stored integer would be unreadable if a campaign
  ever changed ruleset. `parseRouteDate` returns `null` rather than guessing at a
  half-typed date, so the schedule does not lurch while somebody types.
- Watch also: the schedule is derived on every read, never stored — the same
  reasoning as the ledger's running balance. A stored projection goes stale the
  moment a leg runs long.
- Verified in a browser on the real Feast Contract route: 14 weeks of travel
  estimated, arriving 195-1105 against a 279-1105 deadline with 12 weeks to
  spare; recording an arrival at Extolay of 160-1105 reported 8 weeks late,
  pushed the finish to 251-1105, and flipped the slack.
- **Caveat worth carrying:** the parsec figures those estimates rest on are, per
  the campaign notes, "column-distance arithmetic, not a real hex count". The
  schedule totals whatever it is given. It can say the route is 40 days over; it
  cannot say the distances were guesses.
- Commit: feat(route) — schedule the journey, not just the stops.

## 2026-08-09 — The ledger grows accounts, so the ship's debt can be seen
- Symptom: the cashbook could record Cr201,335 leaving every month and could
  never show the mortgage shrinking. A liability is not cash, and single-entry
  has nowhere to put one — so "how much do we still owe on the *Leap*?" was a
  question the books could not answer.
- Fix: named accounts. An entry names the account it moved money out of and,
  optionally, the account it moved into. A mortgage payment is one entry that
  takes Cr201,335 out of Cash and puts it against the Ship Loan, so the debt
  falls toward zero on screen. Plus opening balances, and a JSON import for
  lifting a campaign's starting position out of session notes.
- Surfaces: `types/ledgerAccount.ts`, `utils/ledgerAccounts.ts`,
  `utils/ledger/parseLedgerImport.ts`, `ledgerAccountRepository`,
  `version(17)`, `AccountsPanel`, `LedgerImportModal`, `useLedger`.
- Watch: **the sign convention is the whole design.** A liability holds what you
  owe as a *negative* number, and that falls out of one rule rather than a
  special case: the counter side of an entry receives the opposite sign. So
  `-201,335` against Cash adds `+201,335` to the loan. There is no branch on
  account kind anywhere in the arithmetic — `kind` only decides whether the UI
  writes "owed" instead of a minus sign. Mutation-checked: flipping the counter
  sign fails three tests.
- Watch also: an entry naming **no** account counts against the primary. That is
  what makes this additive — every entry written before accounts existed still
  lands in the right place, and the common case needs no choosing. An entry
  naming an account that has since been deleted also falls back to the primary:
  showing money in the wrong pot beats losing it from the books.
- Watch also: the primary account cannot be deleted, and `ensureForCampaign`
  repairs a campaign that somehow has none by promoting the oldest. Two
  primaries would make "the account an entry belongs to" ambiguous, so it
  demotes the extras.
- Watch also: **the importer refuses to guess a sign.** Amount, `direction`, and
  separate `in`/`out` columns are all accepted, but an entry carrying both an in
  and an out figure is skipped rather than resolved — guessing would be wrong
  half the time, and an expense read as income leaves a balance wrong by twice
  the figure and entirely plausible. `parseMoney` returns `null`, never a silent
  zero, for the same reason.
- Watch also: a debt written as a positive "we owe 40,000,000" is flipped and
  the flip is **reported**. It is the natural way to say it and the opposite of
  how it is stored.
- Watch also: when nothing in a file can be imported, the error carries the
  warnings explaining why. They are the only account the user gets of what is
  wrong, and swallowing them leaves them with a file that fails for no stated
  reason.
- Watch also: opening balances are written as their own dated entries, not as a
  field on the account. "What did we start with" is a fact with a date, and
  burying it in the account record would keep it out of the book it belongs in.
- Verified in a browser on the real ship: importing Cr40,000,000 owed plus the
  Session 1 spends and a Cr201,335 mortgage payment gives
  **Cr592,565 held · Cr39,798,665 owed**, with the debt shown as owed rather
  than as a negative number.
- Note on scope: the original spec excluded double-entry pending research. This
  is double-entry in substance — two accounts, opposite signs — without the
  debit/credit vocabulary, which is what was actually asked for later. Recorded
  so the divergence from that exclusion is visible rather than quietly absorbed.
- Commit: feat(ledger) — accounts, opening balances, and a JSON import.

## 2026-08-09 — Ship costs that come round on their own, in campaign time
- Symptom: the mortgage and the monthly nut had to be typed in by hand every
  time the fiction moved on, and nobody remembers. Worse, there was no clock to
  hang them on — the ledger dated entries in real time while the ship charges
  per in-world month.
- Fix: recurring bills that accrue against a **campaign date**. Advance the date
  and everything due posts as ordinary ledger entries. Plus contingent accounts,
  which is how the benefactor's mortgage cover is modelled.
- Surfaces: `types/recurringBill.ts`, `utils/ledger/accrual.ts`,
  `recurringBillRepository`, `version(18)`, `BillsPanel`, `Campaign.campaignDate`,
  `LedgerAccount.contingent`, and a top-level `SystemDefinition.calendar`.
- Watch: **campaign time, not real time.** A journey played across three
  Saturdays still costs six months of mortgage. Posting against the real
  calendar would make the ship cheaper the longer the group takes to play, which
  is exactly backwards. Nothing accrues while the campaign date sits still —
  advancing it is the act that costs money.
- Watch also: **posting is idempotent, and everything rests on that.** Each bill
  carries `postedThrough`; a charge falls due only strictly after it, and the
  watermark advances with the charges. That is what makes it safe to run on
  every screen open. Mutation-checked: ignoring the watermark, or counting the
  occurrence limit from zero instead of from `postedCount`, both fail.
- Watch also: the first charge falls **on** the start date, not a period after
  it. "The mortgage starts on 097" means a payment on 097. Nine tests fail if
  that shifts.
- Watch also: watermarks are written **after** the entries, not before. If the
  entry writes fail partway the bill still shows the charges as outstanding,
  rather than marking them done and swallowing the money.
- Watch also: a per-run cap stops a start date set years ago from dumping
  hundreds of rows at once, and `truncated` says so. Silently stopping would
  read as "all caught up".
- Watch also: **the benefactor's mortgage cover is a contingent liability, and
  is disclosed rather than booked.** The bill draws on an escrow account instead
  of cash, so the crew's money is untouched, the ship's debt still falls, and
  the obligation accrues where it belongs. It is reported as "at risk" and kept
  out of net worth — booking it would make the crew look bankrupt for money they
  will probably never pay. Twenty-seven months is an `occurrenceLimit`; after
  that the arrangement lapses and the bill stops on its own.
- Watch also: the effect that posts on open is guarded by a ref. React
  double-invokes effects in development, and two runs racing the same watermark
  would write every charge twice.
- Watch also: **`BillsPanel` opens by default even when empty.** It was gated on
  `bills.length > 0`, which hid the campaign-date field and the only way to add
  a first bill — a collapsed `SectionPanel` still renders its children, so they
  sat in the DOM unreachable. Found by a browser run, not by a test.
- Watch also: negative zero, for the third time in this codebase — negating an
  empty total yields `-0`, which renders as "-0". See also
  `ledgerMath.computeDistribution`.
- Verified in a browser on the real arrangement: importing Cr40,000,000 owed
  with an escrow account, then a Cr201,335 bill drawn on escrow paying down the
  loan 27 times, then advancing 097-1105 → 187-1105, gives
  **Cr500,000 held · Cr39,194,660 owed · Cr805,340 at risk** with cash untouched
  and the bill counting down "23 left". Reloading does not double-post.
- Commit: feat(ledger) — recurring ship costs that accrue in campaign time.

## 2026-08-09 — opening balances on account creation, and accounting vocabulary
- Symptom: an account could only be opened at zero. The one number every account
  starts with — a mortgage's principal, a cash float — could only be entered
  through the JSON importer, which is a strange place to keep it. Separately the
  UI vocabulary ("Money we have", "Owed only if something fails", "— nothing (it
  is just a cost) —") was written for someone who had never seen a ledger, which
  made it longer and vaguer than the thing it named.
- Fix: the new-account form takes an opening balance and a note. The opening is
  booked as a **dated ledger entry**, not a column on the account — "what did
  this start at" is a fact with a date, and keeping it in the book puts it in the
  running balance, the export and the session log like every other movement.
  Vocabulary is now Asset / Liability / Contingent liability, with balances
  reading Outstanding / Contingent / Settled and the total reading Net position.
- Surfaces: `AccountsPanel` (form + labels), `useLedger.addAccount` (now takes an
  object and writes the opening entry), `BillsPanel` (Recurring charges,
  Interval, First charge, Term, Charge to, Applied against), `LedgerScreen`.
- Watch: **an opening on the account record would have been a second, invisible
  source of truth.** Every balance reader would have had to remember to add it,
  and the one that forgot would be off by exactly the opening — silently, and
  only for accounts that had one. The entry keeps a single path.
- Watch also: the sign conversion (liability typed positive, stored negative)
  lives in `AccountsPanel`, deliberately next to the input that creates the
  ambiguity. `useLedger.addAccount` takes an already-signed number so the JSON
  importer and the form cannot disagree about it.
- Watch also: **the headline "Balance" folded every entry regardless of account.**
  With one cash account that was the cashbook balance; once a mortgage could be
  opened it read -Cr 44,936,045 while cash was Cr 500,000 and net position was
  -Cr 39,500,000 — three numbers, one of them meaning nothing. Pre-existing, but
  opening balances made it trivial to hit. Now fixed: `computeRunningBalance`
  takes an optional `cash` set and folds **cash on hand**, counting the near side
  and the counter side with the opposite sign — the same rule
  `computeAccountBalances` uses, so a cash→savings transfer nets to zero instead
  of looking like the money left. The headline reads "Cash on hand", the column
  reads "Cash", and the final row equals the asset total *by construction* rather
  than by coincidence, so the two cannot disagree on screen. Omitting the set
  keeps the old whole-book fold, which is what the exporter still wants.
- Verified in a browser: Cr40,000,000 liability and Cr5,436,045 contingent both
  store negative and display as magnitudes; contingent stays out of net position
  (-Cr 39,500,000, not -Cr 44,936,045); a Cr500,000 asset stays positive; the
  opening mirrors into the session log.
- Commit: feat(ledger) — opening balances on account creation, accounting
  vocabulary.

## 2026-08-09 — recurring charges reached the book but never the session log
- Symptom: a played-through session (opening balances, five movements, a
  Cr819,000 payout, three recurring charges, three months advanced, then three
  years) produced **79 ledger movements and 8 session-log lines**. Every hand-
  entered movement mirrored; every automatically posted charge did not.
  `postDueBills` wrote `ledgerRepository.create` in a loop with no `mirrorToLog`
  — the one write path that skipped the mirror, and the one that produces the
  most entries.
- Fix: one summary line per posting run, naming each bill and its count and
  total: "posted 12 recurring charges through 187-1105 — Cr 873,340 (Ship
  mortgage x4 Cr 805,340, …)". Not one line per charge: catching up the
  benefactor's whole term posts sixty, and sixty log lines would bury the
  session's actual events under the ship's standing costs.
- Surfaces: `useLedger.postDueBills`, `mirrorToLog` (kind widened to include
  `'bills'`; `ledgerEntryId` is empty for a run summary, because a summary is
  not about one entry and faking an id there would be a lie the metadata keeps).
- Watch: **the per-run cap is 60 and the log line now says when it fired.** A
  three-year jump posts exactly 60 and stops. The toast said "More still due;
  reopen to post them" and then vanished; the log line reported sixty charges
  with no caveat, which reads as "the ship is paid up" months later when it is
  the opposite. Same family as the codebase's no-silent-caps rule.
- Watch also: the cap is global and bills post in bill order, so a starved run
  distributes unevenly — Ship mortgage x23, Life support x36, Berthing x1. It
  catches up on reopen, so no money is lost, but a single run is not a fair
  slice across bills. Left as is; reopening resolves it.
- Watch also: cash is allowed to go negative (the run ended at -Cr 244,100) and
  nothing flags it. `DistributeModal` warns when a payout would overdraw; bill
  accrual does not. Deliberate for now — a crew that cannot pay its nut is a
  real situation the book should be able to represent.
- Verified: the same session run, replayed, shows both summaries in the log with
  the truncation note on the capped one, and all invariants still hold — cash
  matches an independent fold, legs sum to gross, the 27-month term is respected
  (escrow accrued exactly Cr 5,436,045, the real campaign figure), and three
  consecutive reloads post nothing further.
- Commit: fix(ledger) — recurring charges reach the session log.

## 2026-08-09 — a standing notice when cash goes negative
- Symptom: a played-through session ended at -Cr 244,100 and nothing said so.
  `DistributeModal` warned when a payout would overdraw the book, but that was
  the only guard; recurring charges could take the crew under in silence, which
  is the way it will actually happen at a table.
- Fix: a banner in the Credits panel whenever cash on hand is negative, naming
  the shortfall as a positive figure ("Overdrawn by Cr 39,000"). Bill posting
  additionally raises an **error** toast rather than the success one — "Posted 12
  recurring charges" in green is a reassuring message to show someone whose ship
  has just run out of money, and those charges are the reason it happened.
- Surfaces: `LedgerScreen` (banner + toast severity), `useLedger.reload` (now
  returns the cash balance it computed), `useLedger.postDueBills` (returns
  `cashAfter`).
- Watch: **the caller could not read `balance` off the hook to decide this.**
  Bill posting has just written entries; the new balance lands on the next
  render, so the closure sees the figure from *before* the charges and would
  report a solvent crew. `reload` returning the value it computed is what makes
  the check see the book it just wrote.
- Watch also: the banner is a standing notice, not a toast, because being unable
  to pay is a standing condition. A toast is gone by the time anyone reaches for
  the book.
- Watch also: zero is not overdrawn. The test pins `Cr 0` as clean and `-Cr 1` as
  warned, because `< 0` and `<= 0` are one character apart and the wrong one
  cries wolf at every fully-spent book.
- Verified in a browser across the whole range: positive clean, exactly zero
  clean, one credit under warns, Cr 50,000 under states the shortfall, recovery
  clears it, recurring charges trigger it, and it survives a reload.
- Commit: feat(ledger) — warn when cash goes negative.

## 2026-08-09 — the two undersized touch targets on the timeline
- Symptom: an emulated tablet pass at 800x1280 and 1280x800 found two controls
  under the project's own `--touch-target-min: 44px` — the track expand chevron
  at 24x24 and "Open Knowledge Base ->" at 165x20.
- Fix: the KB link gets `min-h-[var(--touch-target-min)]` and centres its label,
  so the control grows without the type growing. The chevron keeps its 24px box
  and grows only its **hit area**, via a transparent `before:-inset-[10px]`
  pseudo-element: 24 + 10 either side = 44.
- Surfaces: `components/timeline/TimelineTrackRow.tsx`, `features/kb/VaultBrowser.tsx`.
- Watch: **do not "fix" the chevron by making it `h-11 w-11`.** A 44px chevron
  dominates a track row that is only 72px tall (`useTimelineLayout` floors
  `rowHeight` at 72) and pushes the label off its baseline. The inset
  pseudo-element is deliberate. It is safe precisely because rows are >= 72px and
  the chevron sits under 16px of padding, so the taller target cannot reach the
  row above or below.
- Watch also: **a rect-based audit cannot verify this and will keep reporting the
  chevron as 24x24.** `getBoundingClientRect` measures the box, not the hit area.
  The honest check is `document.elementFromPoint` at each corner of the intended
  44x44 square — and it must scroll the element into view first, because
  `elementFromPoint` returns `null` outside the viewport, which reads as "not
  tappable" for anything below the fold and manufactures failures.
- Verified: every corner of the 44px box resolves to the control in both
  orientations, and a tap 20px off-centre — outside the visible chevron —
  actually toggles the track (`aria-expanded` false -> true).
- Commit: fix(timeline) — 44px touch targets for the chevron and the KB link.

## 2026-08-09 — panel subtitles were below the readable floor
- Symptom: every `SectionPanel` subtitle rendered at **11.2px** (`0.7rem`). On the
  Ledger that is the line carrying "Assets Cr 500,000 - Liabilities Cr
  40,000,000", and on a tablet at arm's length — which is how this app is
  actually read — it is under the readable floor.
- Fix: `text-[length:var(--size-xs)]` (12px). The token rather than a literal, so
  the subtitle tracks the type scale instead of drifting from it the way an
  arbitrary `0.7rem` already had.
- Surfaces: `components/primitives/SectionPanel.tsx`.
- Watch: three other `0.7rem` labels remain, all **uppercase tracking-wide**, in
  `RepeatableRows` and `SheetScreen` (x2). Uppercase at 11.2px is harder to read
  than sentence case at 11.2px, so these are the worse offenders — left alone
  only because the request was scoped to panel subtitles.
- Watch also: the remaining sub-12px hit is the timeline's `hour` axis tick at
  11px, which is a dense axis label rather than content.
- Verified: a tablet pass at 800x1280 and 1280x800 over Ledger, Jump Route and
  Session reports no sub-12px text on Ledger or Jump Route, where four subtitles
  previously failed.
- Commit: fix(ui) — panel subtitles to 12px.

## 2026-08-09 — the remaining uppercase labels to 12px
- Symptom: three `0.7rem` (11.2px) labels survived the subtitle pass, all
  **uppercase tracking-wide** — `RepeatableRows` column headers, the Connections
  group headings, and "Open in Ships ->". Uppercase at 11.2px is harder to read
  than sentence case at the same size, and all three live on the character
  sheet, which is open for most of a session.
- Fix: `text-[length:var(--size-xs)]` (12px), the same token the panel subtitle
  now uses. No `0.7rem` remains in `src`.
- Surfaces: `components/fields/RepeatableRows.tsx`,
  `screens/SheetScreen.tsx` (Connections headings, ship link).
- Watch: **`RepeatableRows` draws its column labels per row, so an empty sheet
  renders none of them.** A verification that only loads a fresh character
  measures nothing and passes — the labels have to be brought into existence by
  adding a row first. The same trap as every other check in this codebase that
  passed because the command found nothing to look at.
- Watch also: a `+ ` text match hits the characteristic steppers as well; the
  add-row buttons need naming exactly (`+ Ally`, `+ Contact`, ...).
- Verified: with a character and one row in each connection group, the sheet
  reports 12 uppercase labels, all at 12px, and nothing at all under 12px.
  The ship link (`SheetScreen:1030`) is the same one-token swap but was not
  brought on screen — it needs a ship linked to the character.
- Commit: fix(ui) — remaining uppercase labels to 12px.

## 2026-08-09 — the timeline axis to 12px, and the crowding worry was wrong
- Symptom: the last sub-12px text in the app was on the timeline axis. I had
  twice advised leaving it, on the theory that widening a ruler label would
  crowd the ticks. That theory was never measured.
- Fix: both axis labels to `--size-xs` (12px) — the scale-unit caption and the
  major tick labels. Measured afterwards: at the densest scale that renders
  (Minutes, 24 ticks) the tightest gap between neighbouring labels is **171px**,
  and at the default scale it is 221px, identical in portrait and landscape.
  There was never any crowding to worry about.
- Surfaces: `components/timeline/TimelineHeaderAxis.tsx`.
- Watch: **the audit that found "hour @11px" was blind to the actual ticks.** It
  scanned `span, p, td, th, label, li`; the tick labels are `div`s, so the only
  thing it ever reported was the scale-unit caption. Both were 11px, so the fix
  is the same, but the audit was measuring the smaller of two problems and would
  have declared victory after fixing only the caption.
- Watch also: the first version of the crowding check printed **"ALL CHECKS
  PASSED" having run zero checks** — the scale control is a dropdown, not
  buttons, so every selection silently failed and no tick was ever measured. It
  now fails when no scale produced labels. This is the fifth instance in this
  codebase of a check passing because the command found nothing to look at.
- Watch also: Weeks and Months render no tick labels at all with a single
  session's span, so those two scales are unmeasured rather than verified.
  Remaining sub-12px text: the axis marker pill and the now-marker, both 10px,
  and `TimelineItemBar`'s subtitle at 11px.
- Commit: fix(timeline) — axis labels to 12px.

## 2026-08-09 — the last small timeline labels, and a wrong call about markers
- Symptom: three labels below 12px remained on the timeline — the axis marker
  pill and the "Now" chip at 10px, and `TimelineItemBar`'s subtitle at 11px.
- Fix: all three to `--size-xs` (12px). No sub-12px literal remains anywhere in
  `src/components/timeline/`.
- Surfaces: `TimelineHeaderAxis.tsx`, `TimelineNowMarker.tsx`, `TimelineItemBar.tsx`.
- **Correction:** an earlier note in this file claimed the axis marker pill was
  unreachable in production, on the grounds that `notesToTimeline` returns
  `markers: []`. That was the wrong adapter. `SessionTimelinePanel` uses
  `features/session/sessionTimelineAdapter.ts`, which emits a `Start` marker
  (line 178). The pill renders, and it has now been measured at 12px.
- Watch: **an instantaneous timeline event renders at a 28px floor and stays
  there at any zoom.** `TimelineItemBar` treats anything under 92px as compact
  and drops the title and subtitle entirely, and `renderedWidth` clamps to
  `max(width, 28)`. Bar width comes from *duration*, not zoom, so zooming a
  zero-length event never widens it. Anything verifying the subtitle needs an
  event with a real span — an encounter with a start and an end.
- Watch also: a session seeded without `date` and `startedAt` reads "Started:
  Invalid Date" and the timeline window excludes every note, so the ruler draws
  zero events and any check over it measures nothing. Both fields are required
  in fixtures.
- Watch also: log entries are created by the composer's **Commit** button.
  Pressing Enter inserts a newline and writes nothing, which is why an earlier
  attempt reported three entries logged and zero events on the timeline.
- Verified: the Now chip and the Start marker pill both render at 12px in
  portrait and landscape. **The item subtitle is unverified** — every event
  reachable in a fresh session is instantaneous and therefore compact, where the
  subtitle is suppressed by design. The change is the same one-token swap as its
  siblings, but it has not been watched rendering.
- Commit: fix(timeline) — remaining small labels to 12px.

## 2026-08-09 — accounts are editable, so the default Cash account can be opened
- Symptom: an opening balance could only be set at creation, and the primary
  **Cash** account is created automatically by `ensureForCampaign` — so the one
  account every campaign has was the one account whose opening could never be
  set. `useLedger.updateAccount` existed but had no caller and no notion of an
  opening. Declared, wired to nothing.
- Fix: an Edit control on every row, including the primary one, reusing the
  create form. `updateAccount` now reconciles the opening.
- Surfaces: `AccountsPanel` (Edit button, shared form, Save), `useLedger.updateAccount`,
  `LedgerScreen` (passes `openings`, derived from the entries).
- Watch: **"set the opening to X" has three shapes and all three must be
  handled** — amend the existing entry, write a first one, or delete it when X
  is zero. The opening is a ledger entry, not a column, so writing a new entry
  on every save would leave the account holding several and the balance would
  read as their sum. Test pins "still exactly one opening entry" after a second
  edit.
- Watch also: **`kind` is deliberately not editable.** It decides the sign of
  every entry already booked against the account, so switching asset to
  liability would invert the history rather than reclassify it. The control is
  disabled and labelled "(fixed)" rather than left looking editable and silently
  doing nothing.
- Watch also: omitting `opening` from the patch leaves it alone. Renaming an
  account must not touch its money — pinned by a test that renames and asserts
  the opening and the cash figure are both unchanged.
- Watch also: `openings` is derived from the entries in `LedgerScreen`, not read
  off the account record. A copy on the account would be a second source of
  truth that the ledger could drift away from.
- Verified in a browser, 16 checks: Cash starts at zero, takes an opening, the
  form prefills, a second edit amends rather than stacks, clearing removes the
  entry, a liability prefills unsigned and stores negative, renaming disturbs
  nothing, and the edit reaches the session log.
- Commit: feat(ledger) — edit an account, including its opening balance.

## 2026-08-09 — polishing sweep: one yamlValue, a stale system, a stuck flag
- Symptom: three defects of the same shape — code that looked correct because
  nothing had exercised the path that breaks.
  1. `yamlValue` existed as **six near-copies**, one per export renderer, which
     had diverged into two variants that each carried the other's bug. Four
     supported arrays but emitted raw newlines inside double-quoted scalars; two
     flattened newlines but could not render a list.
  2. `useSystemDefinition` never reset on a `systemId` change.
  3. `DistributeModal` cleared `isSaving` only in its `catch`.
- Fix: one shared `utils/export/yamlValue.ts` doing both jobs, with 18 tests;
  reset `system`/`error`/`isLoading` before each fetch; move the flag clear to a
  `finally`.
- Surfaces: `utils/export/yamlValue.ts` (new) and the six renderers,
  `features/systems/useSystemDefinition.ts`, `features/ledger/DistributeModal.tsx`.
- Watch: **a raw newline inside a double-quoted YAML scalar ends the
  frontmatter line.** `title: "a
b"` with a real break parses as a broken
  document, not a two-line title — and titles and tags are user-typed, so the
  note and session renderers were the ones exposed. Frontmatter is single-line
  by construction: a newline becomes a space. Removing that one `.replace` fails
  six tests by name.
- Watch also: escape the backslash **before** the quote. Doing it the other way
  doubles the backslashes the first step introduces.
- Watch also: resetting `useSystemDefinition` to `null` is safe *by
  construction* — `null` is the initial state, so every consumer already handles
  it. The stale `error` was the worse half of that bug: it never cleared, so one
  unknown system poisoned the hook for every campaign opened afterwards.
- Watch also: `DistributeModal` only *looked* correct because the parent
  unmounts it on success. That is the caller's behaviour, not the component's
  contract; a "record another" flow would have found every button dead.
- Commit: fix(export,systems) — one yamlValue, and stop serving a stale system.

## 2026-08-09 — deleting an account unbalanced the book
- Symptom: removing a ledger account with entries in it **succeeded**. The
  account row was soft-deleted and its entries kept pointing at it, but both
  `computeAccountBalances` and the cash-on-hand fold walk only *live* accounts —
  so the money silently left the totals while the entries stayed listed in the
  table. Delete an asset account holding Cr500,000 and Cr500,000 of cash
  vanished from the headline with the rows still on screen. Nothing failed
  loudly; the numbers just stopped agreeing.
- Fix: `softDelete` refuses and returns why — `primary`, `missing`, or
  `has-entries` with the count. The UI names the count and the way out
  ("Delete or reassign them first"), rather than a bare "could not remove".
- Surfaces: `ledgerAccountRepository.softDelete` (now returns
  `AccountDeleteRefusal | null`), `useLedger.removeAccount`, `LedgerScreen`,
  `AccountsPanel`.
- Watch: **reassigning the entries to the primary account was the tempting
  alternative and is wrong.** The only sane target is cash, and moving a
  *liability's* entries onto cash turns a debt into spending. Refusing is what
  real bookkeeping does with an account that has transactions in it.
- Watch also: **`accountId` and `counterAccountId` are deliberately unindexed**
  on `ledgerEntries` (schema note in `db/client.ts`), so `.where('accountId')`
  throws at runtime. The check scans one campaign's entries off the indexed
  `campaignId` instead. It runs on a delete, not on every read.
- Watch also: the far side of a transfer counts. `counterAccountId` moves an
  account's balance as much as the near side does, so a transfer pins the
  account down too — pinned by its own test.
- Verified: 10 repository tests (removing the guard fails 5 by name) plus a
  browser run — refusing leaves the account listed and cash unmoved at
  Cr500,000, and clearing the entry lets the deletion through with cash at Cr0.
- Commit: fix(ledger) — refuse to delete an account that has entries.


## 2026-08-09 — a recurring charge pins its account too
- Symptom: the has-entries guard closed the obvious door and left one open. A
  **recurring bill** naming an account holds no entries until it posts, so a
  fresh account could still be deleted out from under one. The next time the
  campaign date moved, its charges landed on a dead account and their money left
  the totals — the same defect, one step later.
- Fix: `softDelete` also refuses `has-bills`, with the count, checking both
  `accountId` and `counterAccountId`.
- Surfaces: `ledgerAccountRepository.softDelete`, `LedgerScreen` toast.
- Watch: this is the shape to look for whenever a row can be referenced without
  yet having produced anything. "No rows point at it" is not the same as
  "nothing depends on it" — a *template* that will produce rows later depends on
  it just as much.
- Verified: 13 repository tests; the full suite is 1081.
- Commit: fix(ledger) — a recurring charge pins its account too.

## 2026-08-09 — the ledger export had fallen behind the ledger
- Symptom: `renderLedger` still described the cashbook as it was before
  accounts, opening balances and recurring charges existed. Two consequences:
  1. It folded the Balance column over **every** entry, so the exported figure
     summed the mortgage's opening alongside a fuel purchase — the same defect
     fixed on screen earlier the same day and left behind here. The app said
     Cr500,000 and the export said -Cr39,500,000 for the same book.
  2. Accounts and bills were absent entirely, so an export lost the mortgage,
     the escrow and the monthly nut.
- Fix: an optional `LedgerExportContext` carrying accounts, bills, campaign date
  and calendar. With accounts the column folds cash and is named **Cash**;
  without them the old whole-book fold stands, which is right for a
  single-account book and keeps the three-argument call valid.
- Surfaces: `utils/export/renderLedger.ts`, `features/export/useExportActions.ts`.
- Watch: the frontmatter key changes with the column — `closing_cash` rather
  than `closing_balance`. A reader diffing two exports must not find the same
  key silently meaning something different.
- Watch also: **fixing a fold on screen does not fix it in the export.** They are
  separate call sites of the same helper, and only one of them was passed the
  new argument. Whenever a derivation changes, grep the other callers.
- Watch also: the test asserting "cash is not folded with the loan" has to be
  scoped to the mortgage's own table row — `-Cr 39,500,000` legitimately appears
  further down as the net position, so a document-wide `not.toContain` asserts
  the opposite of a neighbouring test.
- Verified: 28 tests on this renderer, 14 of them the pre-existing
  entries-only ones, unchanged. Full suite 1095.
- Commit: feat(export) — accounts and recurring charges in the exported ledger.

## 2026-08-09 — Escape, a focus trap and focus restore for hand-rolled dialogs
- Symptom: the ledger's three overlays are hand-built `<div role="dialog">`s.
  They announced themselves as modal and behaved as nothing of the kind — no
  Escape, no focus trap, no focus restore. Tab walked straight out of the dialog
  into the page behind it, which on a tablet means the on-screen keyboard starts
  editing the ledger underneath the modal still covering it.
- Fix: `components/primitives/useOverlayDismiss`, a bridge for overlays whose
  markup would have to be restructured to adopt the Radix-backed `Modal`. New
  overlays should still use `Modal`.
- Surfaces: `DistributeModal`, `LedgerImportModal`, `RouteImportModal`.
- Watch: **a trap is only a trap if focus is inside it.** `LedgerImportModal` had
  no `autoFocus`, so focus never entered, and a trap that only acts at the first
  and last element did nothing at all. The hook moves focus in on mount.
- Watch also: **`autoFocus` fires during commit, before effects.** Capturing the
  previously-focused element inside the effect therefore captured the dialog's
  *own* input, and the hook faithfully restored focus to a detached node. It is
  captured during the first render instead, which happens before the commit.
- Watch also: two plausible ways to detect "was focus lost" both fail. The
  dialog node is already detached by cleanup time, so asking whether it contains
  the active element always says no; and focus does not reliably fall back to
  `body` — here it landed on a tabbable scroll container, indistinguishable from
  a deliberate move. A `focusin` listener records it as it happens instead.
- Watch also: the keydown listener is on the **capture** phase, or an input that
  stops propagation on its own keydown swallows Escape first.
- Verified: 8 browser checks across two dialogs — opens, Tab stays inside over 25
  presses, Escape closes, focus returns to the opener.
- Note: most of the 2026-07-26 hardening backlog is now stale. Items 3, 4, 7, 9,
  10 and 17 were checked this pass and are already fixed in Production.
- Commit: feat(a11y) — Escape, focus trap and focus restore for hand-rolled dialogs.

## 2026-08-10 — Traveller vocabulary out of shared code: finance lines and the reserve pot
- Symptom: the sheet's Finances panel named six Traveller field ids in
  `SheetScreen` and again in `PrintableSheet` (two copies, already in different
  orders), with "(Cr)" baked into the labels; the payout split called its
  off-the-top pot "Ship fund" everywhere including the export; the debt list was
  labelled with `denominations[0]`.
- Fix: `system.financeFields` (id/label/unit/per/group) read by both sheet
  surfaces; `terms.reservePot` read by the split editor, distribute preview,
  entry table, session log and export; both new readers and the debt list take
  the unit from `baseDenominationId`.
- Surfaces: SheetScreen, PrintableSheet, LedgerScreen, SplitEditor,
  DistributeModal, useLedger, renderLedger, ledgerMath.
- Watch: the persisted `shipFund` leg kind and `shipFundPct` field are
  deliberately NOT renamed — they are stored ids, and renaming them orphans every
  distribution already written. Only the label moves.
- Watch also: `denominations[0]` is not the base denomination. For a coins system
  it is gold while the stored figure is copper — wrong by 100. Read
  `baseDenominationId`.
- Verified: build clean, 1104 tests (3 new). Browser check against the live
  Traveller character — all six finance lines render with labels identical to the
  hardcoded ones, and the ledger still reads "Ship fund".
- Commit: feat(systems) — finance lines and the reserve pot come from the ruleset.

## 2026-08-10 — Vehicles become a ruleset declaration, not a Traveller starship
- Symptom: `types/ship.ts` spelled one game's starship into the schema —
  `hullCurrent/Max`, `fuel*`, `cargo*` (tons), `jump`, `thrust`, `tl`, `armor`,
  plus a Pilot/Navigator/Engineer/Gunner/Sensors/Steward roster as a const. The
  screen restated the labels; the sheet's pointer card and the campaign list held
  two copies of the same hardcoded stat line, in different orders. A system with
  a Toughness rating and no jump drive had nowhere to put either.
- Fix: `system.vehicles` (label, singular, counters, specs with sections,
  crewRoles, summaryCounterIds, subtitleSpecId), mirroring `routePlanner`. The
  record now holds open `counters` and `specs` bags keyed by the declared ids;
  only name/owner/crew/weapons/notes stay columns. `summariseCounters` is shared
  by both list surfaces.
- Surfaces: types/ship.ts, shipRepository, ShipsScreen, SheetScreen ships panel,
  CampaignHeader nav, features/vehicles/vehicleView.
- Watch: the migration is read-path (`upgradeShip`, v1→v2), not a Dexie upgrade —
  so nothing rewrites on upgrade and a rollback is lossless (legacy columns are
  deliberately left in the row). `update()` therefore writes the *upgraded* row
  rather than patching in place: patching would leave schemaVersion 1 with the
  old columns authoritative, and the next read would re-derive the bags over the
  edit just made.
- Watch also: a ruleset declaring no `vehicles` hides the nav entry and the
  screen explains itself, rather than offering an empty starship.
- Verified: build clean, 1133 tests (20 new). Browser check against the live
  Traveller ship — list line byte-identical, editor panels unchanged, and the
  stored row upgraded to v2 with an edit round-tripping through the bags.
- Commit: feat(systems) — a ruleset declares its own vehicles.

## 2026-08-10 — The bestiary stat block becomes a ruleset declaration
- Symptom: `creatureTemplate.stats` was a closed, required `{hp, armor, movement}`
  — three Dragonbane numbers a Traveller animal could not use and could not
  extend. The labels over them were ALREADY engine-driven
  (`labels.creatureHealth`/`creatureArmor`/`creatureMovement`), so a Traveller
  creature honestly read "END / Plating / Stride" over a stat block that was
  structurally somebody else's. `CreatureTemplateCard` additionally printed a
  hardcoded "HP x · Armor y · Mv z".
- Fix: `system.creatures.statFields` (id/label/abbr/summary) plus `healthStatId`
  and `armorStatId`; `stats` becomes `Record<string, number>`. Traveller declares
  Hits/Armour/Speed/STR/DEX/END. Shared readers in
  `features/bestiary/creatureStats.ts`.
- Surfaces: BestiaryScreen (tiles + add-to-encounter), CreatureTemplateCard,
  CreatureTemplateForm, ParticipantDrawer, CombatEncounterView.
- Watch: NO data migration, deliberately — every stored creature already
  satisfies the open record because the default declaration names exactly the
  three old keys. Traveller keeps the same storage ids and changes only labels,
  so no existing creature is orphaned. Dragonbane declares no `creatures` block
  at all: the default set IS its stat block, which is what keeps it unchanged.
- Watch also: a stat STORED under an undeclared id is kept and shown in a
  trailing "Other" group (the custom-skills precedent). That is the opposite of
  the import rule, and deliberately so — stored data is somebody's typing, an
  import is untrusted input.
- Verified: build clean, 1148 tests (11 new). Browser check on the live Traveller
  campaign — six stat tiles, correct labels, card summary reads "Hits · Armour ·
  Spd".
- Commit: feat(bestiary) — a ruleset declares its own creature stat block.

## 2026-08-10 — Creature JSON import, for stat blocks researched with an AI
- Symptom: no way to get a researched animal into the bestiary except typing it,
  and the creature form has no editor for attacks/abilities/skills at all — so
  those fields were only reachable via a full bundle import.
- Fix: `parseCreatureImport` + `CreatureImportModal`, built as the sibling of
  `parseRouteImport`/`RouteImportModal` — paste or file, preview before writing,
  and the preview reports what was ignored.
- Surfaces: BestiaryScreen ("Import…" button), sample-data/creatures.example.json.
- Watch: forgiving about SHAPE, strict about STATS. Accepts a bare array, a
  creatures/bestiary/animals wrapper or a single unwrapped creature; matches stat
  keys by id, label or abbr, case- and separator-insensitively; reads stats
  nested or spread at the top level; pulls a leading integer out of
  "40 (average)" and "6m"; takes skills as a list or a {name: level} map.
  An undeclared stat key is dropped and REPORTED.
- Watch also: only a *nested* stat block reports unknown keys. At the top level
  an unrecognised key is far more likely to be another property of the creature
  ("habitat", "sources") than a mistyped stat, and reporting those as ignored
  stats is noise that hides the real warning.
- Watch also: a stat with no readable number is OMITTED, not stored as 0 —
  "the file did not say" and "this creature has 0 hits" are different claims.
- Verified: build clean, 1171 tests (23 new, one of which asserts the shipped
  example file imports with zero warnings — it exists to be handed to an AI as
  the shape to follow, so it must stay importable). Browser check: deliberately
  messy AI-shaped JSON imported two creatures with full attacks/abilities/skills,
  mapped "beast"→animal, read "40 (average)"→40, reported `morale` as ignored and
  correctly did NOT report `habitat`.
- Commit: feat(bestiary) — import creatures from JSON.

## 2026-08-10 — Attacks, abilities and skills become editable
- Symptom: `CreatureTemplateForm` passed the three list fields straight through
  (`attacks: initial?.attacks ?? []`) with no editor at all. Once the JSON
  importer shipped, import was the ONLY way they were ever populated — so a typo
  in an imported damage die was permanent, fixable only by deleting the creature
  and importing it again.
- Fix: three `RepeatableRows` tables in the form, with the row/typed conversions
  extracted to `creatureRows.ts` and tested.
- Surfaces: CreatureTemplateForm, features/bestiary/creatureRows.ts.
- Watch: a row with no name is DROPPED on save — adding a row and thinking
  better of it is the normal way to use an add/remove list, and a nameless attack
  stores as a blank line that can only be deleted by position.
- Watch also: a blank or unparseable skill level stores as 0, never `NaN`. `NaN`
  passes the type (it IS a number), serialises to `null` in an export and renders
  as "NaN" on the stat block — a corrupt record that type-checks.
- Watch also: the three column sets use DISTINCT labels ("Attack"/"Ability"/
  "Skill", not three "Name"s) because `RepeatableRows` uses the label as each
  input's aria-label.
- Verified: build clean, 1181 tests (10 new). Browser round-trip on the imported
  Grey Wolf — edited the bite to 2d6+2, added a range, raised Survival to 3;
  IndexedDB shows exactly that with stats and the other rows untouched.
- Commit: feat(bestiary) — edit a creature's attacks, abilities and skills.

## 2026-08-10 — Creatures export as JSON, round-tripping the importer
- Symptom: creatures left the app only inside a whole campaign bundle. A stat
  block researched, imported and then corrected could not be shared or kept as a
  file — the importer had no counterpart going out.
- Fix: `renderCreaturesToJson` emitting the importer's exact format; "Export" on
  the bestiary header (file, via the existing shareFile/download helper) and
  "Copy JSON" on a single creature (clipboard).
- Surfaces: BestiaryScreen, utils/bestiary/renderCreatureExport.ts.
- Watch: export writes EVERY stored stat, including ones the current ruleset does
  not declare. The file records the creature, not one system's view of it —
  stripping undeclared stats at export loses data silently, whereas the importer
  drops them WITH a warning, which is the right place for that decision.
- Watch also: `description` is Tiptap JSON or a plain string depending on how it
  was authored. Only a string is exported; a document node would come back
  through the importer as "[object Object]".
- Watch also: Export writes the *visible* (filtered) list, not the whole
  bestiary — the predictable reading of a button above a filtered list.
- Verified: build clean, 1191 tests (10 new, incl. an export→import round-trip).
  Browser: exported the live campaign to spinward-run-bestiary.json, read the
  actual downloaded file, pasted it back into the import dialog — two creatures,
  identical values, zero warnings. Import cancelled so the real campaign was not
  duplicated (confirmed still 2 creatures).
- Commit: feat(bestiary) — export creatures as JSON.

