---
title: Traveller → System Engine extraction plan
date: 2026-07-24
status: draft
author: multi-agent code scan (3 extraction passes + cross-referenced hardening passes)
scope: analysis / planning only — no code changed
---

# Traveller → System Engine extraction plan

## Why this note exists

A lot of Traveller-specific behaviour landed fast (damage-track vitals, unified
Take Damage & Heal, currency-under-Vitals, encumbrance override, Story Bank,
ships, quick reference). Much of it is baked into **screens and components**
rather than the `SystemEngine`. The project rule is: *if a value or behaviour
differs between rulesets, it comes from the engine — a screen that branches on
`systemId` is a bug.* This note catalogues where that rule is currently bent, so
that adding a **third system** becomes a data exercise, not a screen rewrite.

Each candidate is atomic: what's ruleset-specific, where it lives, why it belongs
in the engine, and a concrete proposed engine surface. Ranked by payoff for a 3rd
system. **Nothing here is a Saturday blocker** — Traveller works today; this is
future-proofing. Two items (E2, E5) are also *live correctness bugs* and are
cross-listed in the hardening report.

---

## Tier 0 — blocks adding a 3rd system at all

### E1. Dashboard layout & sheet panels are hardcoded forks, not engine-declared

- **Where:** `src/screens/PlayDashboardScreen.tsx:65-100` (`hasRest` picks one of two
  entire layouts; `CurrencyModule` + `DamageHealModule` are reachable *only* in the
  no-rest branch). `src/screens/SheetScreen.tsx:158` — **`const isTraveller = character.systemId === 'traveller'`**, the explicit rule violation, driving `DEFAULT_PANEL_ORDER`, `panelMap`, `panelVisibility`.
- **Why engine:** module/panel composition *is* the definition of a ruleset's screen.
  `engine.panels: PanelKey[]` already exists and already lists Traveller's panels —
  `SheetScreen` just doesn't read it. (Side effect of the hardcoded list: it omits
  `derived`, so Traveller's Init/Carry derived panel never renders on the sheet.)
- **Proposed surface:**
  ```ts
  type PlayModuleKey = 'vitals'|'derived'|'rest'|'conditions'|'damageHeal'
                     |'currency'|'skills'|'combat'|'abilities'|'magic'
                     |'storyBank'|'quickReference';
  interface SystemEngine {
    panels: PanelKey[];                 // already exists — actually consume it in SheetScreen
    playDashboard: { columns: 'auto'|'1fr 2fr'|'1fr 1fr 1fr'; regions: PlayModuleKey[][] };
  }
  ```
  Screen becomes `MODULES[key]` registry + a loop; each module keeps its own
  `return null` guard so an over-declared region degrades gracefully. Add
  `'storyBank'` to `PanelKey` while here (removes its hardcoding in both panel-order arrays).
- **Falls out of this:** E4 (`showCoins`), and the whole "no-rest branch is the only
  place damage/heal renders" trap (a rest-having system with a damage track currently
  cannot show Take Damage & Heal at all).
- **Refined by the spike** (`2026-07-24-json-card-templates-spike.md`): the region
  list is not just an engine field — it is a **JSON `SheetTemplate`** consumed by a
  **card registry + `CardRenderer`**. Split: *template = layout, engine = rules,
  component = render*. The spike shows both Traveller and Dragonbane Play layouts
  reduce to `regions` arrays over the existing 12 modules + 3 generic primitives,
  with **no `custom` code escape hatch needed for parity** — the feasibility signal
  for the JSON-template system. E1 is the prerequisite; the template/registry is its
  endpoint.

---

## Tier 1 — high payoff, some are live bugs

### E2. Resource **polarity** is implicit — biggest single blocker, and a live bug ⚠️

- **What:** Nothing declares whether a resource *depletes* (Dragonbane HP: start at
  max, count down, 0 = bad) or *accumulates* (Traveller tracks: start at 0, count up,
  `current >= max` = bad). Every consumer hardcodes one direction.
- **Where:** `src/utils/damageTrack.ts:52-67` (count-up only), `ResourceModule.tsx:44`
  (`wounded = current > 0`), and critically **`src/features/session/SessionQuickActions.tsx:644-655`**
  `adjustHealth(-amount)` does count-**down** clamped `[0,max]`. Because
  `travellerEngine.primaryHealthResourceId = 'end'`, **the party Quick Action "damage"
  currently HEALS a Traveller's END track and "heal" damages it.** Same path backs
  `ParticipantDrawer.tsx:69,102` (GM-side edits of a linked PC).
- **Why engine:** polarity is a ruleset fact and the axis every damage/heal/status path
  silently branches on.
- **Proposed surface:** `ResourceDefinition.direction: 'depletes'|'accumulates'`, plus
  move mutation behind the engine:
  ```ts
  interface SystemEngine {
    damage(character, amount, opts?: { primary?: string; overflow?: string }): ResourceApplication;
    heal(character, amount, targetId?: string): ResourceApplication;
    fullRecovery(character): Record<string, number>;
  }
  ```
  `applyDamage` in `utils/` stays as the default *accumulating* implementation the
  Traveller adapter delegates to (mirroring how classic-fantasy delegates to `restActions`).
- **Cross-ref:** hardening report H-A (party damage inverted) and H-B (heal/recover in
  `DamageHealModule` hardcodes count-up). This item fixes both by construction.

### E3. Make `damageTrack` non-nullable — a pool is a one-track model

- **Where:** `CombatModule.tsx:18` (`!engine.damageTrack` as a "is Dragonbane" proxy),
  `ResourceModule.tsx:36` (whole component forks), `DamageHealModule.tsx:32`
  (`if (!model) return null`). Two parallel damage UIs, neither reusable.
- **Why engine:** an HP pool *is* a damage track with `overflowTo: []`,
  `downAtDepleted: 1`, `direction: 'depletes'`. Non-nullable + polarity (E2) collapses
  both branches into one renderer.
- **Proposed:** classic-fantasy declares
  `{ order:['hp'], overflowTo:[], direction:'depletes', downAtDepleted:1, deadAtDepleted:null }`.

### E4. Currency mutation is implemented twice, divergently — live data inconsistency ⚠️

- **Where:** `src/utils/currency.ts:18` `remakeCurrency` (greedy re-compaction; used by
  `CurrencyModule`/`CombatModule`) **vs** `src/screens/GearScreen.tsx:275-305`
  `adjustCurrency` (borrow-from-donor, leaves purse uncompacted). Same character, same
  ±button, different resulting purse depending on which screen you pressed it from.
- **Why engine:** "does this economy re-compact change?" is a money-system property, not
  a UI concern.
- **Proposed surface:**
  ```ts
  interface CurrencyModel {
    applyDelta(current: Record<string, number>, denomId: string, delta: number): Record<string, number> | null;
    compacts: boolean;
  }
  ```
  Default impl = today's `remakeCurrency`; delete `GearScreen.adjustCurrency`. `currency.ts`
  becomes the shared default the engines call, not a thing screens import.

### E5. `getDerivedValue` / `computeDerivedValues` is a live Dragonbane trap ⚠️

- **Where:** `src/utils/derivedValues.ts:150-160` — `getDerivedValue` routes every
  `derived:*` key through `computeDerivedValues`, which is **hardcoded classic-fantasy**
  (`hpMax = attributes['con'] ?? 10`). On a Traveller character `derived:hpMax` resolves
  to a fabricated `10`; keys outside the six-field shape return `undefined` → coerced `0`.
  Meanwhile `GearScreen.tsx:385-403` special-cases the `'encumbranceLimit'` key by hand
  because `derivedStats()` deliberately doesn't fold overrides in — so four sites now
  reimplement `override ?? computed`.
- **Why engine:** the override-fold and derived resolution both belong on the engine.
- **Proposed surface:**
  ```ts
  interface SystemEngine {
    effectiveDerived(character, key, system?): { computed: number|string; override: number|null; effective: number|string };
  }
  ```
  Delete the four inline copies; **fix or remove `utils/derivedValues.getDerivedValue`** —
  it is a trap any new screen will fall into.
- **Cross-ref:** hardening report (harden-storage #9) flags the same resolver as
  silently applying Dragonbane formulas to Traveller.

### E6. `SkillModule` reimplements relevance, hardcodes Dragonbane marks, drops boon/bane

- **Where:** `src/features/playDashboard/SkillModule.tsx:33,39-46,48-56,67-70`.
  - Reimplements `isPrimary` instead of calling `engine.skill.isRelevant` (which
    `SkillsScreen.tsx:258` already uses).
  - `cycleMark` hardcodes none→dragon→demon→none; `dragonMarked`/`demonMarked` are
    Dragonbane vocabulary guarded only by `supportsMarks: boolean`.
  - `engine.resolution === 'd20-roll-under'` branch is the same smell as a `systemId` check.
  - Never passes `boonBane` into `displayContext`, so the dashboard shows *unmodified*
    Traveller odds while `SkillsScreen` shows boon/bane-adjusted odds for the same skill.
- **Proposed:** call `isRelevant`; replace `supportsMarks: boolean` with
  `marks: Array<{ id; label; badge? }>` (ids persist, `[]` = no marks); add
  `skill.displayStyle: 'value-plus-odds'|'formatted'`; thread `boonBane` through.

### E7. Panel titles hardcoded while `engine.labels` already exists

- **Where:** `ResourceModule.tsx:38,67`, `DerivedStatsModule.tsx:59`,
  `ConditionModule.tsx:10`, `CombatModule.tsx:48`, `QuickReferenceModule.tsx:20`,
  `StoryBankModule.tsx:17`, `DamageHealModule.tsx:83` — literals `"Vitals"`,
  `"Derived Stats"`, `"Conditions"`, `"Ready Gear"`, etc. Traveller's engine already
  declares `labels.resourcesPanel = "Damage Track"` and it is **not consumed** — the panel
  is titled "Vitals" anyway. A live inconsistency, not just future risk.
- **Proposed:** add `vitalsPanel`/`derivedPanel`/`conditionsPanel`/`readyGearPanel`/
  `damageHealPanel`/`quickReferencePanel`/`storyBankPanel` to `SystemLabels`; modules read
  `engine.labels.*`. Cheap, high payoff, zero Dragonbane behaviour change.

### E8. `quickButtons` is a hardcoded per-screen decision

- **Where:** `CurrencyAdjuster.tsx:25,41` prop; `CurrencyModule.tsx:41` passes `false`,
  `CombatModule.tsx:87`/GearScreen pass `true`. `quickSteps` *is* engine-owned, but
  *whether they render* is a component literal.
- **Proposed:** either a per-surface declaration
  (`quickStepSurfaces?: Array<'dashboard'|'gear'|'combat'>`) or, simpler, let
  `CurrencyAdjuster` cap rendered steps by available width and drop the boolean entirely.

---

## Tier 2 — generalisation the 3rd system will want

### E9. Down/dead expressed only as counts of depleted tracks

- **Where:** `DamageTrackModel.downAtDepleted/deadAtDepleted` + `damageTrack.ts:69-75`.
  Traveller-shaped ("2 empty = down, 3 = dead"). A 3rd system's thresholds are usually
  not a count — "dying at 0, dead at −CON", bloodied-at-half, graded wound levels.
- **Proposed:** ordered, most-severe-first predicate list; UI renders the first match:
  ```ts
  statusRules: Array<{ id; label; tone: 'warning'|'danger';
                       when: (ctx) => boolean; setsConditions?: string[] }>;
  ```
  `DamageApplication.status` becomes the matched rule id.

### E10. Damage status and the conditions list are two representations of one fact

- **Where:** `travellerEngine.ts:236` hardcodes `downLabel: 'UNCONSCIOUS'` while
  `system.json` ships `wounded`/`unconscious` conditions that **nothing ever sets**.
  `damageTrack.ts` never touches `character.conditions`. A player can be mechanically
  down with the Unconscious chip off.
- **Proposed:** `statusRules[].setsConditions` (E9) + have `DamageApplication` return a
  `conditions` patch alongside `resources`, so one write covers both. Removes the
  hardcoded banner strings.

### E11. Magic resource + cost formula hardcoded to WP

- **Where:** `AbilityModule.tsx:15,25`, `MagicModule.tsx:22,32,44,50`,
  `ResourceModule.tsx:30`. `character.resources.wp` by literal key, `cost = powerLevel*2`,
  `[1,2,3]` ladder, `"Not enough WP"`. `terms.magicResource` ("PSI") exists but the storage
  key and cost formula don't. Dormant only because Traveller sets `hasMagic:false`.
- **Proposed:** `magic: { resourceId: string; costFor(ability,level): number; powerLevels: number[] } | null`.
  Also `ResourceModule.tsx:30` logs only when `id==='hp'||id==='wp'` — a Traveller END
  change never reaches the session log; make it `engine.resourceIds.includes(id)`.

### E12. Attribute-modifier grid via duck-typing

- **Where:** `DerivedStatsModule.tsx:21-38` — `'characteristicDMs' in derived` + `formatModifier`.
  Right instinct (structural, not `systemId`) but a 3rd modifier system must adopt that exact
  key + `+n` formatting.
- **Proposed:** `attributeReadout: { mode: 'none'|'modifiers'; format: (n)=>string; valuesFor: (character)=>Record<string,number> }`.

### E13. Damage allocation UX assumes exactly one primary + one overflow

- **Where:** `DamageHealModule.tsx:22-30,96-115` (two selects) + `damageTrack.ts:44-47`
  (single `overflowTarget`). A system with automatic cascade (no choice) or a split across
  targets (hit locations, wound boxes) can't render.
- **Proposed:** `damageTrack.allocation: 'auto'|'choose-one'|'split'` +
  `damageTrack.targets(character): {id,label,room}[]`; module renders from the descriptor.
  Keep the existing silent-ignore-of-illegal-target guard — that part is good.

### E14. `DerivedValues` is a fixed Dragonbane-shaped struct

- **Where:** `src/utils/derivedValues.ts:13-21` — `hpMax`/`wpMax`/`damageBonus`/`aglDamageBonus`
  are required fields the engine's `derivedStats()` must return; `DERIVED_KEYS` likewise a
  literal set. Traveller pays a tax of irrelevant keys.
- **Proposed:** `derivedStats(): Record<string, number|string>` keyed by the already-declared
  `derivedFields[].key`. Medium-large refactor; last hardcoded Dragonbane vocabulary in the
  vitals path.

### E15. `DeathModel` and `DamageTrackModel` are two models of one concept

- **Where:** `types.ts` `DeathModel` (`triggerResourceId` + `triggerAtOrBelow` — count-down
  baked into the name) vs `DamageTrackModel.downAtDepleted`; each engine sets one, nulls the
  other. A 3rd system wanting *both* a cascading track and a death-save track can't express it.
  `DeathTrack` (`{id,label,max,tone}`) itself is nicely generic — it's the trigger that's
  system-shaped.
- **Proposed:** keep `death.tracks`; let the trigger be `statusRules` (E9).

### E16. Miscellaneous string-literal leaks

- `RestModule.tsx:167` — `title="… Does not undo HP/WP changes."` (Dragonbane resources in an
  otherwise engine-driven module) → derive from `terms.healthResource`/`magicResource`.
- `GearScreen.tsx:396-399` — currency title ignores `engine.currency.label`, hardcodes
  `'Coins'` for multi-denomination → one-line fix to use `currency.label`.
- `SkillsScreen.tsx:134-145` `buildConditionBaneMap` — Dragonbane's "condition imposes bane on
  linked-attribute skills" stated at screen level; harmless for Traveller (comes out empty) but
  belongs on `engine.conditionEffect?: (character, skill) => 'boon'|'none'|'bane'`.
- Traveller "unskilled −3 DM" lives only as quick-reference prose (`system.json:412`); the
  display path shows level-0 *trained* odds for an unskilled character. Fold into
  `skill.untrainedPenalty?: number` or `computeValue`, threading `trained` into `SkillDisplayContext`.

---

## Explicitly leave alone (verified already-clean)

- **Conditions are pure data** — no condition name appears in code; "Wounded/Fatigued/
  Unconscious" exist only in `system.json`. The only gap is E10 (nothing derives them from damage).
- **Story Bank** — correctly *not* engine-gated; both surfaces self-hide on empty. A per-system
  `hasStoryBank` flag would wrongly hide player-authored content. Future body/modal plan
  ([[story-bank-tap-to-expand]]): keep truncation threshold in config, keep the modal read-only
  on Play. Only coupling is the hardcoded panel-order arrays — resolved for free by E1.
- **`applyDamage` as a pure tested function**, **namespaced stat keys** (`attr:str`/`res:str`),
  **`syncDerivedResourceMaxima`** (reads `derivedFrom` generically), **`RestModule`** (keys by
  `RestDefinition.id`), **`QuickReferenceModule`** (fully `system.quickReference`-driven),
  **`CurrencyModel.read/write`**, **`DerivedFieldDef.surfaces`**, **auto-bane from
  `linkedAttributeId`**, **`supportsBoonBane`/`trainedAffectsValue`/`advancementMax`** — all clean.

---

## Suggested sequencing (when we pick this up post-Saturday)

1. **E1** (panels/layout from engine) — unblocks everything, and E3/E4-placement fall out.
2. **E2 + E5** — the two live bugs; do them as the first correctness pass.
3. **E7 + E8 + E16** — cheap label/config one-liners, high polish-per-minute.
4. **E3 → E6 → E11 → E13** — the damage/skill/magic model deepening.
5. **E9/E10/E12/E14/E15** — the larger model generalisations, best done with the 3rd
   system's actual requirements in hand rather than speculatively.

Related memory: [[traveller-playable-by-2026-07-25]], [[story-bank-tap-to-expand]].

---

## Appendix A — Templating / data-driven rendering research (2026-07-24)

**Question posed:** could a templating system (Handlebars or similar) or "more
modular/mobile cards" make each future ruleset even cheaper to add, once the
E1–E16 extractions are done?

**Short answer:** Yes to *more declarative, self-describing cards*; **no to
string templating (Handlebars/Mustache/EJS).** The win the user is reaching for
is real, but the mechanism is a **component registry + declarative descriptors
in `system.json`**, not a text-templating engine. Reasoning below, atomic per
option.

### A.1 — Reframe: the goal is "compose cards from data," not "render strings"

The pain isn't that our cards are hard to *render* — React already does that
well. The pain (E1) is that *which* cards appear, in what order, with what
labels, is decided by TypeScript branches in two screens. "Templating" in the
user's sense means: **an author writes data, and the play/sheet screen appears,
with zero code.** That is a *composition* problem, not a *string-substitution*
problem. Keep that distinction — it decides every option below.

### A.2 — Option 1: component registry + declarative layout (RECOMMENDED, near-term)

This is E1 taken to its conclusion. A `Record<PlayModuleKey, React.FC<PlayModuleProps>>`
registry, and the engine declares `playDashboard.regions: PlayModuleKey[][]`
(and `panels: PanelKey[]` for the sheet, which already exists). The screen loops
the declared layout and looks each key up in the registry.
- **Buys for system #3:** ordering, presence, and column layout of every card
  become pure data. No screen edit to add/remove/reorder cards.
- **Costs:** near-zero — it's mostly deleting the `hasRest`/`isTraveller` forks.
  Full TypeScript type-safety retained (keys are a union). No new dependency, no
  CSP/PWA impact, works offline.
- **Ceiling:** the *set* of card types is still fixed in code. A genuinely novel
  card (a Traveller "career track" widget) still needs a new component. That's
  fine — see A.4.

### A.3 — Option 2: string templating (Handlebars/Mustache/EJS) — NOT RECOMMENDED

Handlebars renders a template **string** to an HTML **string**. To show that in
React you must `dangerouslySetInnerHTML`, which forfeits everything that makes
this app work:
- **Loses React reconciliation & controlled inputs.** Our cards are interactive
  (steppers, selects, toggles writing through `updateCharacter`). A Handlebars
  string can't hold a controlled `<input>` or an `onClick` — you'd hand-wire DOM
  events back out, reinventing React badly.
- **Security.** `system.json` is user-authored and importable from a bundle
  (see hardening C1). Injecting author-supplied template strings as HTML is a
  first-class XSS vector against a local-first app holding all the user's data.
- **CSP/PWA friction.** The PWA ships a strict setup; `eval`-style template
  compilation and inline injection fight the service-worker/CSP model.
- **Accessibility & theming regress.** Our a11y (aria-pressed, 44px targets) and
  Tailwind-token theming live in the React components; a string template would
  reimplement or lose them.
- **Bundle + offline.** Adds a runtime dependency for negative benefit.
- **Verdict:** string templating solves a problem we don't have (dynamic *text*)
  at the cost of the problems we do have (interactive, secure, offline, a11y
  cards). Do not adopt. The only place a tiny, sandboxed expression evaluator
  could earn its keep is **derived-stat formulas** in `system.json` (e.g.
  `"hpMax": "{{con}}"`) — but even there a small typed formula AST beats
  Handlebars, and it's orthogonal to card rendering.

### A.4 — Option 3: JSON/schema-driven card descriptors (RIGHT long-term path)

The middle path, and the true form of what the user wants. A card is described
by data mapped onto a **fixed, curated set of React primitives** (label+value
tile, stepper row, toggle grid, key/value table, action button). `system.json`
gains something like:
```jsonc
"cards": [
  { "type": "resourceTrack", "resource": "end", "title": "{label:vitalsPanel}" },
  { "type": "statGrid", "source": "characteristicDMs", "format": "modifier" },
  { "type": "table", "data": "quickReference.combat" }
]
```
A `<CardRenderer descriptor={…}>` switches on `type` and renders the matching
primitive. This is the same philosophy as `DerivedFieldDef.surfaces` and
`system.quickReference`, extended to whole cards.
- **Buys:** a new system that only needs *recombinations* of existing primitives
  ships as pure JSON — the actual "add a system without code" goal.
- **Costs:** medium. Needs a small, well-typed descriptor schema (Zod) and a
  renderer; interactive primitives must expose a constrained, safe prop surface
  (no arbitrary handlers — actions are named intents the renderer wires, e.g.
  `"action": "spendCurrency"`). Novel widgets still need a new primitive + a new
  `type` — but that's an *additive, type-checked* change, not a screen fork.
- **Do this after E1**, and only for the card types that recur across systems.
  It is the natural evolution of the registry once two or three systems exist and
  the common primitives are obvious. Building it speculatively before system #3
  risks a schema that doesn't fit the third system's real needs.

### A.5 — Option 4: self-describing ("modular/mobile") modules

Directly answers "make the cards more modular." Each play-dashboard module today
takes a uniform `PlayModuleProps` but hides its own metadata in the screen. Make
each module *declare* itself:
```ts
interface PlayModuleDef {
  key: PlayModuleKey;
  Component: React.FC<PlayModuleProps>;
  requires?: (engine) => boolean;   // e.g. engine.hasMagic — self-hides
  surfaces?: Surface[];             // sheet / dashboard / print
  defaultRegion?: number;
}
```
The registry becomes a list of these; the screen renders whatever satisfies
`requires`. This makes cards **relocatable and self-gating** — you can drop a
module into any layout slot and it knows whether it belongs. It's a small,
high-leverage refinement layered on Option 1, and it's what makes Option 3's
renderer clean later (each primitive is just a very small self-describing module).

### A.6 — Recommendation & phased path

1. **Now/near-term (with E1):** Option 1 + Option 4 — registry of self-describing
   modules, layout from `engine.playDashboard.regions` and `engine.panels`.
   Deletes the forks, ships system #3 as mostly data. Low risk, no new deps.
2. **After system #3 exists:** Option 3 — lift the *recurring* card types into a
   JSON descriptor + `CardRenderer`, so further systems are JSON-only. Let the
   third system's real requirements shape the descriptor schema.
3. **Never:** Handlebars/string templating for cards (A.3). If a data-driven
   *formula* need appears (derived stats in `system.json`), use a small typed
   formula evaluator, not a general template engine — and treat it as a separate,
   sandboxed concern from rendering.

Net: the user's instinct is right — push cards toward pure data — but the vehicle
is declarative descriptors and a component registry, not a templating language.
Every step is additive and type-safe, and none of it should precede the E1
extraction that makes composition data-driven in the first place.

*(Note: this appendix was authored directly — the delegated research agent
dropped on a transient API error mid-run before it could write its findings.)*
