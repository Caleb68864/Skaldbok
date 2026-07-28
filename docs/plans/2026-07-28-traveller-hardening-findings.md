# Traveller Sheet + Engine — Hardening Wave 4

**Date:** 2026-07-28
**Method:** five parallel read-only review passes, findings verified by the controller before inclusion
**Prior waves:** 2026-07-24 polish findings, 2026-07-26 18-agent sweep, 2026-07-26 10-agent engine audit
**Perspective:** the user plays Traveller as a **player** (not GM), rolling **physical dice**

Each pass was given the deferred backlog and the verified-clean list from prior
waves and told not to re-report them. Everything here is new.

Findings the controller verified independently are marked **[verified]**. One
pass claim was checked and found **wrong**; it is corrected in place rather than
dropped, because the underlying bug is real at a lower severity.

---

## Critical

### C1. Every temporary modifier in the app is inert **[verified]**

The write path and the read path use different key formats, and the matcher is
exact string equality.

| Stage | Code | Key form |
|---|---|---|
| Producer | `travellerEngine.ts:303,308` — `attrKey(a.id)` / `resKey(r.id)` | `attr:str` |
| Migration | `migrations.ts:87-93` — `namespaceLegacyStat` rewrites on read | `str` → `attr:str` |
| Consumer | `SheetScreen.tsx:606`, `:697` — `getEffectiveValue(attr.id, character)` | `str` |
| Matcher | `derivedValues.ts:248` — `.filter(e => e.stat === stat)` | exact equality |

`'attr:str' !== 'str'`, so no stored modifier ever matches. Those two
`SheetScreen` lines are the **only** production call sites of
`getEffectiveValue`.

Why it looks green: `statKeys.test.ts` calls `getEffectiveValue` correctly, with
`attrKey()`/`resKey()`. The resolver is tested; the call sites are not. TypeScript
cannot help because `StatKey` (`types/character.ts:264-268`) ends in `| string`.

**Blast radius.** For **Dragonbane** this is live and user-facing: the sheet
renders `BuffChipBar` and `AddModifierDrawer`, so users can create modifiers that
silently do nothing. Worse, a modifier saved *before* namespacing worked, and
stopped working the moment `upgradeCharacter` rewrote it — a silent regression on
already-saved data.

For **Traveller** the feature is dead twice over: see I5, there is no UI to
create a modifier at all.

**Fix:** pass `attrKey(attrId)` at both call sites, then tighten `StatKey` to
`` `${StatNamespace}:${string}` `` so the compiler enforces it for the next
caller. Land together with I1 — see the note there.

---

## Important — changes what happens at the table

### I1. The characteristic box and its DM badge disagree **[verified]**

`SheetScreen.tsx:696-698` computes the two numbers from different inputs:

```ts
const ev = getEffectiveValue(attrId, character);      // base + tempModifiers, never reads resources
const dm = engine.attributeBadge(attrId, character);  // effectiveCharacteristic → base − damage
```

`getEffectiveValue` (`derivedValues.ts:243-258`) never consults
`character.resources`; `effectiveCharacteristic` (`travellerEngine.ts:34-38`)
explicitly subtracts it.

**At the table:** STR 8 with 5 points of Strength damage shows **8** in the box
and **DM −1** in the badge, with no damage indicator between them. A player doing
their own 2d6 math off the big number computes +0 and rolls a full DM wrong on
every melee attack for as long as the damage stands. The visible contradiction
also invites distrusting the badge, which is the correct one.

**Sequencing note.** C1 and I1 must land together. Fixing C1 alone makes the
disagreement *worse*: the box would then show the modified value while the DM
badge still ignores modifiers, so a +1 Battle Dress buff would read STR 9 / DM +0.
`effectiveCharacteristic` should take the modified base — i.e.
`getEffectiveValue(attrKey(id), character).effective` minus damage — so one
function is the single source of "current characteristic".

### I2. The session log records damage as healing

`useSessionLog.ts:305-309` treats a positive delta as healing:

```ts
const label = diff > 0
  ? `${buf.character}: Healed ${diff} ${resLabel} (…)`
  : `${buf.character}: Took ${Math.abs(diff)} damage (…)`;
```

Traveller's damage track **accumulates** — `system.json:83` declares
`"direction": "accumulates"` and nothing reads it. Take 3 damage on the sheet,
and three seconds later the log reads `Kira: Healed 3 END (3/8)`.

The caller (`SheetScreen.tsx:341-343`) was deliberately generalised off the
`'hp'`/`'wp'` literals to `engine.resourceIds.includes(id)` so Traveller *would*
log — the generalisation landed, the sign convention did not.

### I3. The primary damage surface logs nothing at all

`DamageHealModule` writes resources directly (`:40-48`, `:84-93`) and never
imports `useSessionLog`. `ResourceModule` does log, but returns early for
damage-track systems (`:42`), which Traveller always is.

Combined with I2: the surface the Traveller dashboard routes **all** damage
through produces zero log entries, while the secondary surface produces inverted
ones. The session log holds no usable record of a fight.

### I4. Conditions double-penalise **[verified]**

All three Traveller conditions declare `linkedAttributeId: "end"`
(`system.json` — wounded, fatigued, unconscious). `conditionEffects.ts:22-24`
imposes a bane on every skill sharing a condition's linked attribute — explicitly
"Dragonbane's condition model" per its own docstring.

Damage already dropped the END DM. Ticking "Wounded" — which its own description
(`"Physical damage track is depleted"`) actively invites — banes it again.
Mongoose 2e has no such rule. END 7 minus 5 damage puts Survival at 17%; adding
the condition drops it to 5%.

**Fix:** drop `linkedAttributeId` from the three Traveller conditions (bump
`system.json` to v10), or gate `conditionImposesBane` behind an engine flag so
the Dragonbane rule is opt-in per ruleset.

Related: nothing ever *writes* these flags. `applyDamage` returns a status but no
`setsConditions`, so a character knocked out shows an UNCONSCIOUS banner while
`character.conditions.unconscious` stays false — nothing on the print sheet or in
an export records it.

### I5. Traveller has no UI to add a temporary modifier

`BuffChipBar` (`SheetScreen.tsx:630`) and `AddModifierDrawer` (`:1324`) are both
rendered inside `attributesPanel`. Traveller's engine lists `'characteristics'`,
not `'attributes'` (`travellerEngine.ts:189`), and `characteristicsPanel`
(`:692-723`) has no equivalent. No other mounting site exists.

Meanwhile `modifiableStats` enumerates `attr:*` and `res:*` targets and
`getEffectiveValue` is called on the Traveller panel. The plumbing exists end to
end with no entry point.

**At the table:** "the stim gives you +2 DEX for the scene" has nowhere to go, in
either mode. The player tracks it on paper — the thing the app exists to replace.

### I6. "Recover All" is a one-tap unconfirmed wipe next to a dead zone

`DamageHealModule.tsx:171-172` places `Recover All` immediately right of `Heal`,
both in the identical neutral `btn` class. `Heal` is `disabled` when the amount
field is empty, and the shared class carries `disabled:pointer-events-none` — so
in the common empty-field state Heal is a **dead zone** and Recover All is the
first live target to its right.

Mis-tap clears all damage, drops the UNCONSCIOUS banner, and autosaves within
500ms. There is no undo anywhere in the app for this.

### I7. One hit can never kill

`damageTrack.ts:43-48` builds a sequence of `[primary, exactly one overflow]`,
but Traveller's model declares `order: ['end']`, `overflowTo: ['str','dex']`,
`deadAtDepleted: 3`.

STR/DEX/END all 7, one hit of 20: 7 to END, 7 to STR, **6 damage silently
stranded**, DEX untouched, `depleted.length === 2` → status `'down'`. `'dead'` is
reachable only across three separate damage applications.

**Fix:** continue the sequence through the remaining `overflowTo` entries after
the chosen one.

### I8. Success odds are unlabelled while eight targets are on screen

The hardcoded target `8` is **internally consistent** — `skill.display` and
`probability.chance` both use it and cannot drift (pass 1 tried to construct a
disagreement and could not). The problem is presentation: `system.json`'s
`quickReference[1]` renders all eight difficulty targets (Simple 2+ through
Impossible 16+) in the same app, while the skill row reads "Level 2 · DM +1 ·
83%" with no qualifier. At a Difficult (10+) task the true figure is 41.7%.

`travellerMath.ts:23,43` already take `target` as a parameter — only the callers
hardcode it.

**Fix (cheap):** extract `TRAVELLER_DEFAULT_TARGET = 8` and append the assumed
target to the display string ("… · 83% vs 8+").

### I9. The skill-check edit drawer offers the wrong ruleset's outcomes

`SkillCheckEditDrawer.tsx` never touches the engine (verified: zero
`useSystemEngine`/`getEngine` references). `RESULTS` is
`['success','failure','dragon','demon']` and the modifier chips are
Boon/Bane/**Pushed**. Traveller's outcomes are
`exceptional-success / success / failure / exceptional-failure` with no Pushed
mechanic.

> **Correction to the pass-4 report.** It claimed that opening a Traveller entry
> and pressing Save silently downgrades the outcome to `'success'`. **That is
> wrong.** The effect at `:50-57` restores `data.result` on open, and
> `readOutcomeTypeData` (`formatSkillCheckTitle.ts:114`) uses
> `(data.result as OutcomeResult) ?? 'success'` — a *cast*, not validation, and
> `??` only fires on null/undefined. A stored `exceptional-success` survives
> open→save untouched. Severity reduced from Critical to Important.

The real defect: the grid shows **no selection** for a Traveller outcome (none of
the four buttons match), offers a modifier Traveller lacks, and corrupts the
stored value only if the user actually taps a result button. Editing a Traveller
check correctly is impossible.

### I10. Session-layer surfaces resolve the engine from the active character

`SessionQuickActions.tsx:189` and `CombatTimeline.tsx:60` call
`useSystemEngine()` (active character) where peers correctly use
`useSystemEngineFor(activeCampaign?.system)` — `SessionScreen.tsx:303`,
`CombatEncounterView.tsx:447`, `ParticipantDrawer.tsx:29`.

`engine/index.ts:88-95` documents the contract explicitly: session-layer screens
are scoped to a campaign, not to whichever character happens to be active.
`SessionQuickActions` is mounted globally from `GlobalFAB.tsx:98`.

With no active character, `useSystemEngine` falls back to `'classic-fantasy'`
(`engine/index.ts:83`), so a Traveller session's quick-actions render Dragonbane
vocabulary, a Dragon/Demon outcome grid, a Pushed chip, and Rest/Death chips
Traveller shouldn't have — and log Dragonbane outcome ids into that session's
notes.

### I11. Resource max steppers are inert in edit mode

`useSyncedResourceMaxima` (`resourceMaxima.ts:35-43`) forces `max` back to the
`derivedFrom` characteristic on every `character` change, while
`SheetScreen.tsx:683` still renders max ± steppers in edit mode and
`updateResourceMax` happily writes. The value snaps back and an autosave is
burned each time.

Affects Traveller (all three tracks) and Dragonbane (hp/wp). The *stored* value
is correct — the bug is an offered-but-inert control.

**Fix:** pass `maxEditable={false}` for any resource declaring `derivedFrom`; it
is computed, not editable.

---

## Important — community-template goal, not this week

### T1. One typo discards the entire sheet template, silently

`useSheetTemplate.ts:46-49` runs a single `safeParse` over the whole document and
returns `{ template: null, error }`. Both consumers — `SheetScreen.tsx:116` and
`PlayDashboardScreen.tsx:43` — destructure the `error` away.

A lowercased letter in `"hasDamageTrack"` makes `template` null;
`PlayDashboardScreen` then renders its hardcoded fallback dashboard, which
*looks* like a working sheet. Nothing logs, nothing displays, and `npm run build`
passes because sheet.json is not type-checked.

Three typo classes, three different failure modes, none of them an error message:
misspell the **card key** → blank card, DEV-only warn; misspell **`props`** →
silently stripped, titleless card; misspell **`when`** or **`cells`** → entire
template discarded.

### T2. The community-component subsystem is unreachable dead code

`resolveComponent.ts` — 155 lines of `$prop` slots, cycle detection, depth and
breadth budgets, four error classes, plus a 5.5KB test file — can never execute.
`sheetTemplateSchema` (`schema.ts:85-93`) does not reference
`componentDefinitionSchema`, so a `components` block is silently stripped at
parse; and `componentRegistry` (`CardRenderer.tsx:53`) defaults to `{}` with no
call site ever passing it.

An author following the worked example in `componentDefinitionSchema`'s own JSDoc
gets nothing, with no warning in production.

### T3. Dangling stat references render "—" with no warning at any log level

`TileCard.tsx:40-56` returns `undefined` for any unrecognised path;
`:88-89` renders `'—'`. Unknown **card keys** warn in DEV; unknown **data paths**
warn nowhere, in no environment.

Worse, `statKeys.ts:18` declares `'armor'` and `'skill'` as first-class
namespaces and `parseStatKey` returns them, but `resolveDataPath` handles only
`attr`/`res`/`derived` — so `"source": "skill:gun-combat"` parses cleanly and
resolves to nothing. `ToggleGridCard.tsx:47-51` coerces the miss to `false`,
rendering a permanently-off indicator that looks like real data.

### T4. A template version downgrade sticks permanently

`useSheetTemplate.ts:61` refreshes only when
`cachedTemplate.version < bundledTemplate.version`, and
`metadataRepository` exposes only `get`/`set` — no delete, no clear, and no reset
surface anywhere in settings.

A revert of `traveller/sheet.json` from v6 to v5 leaves every browser that cached
v6 rendering v6 forever, across service-worker updates. The equal-version tie is
deliberate and tested; the downgrade is not. Becomes user-facing the moment
community template import ships.

---

## The structural finding

### S1. Nothing asserts that a key a producer emits is a key a consumer can resolve

C1 is not a one-off. There are four independent producer/consumer key spaces and
zero assertions across any of them:

| Producer | Consumer | State |
|---|---|---|
| `modifiableStats()` → `attrKey`/`resKey` | `getEffectiveValue` | **broken** (C1) |
| `derivedFields[].key` | whatever `derivedStats()` returns | unasserted |
| `timeUnits[].id` | `TempModifier['duration']` — closed 5-literal union | **broken** (see below) |
| `outcomes[].id` | `OutcomeResult` — closed 4-literal union | **broken** (I9) |

In three of four cases the consumer's key space is a **hardcoded closed union**
while the producer's is engine data, with a cast (`unit.id as Duration`,
`data.result as OutcomeResult`) suppressing the one place the compiler could
object.

The `timeUnits` instance: `AddModifierDrawer.tsx:63,74` initialises and resets
`duration` to the hardcoded Dragonbane id `'stretch'`, which is not in Savage
Worlds' `timeUnits`. A SWADE buff saved without touching the Duration row stores
`duration: 'stretch'`; `BuffChipBar.tsx:52` can't resolve it and falls back to
the raw id, so the chip reads "+2 stretch" — and SWADE has `rest: null`, so
nothing can ever expire it.

**Fix:** replace the closed unions with `string` so tsc stops being falsely
reassuring, then add round-trip assertions to `engineContract.test.ts`.

### S2. `engineContract.test.ts` blind spots

The suite asserts referential integrity of string ids *within* a single engine
object. It never imports a component, never invokes a function-valued field
(`derivedStats`, `modifiableStats`, `currency.read/write`, `skill.display`,
`resolveDamage`, `attributeBadge` — not once), and never exercises the JSON-only
path.

Consequently **every finding in this document passes it cleanly.**

Highest-value additions, in order:

1. **Wrong-adapter detection** — nothing asserts `getEngine(s)` returns the
   adapter intended for `s.id`. A registry entry with no `baseEngineFor` branch
   falls back to `classicFantasyEngine` with only a **DEV-only** warn
   (`index.ts:22`), so a production build gives the user no signal at all. Today
   the drift is caught incidentally, and only when the new system's resource ids
   differ from hp/wp. One line closes it.
2. **Consumer-side leaks** — the largest gap. The suite validates engine
   self-consistency, not whether screens read the engine, which is the actual
   cardinal rule.
3. **Producer/consumer key agreement** — S1.
4. **Function-valued field behaviour** — a `currency.read`/`write` round-trip
   property test is one line and covers a whole class of money bugs.

Also unasserted: `panels.includes('rest') === (rest !== null)` (I12 below);
`hasMagic === (magic !== null)`; `downAtDepleted`/`deadAtDepleted` vs
`order.length`; `outcomes`/`rollModifiers` id uniqueness.

### I12. Capability tested via `panels` instead of the nullable model

`SessionQuickActions.tsx:225-226` uses `engine.panels.includes('rest')` /
`.includes('death')` where the correct form — used by `guards.ts:11` and
`SheetScreen.tsx:256` in the same codebase — is `engine.rest !== null`. The two
lists agree only by hand. Drift either way produces a rest panel with no quick
action, or a quick action falling through to hardcoded Dragonbane rest types.

---

## Verified clean (do not re-investigate)

- **`systemId ===` leaks: zero.** All eight grep hits are the sanctioned
  `baseEngineFor` branches, runtime-value comparisons, or a `typeof` guard. The
  leaks in this codebase are the *other* shape — hardcoded Dragonbane **data** in
  screens that hold an engine and don't read it (I9, I10, I12, T-series).
- **Storage keys derived from labels: none.** Every near-miss gets it right and
  documents why (`SettingsScreen.tsx:82-92`, `RestModule.tsx:13-23`).
- **Legacy stat-key precedence.** `resolveLegacy` checks `attributes` first and
  `namespaceLegacyStat` classifies unknown keys as `attrKey` — the same choice, so
  a modifier saved as `'str'` points at the characteristic before and after
  migration. No namespace flip exists; pass 2 looked for one specifically.
- **No stat-key string concatenation anywhere.** Every producer uses
  `attrKey`/`resKey`/`derivedKey`/`armorKey`.
- **Traveller core math.** `characteristicToDM` matches Mongoose 2e at every
  boundary; the 36- and 216-outcome enumerations are correct and were verified
  numerically (41.7% / 68.1% boon / 19.4% bane at DM 0 vs 8+). Boon = best two,
  bane = worst two, both right.
- **Unskilled / trained-at-0.** `context?.trained === false && value === 0` is
  exactly right, and both live surfaces pass `trained`.
- **`rest`/`death`/`advancement === null`** are genuine absences, not leftovers;
  every consumer guards correctly, including an explicit "this system has no
  end-of-session advancement procedure" message.
- **Damage arithmetic.** `applyDamage` clamps correctly; `current` never exceeds
  `max` or goes negative; no off-by-one. `res:end` and `attr:end` correctly do
  *not* mirror — `effectiveCharacteristic` composes them. Sound design.
- **Play-mode leaks on the Traveller sheet: none**, and no live counter is
  wrongly locked. Resource maxima are locked in play mode for every system
  because `SheetScreen.tsx:125` derives one screen-level boolean from
  `'resources.hp.max'` and broadcasts it — structurally stable, not luck. The
  prior audit's "correct by accident" conclusion **still holds**, verified by
  walking the path.
- **Touch targets** on Traveller sheet/dashboard surfaces meet the 44px minimum
  (`ResourceTracker`, `AttributeField`, `ConditionModule`, `DamageHealModule`,
  `SkillModule`). Exception: `RepeatableRows` at 40px — see minors.
- **Traveller ↔ Dragonbane template parity** is clean: every card key used by
  either exists in `CARD_REGISTRY`, both use the same region forms, both render
  through identical paths. (This proves only the smart-card path; the declarative
  path where T3 lives has zero bundled coverage.)
- **Card guards** are compile-time exhaustive and fail closed on an unknown
  discriminant.

---

## Minor

- `RepeatableRows.tsx:39,78` — 40px inputs and an unconfirmed Remove button,
  rendered eight times on the Traveller sheet (career terms, connections). A
  mis-tap deletes a whole career term with no undo.
- `characterNormalization.ts:52-54` clamps attributes to a floor of **1**, so a
  Traveller characteristic of 0 — a real state with its own DM rung — cannot be
  persisted. The damage-track path reaches 0 correctly; only the base score is
  blocked.
- `travellerEngine.ts:112,283` — the `-3` unskilled DM is restated at both call
  sites rather than shared, in the very helper built to stop the two surfaces
  diverging.
- `effectiveCharacteristic` coalesces a **missing** characteristic to 0 → DM −3,
  while `attributeBadge` correctly returns null. Add a 7th characteristic and
  every linked skill asserts "DM −3" from absent data.
- `ResourceModule.tsx:36` logs resource changes only when the id is literally
  `'hp'` or `'wp'`.
- `PrintableSheet.tsx:711-740` maps terms and dot colours by hardcoded `'hp'`/
  `'wp'` instead of `primaryHealthResourceId` / `magic.resourceId`.
- `CombatTimeline.tsx:353,364` — drawer titles hardcoded "Heroic Abilities" and
  "Spells" in a file that already holds the engine.
- `SessionQuickActions.tsx:41-45` — `REST_TYPES` is a frozen Dragonbane ladder
  with Dragonbane effect text; latent until a 4th system.
- `SessionQuickActions.tsx:423` — logged roll titles print `outcome.id`, not
  `label`: "— exceptional-success" instead of "— Exceptional Success".
- `traveller/sheet.json:23` — `{"card":"abilities","when":"hasMagic"}` can never
  render, since `travellerEngine.hasMagic` is false. Needs a `hasAbilities` guard.
- `types/system.ts:197-204` declares 4 overridable labels where the Zod schema
  correctly mirrors 18 — a type/schema drift that already caused silent
  key-stripping once.
- Screen-reader: DM badge `aria-label` on a non-interactive `<span>` (ignored);
  `RepeatableRows` inputs labelled by column only, so six career rows announce
  "Notes" six times; damage input lacks `inputMode="numeric"`.

---

## Gaps, not bugs

- **Effect is never computed.** `total − target` exists only as prose in
  `quickReference[2]`. No roll total is captured anywhere, so Effect cannot be
  derived. The engine offers four outcomes where the reference table names six —
  Marginal and Average Success/Failure are absent from the picker.
- **Jack-of-all-Trades has no mechanical effect.** Declared in `system.json` with
  no `linkedAttributeId`; the flat `-3` unskilled DM ignores it. Probably
  deliberate given the no-bundled-rules-tables stance, but worth confirming.
- **`travellerMath.ts` has no direct test file.** The DM boundaries and the
  216-outcome enumeration are covered only indirectly, via assertions on relative
  ordering rather than exact values. ~20 lines would pin them.
- **`depleted` skips any track whose max is 0** (`damageTrack.ts:62-65`), so a
  character with base STR 0 counts one depleted track instead of two.
- **The declarative primitives** (`tile`, `table`, `toggleGrid`) are referenced by
  **none** of the three bundled templates — the path that matters most for
  community authoring has zero coverage.

---

## Suggested order

1. **C1 + I1 together** — fixing either alone makes the other worse.
2. **I2 + I3** — the session log is currently worse than useless for a fight.
3. **I4** — one-line data change, removes a double penalty.
4. **I6** — cheapest real safety win.
5. **I5, I7, I11** — then the rest.

S2's first blind spot (wrong-adapter detection) is one line and worth taking
alongside any of the above.
