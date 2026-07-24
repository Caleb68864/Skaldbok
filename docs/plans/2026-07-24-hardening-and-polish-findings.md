---
title: Hardening & polish findings (10-scan sweep)
date: 2026-07-24
status: findings — not yet actioned
scope: analysis only; no code changed. Companion to 2026-07-24-traveller-to-engine-extraction.md
method: 3 hardening scans (storage/numeric, engine/import, react/hooks) + 3 polish scans
  (typedoc, a11y/touch, ux/vocabulary) + polarity finding cross-listed from the extraction sweep.
  Items marked ✔verified were independently confirmed by reading the code this session.
---

# Hardening & polish findings

## A. Table-affecting bugs (verify/fix before the Saturday game)

- **A1 — Party/session "damage" heals a Traveller PC (and vice-versa).** ✔verified
  `src/features/session/SessionQuickActions.tsx:648-651` counts the health resource
  *down*; Traveller's `end` is an accumulating damage track (0 = healthy). Same path backs
  `ParticipantDrawer.tsx:69,102`. The Play-dashboard `DamageHealModule` is correct — only the
  session/party quick-action path is inverted. *Fix:* branch on resource polarity (see
  extraction E2) or, minimally, invert for damage-track systems.
- **A2 — Autosave never flushes on unmount → lost edits.** `src/hooks/useAutosave.ts:42-64`:
  the timer-clear cleanup nulls `timerRef` before the unmount-flush effect checks it, so a save
  pending inside the 1000 ms debounce is dropped when you navigate away. Non-Play screens have no
  autosave at all, so the edit lives only in memory. *Fix:* flush whenever `pendingRef.current`
  is set, regardless of the timer.
- **A3 — Autosave errors are invisible on 5 of 7 screens.** `GearScreen`, `MagicScreen`,
  `ProfileScreen`, `SettingsScreen`, `SkillsScreen` ignore `useAutosave`'s `error`; only Play &
  Sheet render it, and only as a small below-the-fold div that vanishes on next success
  (`useAutosave.ts:36`). Quota/private-mode/blocked-upgrade → silent total data loss. *Fix:*
  route autosave errors through `showToast(..., 'error')`; ideally hoist into the shell.
- **A4 — Clearing the Carry Limit override commits 0.** ✔verified
  `src/components/fields/DerivedFieldDisplay.tsx:38-40` — `Number('')===0`, `!isNaN(0)` true,
  so blanking the field writes `derivedOverrides.encumbranceLimit = 0`, which flips
  `tracksEncumbrance` off (`GearScreen.tsx:398`) and hides the readout/overload warning. *Fix:*
  `if (editValue.trim() !== '' && Number.isFinite(parsed)) onOverride(parsed)`.

## B. Hardening — storage & numeric

- **B1 — Wealth clamped to 999,999 on every save.** ✔verified `characterNormalization.ts:68`.
  Irreversible for Traveller credits (ship shares, large payouts). *Fix:* raise/remove ceiling
  or derive from `engine.currency`.
- **B2 — Attribute temp-modifiers are invisible.** `SheetScreen.tsx:453,529` pass a bare id
  (`'str'`) to `getEffectiveValue`, but modifiers are stored namespaced (`attr:str`) and filtered
  by raw string equality (`derivedValues.ts:247`). Base renders; modifier never applies,
  `isModified` always false. *Fix:* compare parsed keys, or pass `attrKey(attr.id)`.
- **B3 — Attributes clamped to min 1; range hardcoded.** `characterNormalization.ts:53`
  `clampNumber(value,1,30,10)` — a Traveller characteristic of 0 becomes 1; non-numeric → 10.
  *Fix:* take min/max from the system, allow 0.
- **B4 — Non-string metadata blanked on save.** `characterNormalization.ts:50` replaces any
  non-string identity field with `''`. *Fix:* preserve primitives / `String()` coerce.
- **B5 — `remakeCurrency` unguarded on NaN delta, zero-value denom, and denom ordering.**
  `currency.ts:27-37` — NaN delta writes NaN into the purse permanently; `value:0` → Infinity;
  greedy loop assumes highest-first sort. *Fix:* bail on `!Number.isFinite(delta)`, sort desc,
  reject `value<=0`. (This is my recently-added util — worth hardening.)
- **B6 — Note-delete cascade not transactional.** `useNoteActions.ts:179-181` — two separate
  awaits; a failed second write detaches the note from its edges with no restore path. *Fix:*
  one `rw` transaction over `[db.notes, db.entityLinks]` (encounterRepository is the model).
- **B7 — Campaign/session soft-delete doesn't cascade and can't restore children.**
  `campaignRepository.ts:76`, `sessionRepository` — orphans sessions/notes/encounters/ships;
  `softDeletedBy` isn't indexed on child tables. *Fix:* cascade under a shared `txId`, add indexes.
- **B8 — Corrupt/forward `schemaVersion` skips the whole migration ladder.**
  `migrations.ts:215-223` — `NaN` passes the `typeof` check and `NaN < 4` is false → zero
  migrations, v1 data cast to current. *Fix:* `Number.isInteger(v)&&v>=1?v:1`, throw on `v>CURRENT`.
- **B9 — `getDerivedValue` applies Dragonbane formulas to every system.** `derivedValues.ts:150-160`
  routes `derived:*` through hardcoded classic-fantasy math; on Traveller `derived:hpMax` → a
  fabricated 10. *Live trap.* (Also extraction E5.) *Fix:* resolve via `engine.derivedStats()`.
- **B10 — metadata `set()` read-then-write races a UNIQUE index.** `metadataRepository.ts:27-33`
  — two overlapping `set('x')` both insert → ConstraintError; reachable via fire-and-forget KB sync.
  *Fix:* wrap in a transaction or key the table on `key`.

## C. Hardening — engine, validation, import/export

- **C1 — Bundle import writes character rows with no migration/validation/sanitization.**
  `import/mergeEngine.ts:146,169`; schema is `z.record(z.any())`. Old-schema or HTML-bearing
  characters reach the sheet and can crash derived code. *Fix:* run `migrateCharacter` +
  `sanitizeCharacterStrings` in `mergeEntity` for characters.
- **C2 — Import silently overwrites a live character** via lexicographic `updatedAt` compare
  (`mergeEngine.ts:166-171`) — no merge, no undo; an older bundle can win. *Fix:* `Date.parse`
  compare, make overwrite opt-in.
- **C3 — Content-hash check false-positives on every round-trip.** `bundleParser.ts:104` hashes
  the post-Zod object; export hashed pre-parse. Users are told a clean re-import "may be tampered
  with" and learn to ignore the warning. *Fix:* hash the raw contents.
- **C4 — Every bundle claims `system: 'classic-fantasy'` and the schema forbids others.**
  `bundleSerializer.ts:50`, `bundle.ts:74` `z.literal`. Traveller bundles become unimportable the
  moment the serializer is "fixed" naively. *Fix:* widen to string/enum, write the real system id.
- **C5 — Failed system-definition load renders a Traveller PC as Dragonbane.**
  `engine/index.ts:56-74` discards `isLoading`/`error`; `getEngine(null)` → classicFantasy. Also
  one render on every mount before async resolves. *Fix:* surface loading/error, hold render.
- **C6 — Damage-track resources never seeded → can't mark dead.** `resourceMaxima.ts:33-34`
  skips absent resources; a Traveller PC without `resources.str` can never deplete that track, so
  `deadAtDepleted:3` is unreachable. *Fix:* create absent tracks at `{current:0, max:attr}`.
  (Current active char has all three tracks, so not a Saturday blocker.)
- **C7 — Any versionless JSON is accepted as a character bundle** (`bundleParser.ts:112-137`,
  missing id/name is only a warning). Picking the wrong file offers to import it. *Fix:* fail closed.
- **C8 — `getEngine` cache keyed on `id@version`** with no invalidation; in-place system edits
  keep serving the stale engine. *Fix:* key on object identity (WeakMap).
- **C9 — Newer bundled `system.json` silently overwrites user-customised definitions**
  (`useSystemDefinition.ts:37-38`). *Fix:* only auto-replace unmodified copies, else prompt.
- **C10 — `startImport` has no try/catch around file read/parse** (`useImportActions.ts:98-99`) →
  unhandled rejection, no toast. *Fix:* wrap + toast.

## D. Hardening — React state & components

- **D1 — Coin/WP logging reads a flag set inside a setState updater.** `CurrencyModule.tsx:29-36`,
  `CombatModule.tsx:33-44`, `MagicModule.tsx:31-34`, `AbilityModule.tsx:118-121` — `let changed`
  assigned inside `updateCharacter(prev=>…)` and read on the next line; unreliable under batching/
  StrictMode → dropped log entries and (for WP) double-spend from stale `wp`. (My recent currency
  code is in this set.) *Fix:* compute `remakeCurrency`/cost from `character` once outside the
  updater, branch on that, log/toast from there; read `prev.resources.wp` inside the updater.
- **D2 — Currency overspend is a silent no-op.** `CurrencyModule.tsx:32`/`CombatModule.tsx:37`
  `if(!next) return {}` — the button looks dead. (Note: *WP* overspend does toast "Not enough WP";
  the money purse doesn't.) *Fix:* toast on refusal.
- **D3 — `DamageHealModule` can mint a maxless resource.** `:37-45,61-74` writes tracks without
  checking `prev.resources[id]` exists → `{current:0}` with no max, which `ResourceModule:55`
  renders as `0 /` and permanently can't take damage. *Fix:* skip absent ids or seed `{current:0,max:0}`.
- **D4 — Damage/heal selects hold stale ids across a character switch.** `DamageHealModule.tsx:26-29`
  (state from initializers only). *Fix:* `key={character.id}` on the module, or reset on `model` change.
- **D5 — `ShipsScreen` writes are un-awaited and inputs lag a DB round-trip.** `ShipsScreen.tsx:64-68`
  — floating promises (unhandled rejection), and `value` updates only after IndexedDB resolves →
  dropped characters/caret jumps while typing. *Fix:* optimistic `setShips` first, then awaited
  write in try/catch + toast; debounce free-text.
- **D6 — Condition toggle uses render-scoped `active`, not `prev`.** `ConditionModule.tsx:13,26`
  — fast double-tap nets to one toggle. *Fix:* `!prev.conditions[id]`.
- **D7 — Silent list truncation on Play.** `MagicModule.slice(0,8)`, `AbilityModule.slice(0,8)`,
  `CombatModule.slice(0,6)` — extras just vanish. *Fix:* "+N more" row linking to the full screen.

## E. Polish — TypeDoc gaps (codebase is otherwise well-documented; repos are exemplary)

Highest-value undocumented exports:
- **`SystemEngine` interface** (`engine/types.ts:421`) — the central architectural contract has
  zero prose. Also `SkillEngineConfig`, `PanelKey`, `ResolutionMethod`, `CurrencyMode`.
- **Migration rungs** `migrateCharacterV2ToV3` / `V3ToV4` (`migrations.ts:104,172`) — undocumented
  while V1→V2 has the model docblock; CLAUDE.md flags migrations as the highest-risk code.
- **`CharacterRecord`** (`character.ts:393`) and **`SystemDefinition`** (`system.ts:76`, esp. the
  `version` bump-on-edit footgun) — every field documented, the record/version itself not.
- **8 `validate*Data` note validators** (`noteValidators.ts:79-114`) — throw vs return unclear.
- **`EntityLink`** primitive (`entityLink.ts`) — no mention of directionality/immutability.
- **All 7 playDashboard modules**, **all 4 hooks** (`useAutosave`'s global flush registry, the
  `usePwaInstall` module-level singleton), **`src/theme` keys** (persisted `THEME_STORAGE_KEY`
  vs display-name split — the ids-vs-labels rule), **`GraphView`** (imperative d3 sim).
- Counts: `src/types` 46/107 undocumented, `features/kb` 9/25, `theme` 7/7, `playDashboard` 7/15,
  `hooks` 4/4, `combat` 4/4; repos 0/132 (clean).

## F. Polish — accessibility & touch targets

- **F1 — Collapsible panel headers aren't keyboard-reachable.** `SectionPanel.tsx:29-39`
  `<div role="button" aria-expanded>` with no `tabIndex`/`onKeyDown` — this one control collapses
  *every* Play/Sheet panel. Highest blast radius. `TimelineTrackRow.tsx:104-122` is the correct
  template. *Fix:* `tabIndex={0}` + Enter/Space handler, or render a real `<button>`.
- **F2 — Click-to-edit derived value not keyboard/label accessible.** `DerivedFieldDisplay.tsx:59-81`
  — bare `<span onClick>`, override input has no `aria-label`, no `title` hint. *Fix:* `<button>` +
  `aria-label`.
- **F3 — Missing `aria-pressed` on toggles.** `ConditionModule.tsx:18-35`,
  `QuickConditionPanel.tsx:36-58` (state is color-only); also linked-attribute abbr has no expansion.
- **F4 — Undersized touch targets (project min is 44px).** boon/bane cycle 32px
  (`SkillsScreen.tsx:349`), skill value input 40px (`:333`), spell Prepare/Cast ~30px
  (`MagicSpellCard.tsx:161-205`), portrait badge 28px. *Fix:* `min-h-11`.
- **F5 — Unlabeled controls.** Tiptap toolbar's six glyph buttons (`TiptapNoteEditor.tsx:585-599`,
  no `aria-label`/`title`/`aria-pressed`), TagPicker `+` and custom-tag input, skill-value inputs
  (30 announce as just "number"), derived-stat abbreviations (`Init`/`Carry` no `title`).
- **Good already:** `IconButton` (required `label`), `CounterControl`, `CurrencyAdjuster`,
  `RestModule` (best-in-repo), `DamageHealModule`, `BottomNav`, `GlobalFAB`. No `<div onClick>`
  anywhere — the keyboard gap is narrow (just F1/F2).

## G. Polish — vocabulary, states & feedback (overlaps the extraction plan)

- **G1 — `systemId ===` branch + hardcoded HP/WP/Abilities labels** across `SheetScreen.tsx:158`,
  the dashboard modules, and encounter/session/combat screens (`ParticipantDrawer`,
  `QuickNpcAction`, `SpellPicker`, `CombatTimeline`, etc.). `engine.terms`/`labels`/
  `participantHealth` already exist and are unused. *This is both a polish bug and extraction
  items E1/E7 — fixing the extraction fixes the vocabulary.*
- **G2 — Read failures render as "you have no data."** `NotesGrid.tsx:98` (`catch→setNotes([])`
  then "No notes yet"), `EncounterScreen`, `SessionTimelinePanel`, `ActiveCharacterContext.tsx:71`
  (a failed load looks like "no character" → redirect). Worst failure mode for a local-first app.
  *Fix:* distinguish error from empty; render an error+retry state.
- **G3 — Lifecycle/save failures are silent `console.error`.** `CampaignContext` (start/end/resume
  session), `EndOfSessionModal` (advancement writes), `SettingsScreen` (every setting). *Fix:* toast.
- **G4 — Destructive deletes with no confirm.** `ShipsScreen`, `NotesGrid`, `BestiaryScreen` delete
  immediately; `CharacterLibraryScreen`/`ReferenceScreen` have the confirm-modal pattern already.
  *Fix:* reuse it, or make the toast an Undo.
- **G5 — False empty-state flash on load** (no `isLoading` gate): Bestiary, Character Library
  (invites a duplicate character), Ships, Reference, Notes. *Fix:* add loading flags.
- **G6 — Play modules vanish when empty** instead of showing a discoverable empty state
  (Ability/Magic/Currency/Rest/Skill/StoryBank) — Sheet's Story Bank does the right thing. *Fix:*
  one-line empty state with CTA.
- **G7 — Ruleset content still hardcoded in session/combat components.**
  `SkillCheckDrawer.tsx:16-37` (20 Dragonbane skills + duplicated outcomes),
  `CombatTimeline.tsx:13-20` default conditions — a Traveller skill check offers Dragonbane skills.
  `SessionQuickActions` already reads skills from the definition; this drawer didn't get the update.
- **G8 — Label inconsistency for one concept:** resources panel has 4 names
  (Resources/Vitals/Hit Points & Willpower/Damage Track); Gear vs Inventory vs Ready Gear;
  Delete vs Remove (Ships uses both); "Talents … No heroic abilities yet."

---

## Recommended shortlist before Saturday

Small, safe, high-value — all confined to a few files:
1. **A2 + A3** — autosave flush-on-unmount + surface errors via toast everywhere (data-loss guard).
2. **A1** — party/session damage polarity for Traveller (or hide that path for damage-track systems).
3. **A4** — guard the Carry Limit blank→0.
4. Optional: **D2** (toast on currency overspend) — one line, removes the "dead button" feel.

Everything else is real but not table-critical; sequence it with the engine-extraction work in
`2026-07-24-traveller-to-engine-extraction.md`.
