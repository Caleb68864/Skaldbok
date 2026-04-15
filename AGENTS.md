# Skaldbok — Project Notes for Codex

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
