# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Skaldbok Is

Skaldbok is a local-first, offline-capable PWA for tabletop RPG play. It ships with a generic bundled system; users can import or author their own. It runs entirely in the browser: React 19 + Vite + Tailwind v4 on the UI side, Dexie (IndexedDB) for persistence, `vite-plugin-pwa` for installability, and `@vitejs/plugin-basic-ssl` so tablets can install it over LAN HTTPS. No backend.

`AGENTS.md` is a near-verbatim copy of this file for Codex; keep the two in sync when editing conventions here.

## Commands

- `npm run dev` — Vite dev server (HTTPS via self-signed cert).
- `npm run build` — `tsc -b` project references build, then `vite build`. **This is the only type-check command** — there is no standalone `lint` or `typecheck` script; rely on `tsc -b` via build.
- `npm run preview` — serve the built bundle (used by `build-and-run.bat` for LAN tablet testing on port 4173).
- `npm run docs` / `npm run docs:open` — TypeDoc API docs into `docs/api/`.
- `npm test` — Vitest, run once. `npm run test:watch` for watch mode.

`npm test` covers **pure logic only** — schema migrations, stat-key resolution,
ability projections, container wealth. It is deliberately scoped: these are the
places where a bug silently corrupts saved characters rather than failing to
compile. There is no component/DOM test setup, so UI changes are still verified
by `npm run build` plus running the app.

The `tests/` directory additionally contains a Python Playwright E2E script
(`e2e_full_test.py`) that drives the running app against the dev server.

## Architecture Big Picture

### Entry, providers, routing
- `src/main.tsx` → `AppProviders` → `App`. `AppProviders` nests `BrowserRouter` → `ThemeProvider` → `AppStateProvider` → `ActiveCharacterProvider` → `ToastProvider` → `CampaignProvider`. Anything that needs the active campaign or character goes inside that tree.
- Routes live in `src/routes/index.tsx`. Two layers: a shell-less `/print` route, and everything else under `<ShellLayout />` (persistent bottom-nav shell). Legacy `/sheet`, `/skills`, `/gear`, `/magic`, `/combat` are permanent redirects into `/character/*` — keep them.

### Storage layer (Dexie / IndexedDB)
- `src/storage/db/client.ts` defines the `SkaldbokDatabase` Dexie class and all `version(n).stores(...)` migrations. **Schema changes = add a new `version()` block; never edit an old one.** See the existing compound indexes on `entityLinks` (`[fromEntityId+relationshipType]`, `[toEntityId+relationshipType]`) — any new link-lookup pattern wants a matching compound index.
- Every domain entity is accessed through a repository in `src/storage/repositories/*.ts`. UI code and hooks call repositories; they **never** touch the Dexie tables directly. If you find yourself reaching into `db.notes.where(...)` from a component, stop and add/extend a repo method.
- Shared utilities live in `src/utils/` — notably `softDelete.ts` (`excludeDeleted` helper) and `ids.ts` (`generateId`). The ID generator is used for both entity IDs and soft-delete transaction IDs.

### Domain model
- Entities: `Campaign` → `Session` → `Note` / `Encounter`; `Character`, `Party`/`PartyMember`, `CreatureTemplate` (bestiary), `Attachment`, `EntityLink` (generic graph edge), plus KB graph (`kb_nodes`, `kb_edges`) and app metadata/settings.
- Relationships between entities are almost always expressed via `entityLinks` rows rather than FK columns. See the **Entity Linking** section below — this is the single most important convention to internalize before adding cross-entity features.

### Game system as data
- The active RPG system (fields, skills, abilities, resources) is a `SystemDefinition` loaded from JSON — `src/systems/classic-fantasy/system.json` — not a set of hardcoded types. `src/systems/classic-fantasy/index.ts` just re-exports it. Zod schemas in `schemas/` validate character / system / settings shapes on import. Adding rules content is usually a JSON edit, not a code change. Additional systems can be added as sibling folders under `src/systems/` and registered in `src/systems/registry.ts`.
- *Behaviour* that varies by ruleset lives in the **System Engine**, not in screens. See the section below — internalize it before touching any character-facing UI.

### Feature vs. component layout
- `src/components/` — presentational, reusable UI (shell, layout, primitives, ui, fields, modals, timeline, notes).
- `src/features/` — feature-scoped logic: each subdir (`session`, `combat`, `encounters`, `bestiary`, `campaign`, `characters`, `notes`, `kb`, `export`, `import`, `persistence`, `settings`, `systems`) owns its screens, hooks, and adapters. Hooks like `useEncounter`, `useSessionEncounter`, `useSessionLog` are where repo calls get composed into UI-ready state.
- `src/screens/` — top-level route destinations. Thin: compose features + components. Business logic belongs in feature hooks.
- `src/context/` — cross-cutting providers (`AppStateContext`, `ActiveCharacterContext`, `ToastContext`). `CampaignContext` lives under `src/features/campaign/`.

### PWA / offline
- `vite-plugin-pwa` is configured in `vite.config.ts` with `registerType: 'prompt'`. Service-worker / install lifecycle code lives in `src/pwa/`. Because the app is entirely local-first, treat IndexedDB as the source of truth; there is no server reconciliation to defer to.
- `@` is aliased to `src/` in `vite.config.ts` — prefer relative imports when both work, but `@/` is available.

## System Engine

Skaldbok supports more than one RPG system. Everything that differs between
rulesets — vocabulary, panels, formulas, rest and death rules, currency,
probability — is resolved through a **`SystemEngine`**, never hardcoded in a
screen and never branched on `systemId`.

Source: `src/features/systems/engine/`. Two adapters ship today:
`classicFantasyEngine` (Dragonbane-like) and `travellerEngine`.

### The rule

> **If a value differs between rulesets, it comes from the engine.**
> A screen that says `if (systemId === 'traveller')` is a bug.

```ts
const engine = useSystemEngine();          // active character's system
const engine = getEngine(systemDefinition); // when you already hold the system
```

### What the engine owns

| Area | Surface |
|---|---|
| Vocabulary | `terms` (`abilities`, `spells`, `magicResource`, `healthResource`, `roleFallback`) |
| Panel/screen titles | `labels` (`abilitiesScreen`, `resourcesPanel`, `attributesPanel`, `encumbrance`) |
| Which panels exist | `panels: PanelKey[]`, `hasMagic` |
| Attributes / resources | `attributeIds`, `resourceIds`, `attributeBadge`, `primaryHealthResourceId` |
| Skills | `skill.{valueLabel, range, advancementMax, defaultValue, display, computeValue, isRelevant, supportsMarks, supportsBoonBane, trainedAffectsValue}` |
| Derived stats | `derivedStats()`, `derivedFields` (each with `surfaces` — sheet/dashboard/print show different subsets) |
| Money | `currency` — `denominations` plus `read`/`write`, so no screen touches `character.wealth` directly |
| Rules models (nullable) | `rest`, `death`, `advancement` — `null` means "this system has no such mechanic", which is how a panel gets hidden |
| Dice | `probability.chance()`, `outcomes`, `rollModifiers`, `timeUnits` |
| Modifier targets | `modifiableStats()` |

`labels.abilitiesScreen: null` hides that tab entirely rather than linking to a
dead-end screen. `terms` and `labels` can be overridden per-system from
`system.json`, so renaming user-facing vocabulary needs no code change.

### Rules of thumb

- **Never** reintroduce a `systemId ===` branch. Add an engine field instead.
- Ids and labels are separate. Persisted keys (settings, stored preferences,
  ability types) use stable ids; only display strings come from `terms`/`labels`.
  Deriving a storage key from a label orphans user data the moment it is renamed.
- Nullable models express absence. Prefer `engine.rest === null` over a
  capability flag plus a parallel list.
- The classic-fantasy adapter **delegates** to the existing helpers in
  `utils/derivedValues`, `utils/restActions` and `utils/boonBane` rather than
  restating Dragonbane's rules. Keep it that way — it is what makes Dragonbane
  behaviour provably unchanged.

### Stat keys are namespaced

Modifier targets use `attr:str`, `res:str`, `derived:movement`, `armor:helmet`,
`skill:axes` (`src/utils/statKeys.ts`). A bare id is ambiguous — Traveller's
damage-track resources share ids with its characteristics. Build keys with
`attrKey()`/`resKey()`/etc., never by string concatenation. Unprefixed keys still
resolve by the legacy precedence order so old data keeps working.

### A modifier target must reach a consumer

**Offering a target in `engine.modifiableStats` is only half the work.** The
picker will happily write `derived:movement`; if nothing *reads* that key the
modifier is inert — it shows in the buff bar and changes no number. Four of
these shipped at once (every `derived:`, `armor:`, `res:` and `skill:` target),
because "it resolves" and "it does something" are different questions and only
the first was ever asked.

Read every stat through the shared resolvers in `utils/derivedValues.ts`, never
off the record:

| Reading | Use | Not |
|---|---|---|
| A derived stat | `resolveDerivedField(character, derived, field)` | `derived[key]` + your own override fold |
| Armour rating | `resolveArmorRating(character, slot)` | `character.armor.rating` |
| A skill value | `resolveSkillValue(character, id, stored)` | `character.skills[id].value` |
| An attribute | `getEffectiveValue(attrKey(id), character)` | `character.attributes[id]` |

Order is fixed and tested: **computed → override → modifiers.** An override
*replaces* the computed value; a modifier *adjusts* whatever the value then is.

`engineContract.test.ts` fingerprints the engine's whole visible output, applies
a +3 to every offered target, and fails if the fingerprint does not move. Add a
target and forget the consumer and that test names it. Add a *new consumer* and
extend the fingerprint, or it guards nothing.

**Bind editable inputs to the stored value, never the effective one** — the
skill input writes back what it displays, so binding it to `effective` bakes a
scene-long buff in permanently. `resolveSkillValue` returns `base` and
`effective` separately for exactly this reason.

### Adding or editing a system

1. Add `src/systems/<id>/system.json` + `index.ts`, and register it in
   `src/systems/registry.ts` (this drives the character-creation picker).
2. Add an engine adapter under `src/features/systems/engine/` and add a
   `system.id === '<id>'` branch to `baseEngineFor` in `engine/index.ts` — the
   one sanctioned place for a systemId branch (the "no `systemId ===`" rule
   applies everywhere *else*). The `registry.ts` list and this branch are two
   hand-maintained lists that must stay in lockstep.
3. **Bump the `version` whenever you edit a bundled `system.json` — AND bump
   `sheet.json`'s *separate* `version` whenever you edit that file.** Both are
   cached in IndexedDB behind independent version gates (`useSystemDefinition`
   for `system.json`, `useSheetTemplate` for `sheet.json`), and each only
   refreshes when its bundled `version` is *strictly higher* than the cached
   copy. Consequences of forgetting:
   - The change is invisible to anyone who already ran the app — **including you
     locally**, because the IndexedDB cache survives HMR/reload. To see your own
     edit without a bump, clear IndexedDB.
   - Editing skills/attributes/labels → bump `system.json`. Editing the sheet
     layout/panel order/tiles → bump `sheet.json`. Edit both, bump one → half
     your change ships. The two counters are unrelated and nothing cross-checks
     them. (The `sheet.json` gate is the most-forgotten one.)

### Character schema migrations

`CharacterRecord` changes go through the ladder in `src/utils/migrations.ts`:
bump `CURRENT_SCHEMA_VERSION`, add a `migrateCharacterVnToVn+1`, and **add tests**
(`src/utils/migrations.test.ts`). Migrations must be idempotent and must preserve
unrelated fields.

Records are upgraded on read (`upgradeCharacter`, used by the character
repository) and persisted on the next save. `migrateCharacter` additionally
validates and is used for **import**, where the data is untrusted; the read path
deliberately skips validation so one malformed field cannot stop the whole
library from loading.

## Entity Linking

Skaldbok uses a single generic graph-edge table (`entityLinks`) to express
relationships between domain objects. **Prefer this over adding foreign-key
columns** when linking entities together. It's the canonical pattern for
cross-entity references and the existing code already relies on it.

### The primitive

Each row in the `entityLinks` table is a directed edge:

```ts
{
  fromEntityId, fromEntityType,   // source of the edge
  toEntityId,   toEntityType,     // target of the edge
  relationshipType,               // what the edge means
}
```

Source: `src/storage/repositories/entityLinkRepository.ts` and
`src/types/entityLink.ts`.

Both `[fromEntityId+relationshipType]` and `[toEntityId+relationshipType]` are
indexed, so lookups in either direction are O(log n). `entityType` is a
free-string field — the valid values are listed in a comment at the top of
`entityLinkRepository.ts` (keep that comment current when adding new types).

### Relationship types in use

| Type              | From → To                               | Meaning                                             |
|-------------------|-----------------------------------------|-----------------------------------------------------|
| `contains`        | `session` → `note`                      | The note belongs to the session                     |
| `contains`        | `encounter` → `note`                    | The note was logged inside the encounter            |
| `introduced_in`   | `note` → `session`                      | The character/NPC represented by the note was first introduced in this session |
| `happened_during` | `encounter` → `encounter`               | The source encounter occurred while the target was active (soft parent link) |
| `represents`      | `encounterParticipant` → `creature` / `character` | The in-scene participant represents this bestiary creature or PC |
| `promoted_into`   | `note (log)` → `note`                   | The log note was promoted into this target note     |

When adding a new relationship type, update the table above **and** the comment
inside `entityLinkRepository.ts`.

### Standard operations

- **Create a link:** `createLink({ fromEntityId, fromEntityType, toEntityId, toEntityType, relationshipType })`.
- **Query outgoing edges of a type:** `getLinksFrom(id, relationshipType)` — e.g.
  to load every note attached to an encounter:
  `getLinksFrom(encounterId, 'contains')` then filter `toEntityType === 'note'`.
- **Query incoming edges of a type:** `getLinksTo(id, relationshipType)` — e.g.
  to find the encounter a note currently belongs to:
  `getLinksTo(noteId, 'contains')` then filter `fromEntityType === 'encounter'`.
- **Reassignment:** delete the old edge and create a new one. Never mutate an
  existing link row — edges are immutable identities.
- **Cleanup on delete:** call `deleteLinksForNote(noteId)` when a note is
  deleted so dangling edges don't accumulate. When new entity types gain
  deletion flows, add a matching `deleteLinksFor<Entity>` helper.

### When to use entity links vs. a direct column

Use **entity links** when:

- The relationship is conceptually many-to-many, or might become one later.
- Multiple code paths need to query both directions of the relationship.
- The existing code already expresses the relationship this way (e.g. encounter
  ↔ note is already read via `getLinksFrom(encounterId, 'contains')` in
  `useEncounter.ts`).
- You want the relationship to be revocable/reassignable without schema churn.

Use a **direct column** when:

- The relationship is strictly 1:1 and load-bearing for the parent entity's
  identity (e.g. `Note.sessionId` — a note always belongs to exactly one
  session and the column is part of its core identity).
- Query performance demands a single-row read without a join-like query.

When in doubt, prefer entity links. Adding a direct FK later is a migration;
removing one is harder.

## Soft Deletes

All domain entities in Skaldbok use **soft deletes**. User-facing "Delete"
actions never remove rows from the database — they mark them with a timestamp
so they can be restored later. This is a project-wide convention; any new
entity you add must follow it.

### Schema

Every domain entity row carries two nullable fields:

```ts
{
  deletedAt?: string;        // ISO timestamp — set when the row is soft-deleted
  softDeletedBy?: string;    // transaction UUID — identifies the cascade that deleted this row
}
```

`deletedAt` answers *"when was this deleted?"* and doubles as the soft-delete
boolean. `softDeletedBy` is a transaction-scoped UUID shared by every row
deleted together as part of a single cascade — it's how `restore` knows which
rows to bring back atomically.

Entities that carry these fields: `Session`, `Encounter`, `Note`,
`CreatureTemplate`, `Character`, `Party`, `PartyMember`, `Campaign`,
and **`EntityLink`**. Yes — even edges. This keeps encounter-deletion cascades
reversible without losing the original edge identities.

### Default query behavior (non-negotiable)

**Every repository read method filters out soft-deleted rows by default.**
A single repo method that forgets to filter will leak deleted rows into the UI
and break the restore mental model for users.

Use the shared helper:

```ts
import { excludeDeleted } from '../utils/softDelete';

const activeNotes = excludeDeleted(await db.notes.where(...).toArray());
```

Grep for `excludeDeleted` to audit which read paths are covered. Any read path
that does not call this helper (or does not filter `deletedAt` inline) is a
bug.

Methods that intentionally surface deleted rows (for trash / restore UI) take
an explicit opt-in:

```ts
getNotes({ includeDeleted: true })
```

Without the option, deleted rows never escape the repository layer.

### Delete and restore operations

Every repository exposes:

- `softDelete(id)` — set `deletedAt = now`, `softDeletedBy = txId`. Cascades to
  owned entity links in the same transaction (see below).
- `restore(id)` — clear `deletedAt` and `softDeletedBy`. Restore cascaded
  children by matching `softDeletedBy === txId`.
- `hardDelete(id)` — actually removes the row. **Internal only.** Called by
  purge jobs and data-cleanup migrations. Never invoked from UI code.

User-facing "Delete" buttons always call `softDelete`. The old `delete` name
should not exist in UI-facing code paths — it's a tell that something was
written before this convention landed.

### Cascade via `softDeletedBy`

When a soft delete cascades (e.g. deleting an encounter also soft-deletes its
`contains` edges), all cascaded rows share the same `softDeletedBy` UUID in
the same transaction:

```ts
const txId = generateId();
const now = nowISO();

await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
  await db.encounters.update(encounterId, { deletedAt: now, softDeletedBy: txId });
  const edges = await db.entityLinks
    .where('fromEntityId').equals(encounterId)
    .or('toEntityId').equals(encounterId)
    .toArray();
  await db.entityLinks.bulkUpdate(
    edges.map(e => ({ key: e.id, changes: { deletedAt: now, softDeletedBy: txId } }))
  );
});
```

`restore(encounterId)` reads the `softDeletedBy` off the encounter, then
clears `deletedAt` + `softDeletedBy` on every row (across every table) that
shares that UUID. Restoration is atomic and reversible.

### Invariants and soft delete

Domain invariants (e.g. "at most one active encounter per session") are
phrased over **non-deleted rows only**. Because default queries filter deleted
rows, code that enforces invariants never sees deleted rows and the
phrasing stays natural. Do not write invariant checks that include deleted
rows unless you have a specific reason and are calling `includeDeleted: true`
explicitly.

### What soft delete does NOT do

- It does not affect export bundles — exports ship live data only. Deleted
  rows are skipped.
- It does not protect against storage corruption. Backups and purge policies
  are separate concerns.
- It does not make `hardDelete` safe to call from UI. `hardDelete` is
  irreversible; route all user deletes through `softDelete`.

### Declaring a capability is half the work

**Every field on the system/engine contract must have a reader.** This sweep
found the same bug five times in five unrelated places — `derived:`/`armor:`/
`res:` modifier targets, `hiddenBuiltIns.armor: ['weight']`,
`damageTrack.penaltyPerLevel`, `scale.allowsPlus`, `resource.refresh:
'session'`. Every one type-checked, passed schema validation, and did nothing.

`declaredCapabilities.test.ts` enforces it: a property declared in
`types/system.ts` or `engine/types.ts` must be read somewhere in `src`, or be
listed in `KNOWN_UNIMPLEMENTED` with a reason. The allowlist has its own test
asserting each entry is *still* unread, so it cannot rot.

When adding a declarative field, write the consumer in the same change.

## Skills: groups, custom skills, and mode guards

### Speciality groups

A system may declare `skillGroups` and tag skills with `groupId`
(`src/types/system.ts`). It is **membership, not hierarchy** — Gun Combat
(Slug/Energy/Archaic) are three peer skills sharing a group; there is no parent
row, because in Traveller there is no plain "Gun Combat". The bare id means the
first speciality (`gunCombat` = Slug).

`features/characters/skillGroups.ts` owns the rules. `trainGroupAtZero` is
additive only and returns the *same* bag when nothing is missing, so a no-op
cannot dirty the record or fire an autosave. It never touches a member that
already has an entry — including an explicit untrained-at-0, which is a player
saying "I do not have this".

The schema validates that every `groupId` resolves and every declared group has
members. Zod strips unknown keys, so a field added to the type but not the
schema silently vanishes for *imported* systems while working for bundled ones —
add both.

### Custom skills

`CharacterRecord.customSkills` holds skills the system definition does not
declare (Traveller's Language/Profession/Art/Science are open-ended).
`resolveSkillCategories(system, character)` merges them into the system's
categories on read, so **every skill surface must go through it** — the skills
screen, the play dashboard and the printed sheet all treat a custom skill like a
declared one, and none of them knows custom skills exist.

Ids are generated, never derived from the name, so a rename cannot orphan the
stored value. Deleting removes the definition *and* the value together. A skill
whose `categoryId` no longer resolves is filed into a trailing "Custom" group
rather than dropped — one you cannot see is one you cannot delete.

### Play-mode field guards

Ask `useFieldEditable` with a constant from `FIELD_PATHS`
(`src/utils/modeGuards.ts`), never a literal. The guard used to be asked about
`'attributes.str'` and `'resources.hp.max'` — strings that look specific but
mean "any attribute" and "any resource maximum", and that named Dragonbane ids
in system-neutral code. A test fails on any `useFieldEditable('literal')`.

The guard fails **closed**: an undeclared path is not editable.

## Configuration Over Hardcoding

**User-facing groupings, categories, presets, and defaults live in
configuration — not in component code.** This is a project-wide rule.

### What this means in practice

When you catch yourself writing a literal array or map of user-facing values
inside a component, stop. That's a signal that the data wants to live
somewhere the user (or a future preference UI) can change. Put it in a
settings store, a database table, or a config file loaded at startup.

Examples of things that **must** be configurable:

- Timeline / Gantt track groupings (which note types cluster into which row).
- Default tag sets and tag presets.
- Quick Log action palettes (which actions appear, in what order).
- Filter presets and saved views.
- Note type groupings (what counts as "mechanics" vs "narrative" etc.).
- Category labels for bestiary, notes, locations, etc.
- Any "enum of user-meaningful strings" that the user might plausibly want to
  rename, reorder, or extend.

Examples of things that are fine to keep in code:

- Developer-facing constants (feature flags, retry counts, cache sizes).
- Structural enums the schema depends on (`status: 'active' | 'ended'` —
  renaming these is a migration, not a preference).
- UI copy (labels, button text, error messages) — those are localization
  concerns, separate from this rule.
- Type-system literal unions used for exhaustiveness checking.

### How to implement a configurable grouping

1. Define a default value in a config file (`src/config/defaults/*.ts` or a
   similar location). This is the out-of-the-box shape.
2. Store the current value in the user settings store (e.g. a `settings`
   table or an IndexedDB key-value store), falling back to the default if
   unset.
3. Read it through a hook or selector — never import the default constant
   directly from the component. The component always asks the settings layer
   for the current value.
4. A future preferences screen updates the stored value; the component
   re-renders via the normal state flow.

### Why this rule exists

A hardcoded grouping feels cheap and fast at first, but every one of them is
a future rework when the user (you, or anyone else running the app) decides
the default isn't what they want. Moving groupings into configuration from
day one costs about 10 extra minutes per grouping and saves a painful
refactor later. Treat any literal array of user-facing strings in a
component as a code smell.
