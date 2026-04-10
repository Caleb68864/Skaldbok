---
date: 2026-04-10
evaluated_date: 2026-04-10
topic: "Encounter as notes-folder: unify combat, capture NPCs in-flow, route everything through one linking engine"
author: Caleb Bennett
status: evaluated
tags:
  - design
  - encounters
  - notes
  - bestiary
  - linking
  - soft-deletes
  - skaldbok
---

# Encounter as Notes-Folder — Design

## Summary

Skaldbok currently has two parallel combat systems, an Encounter modal that
only captures participants (no narrative), and a Quick Log that cannot mint
or reference NPCs without navigating away from the session. This design
unifies those three problems under a single mental model: **an Encounter is
an open folder; anything logged while it is open drops into it by default.**

The fix is structural, not cosmetic. Combat becomes a `type: 'combat'`
encounter (the old note-based `type: 'combat'` path and its `CombatTimeline`
overlay are removed). Quick Log entries auto-attach to the currently-active
encounter via the existing `entityLinkRepository`, which already has the
read side wired but no write side. NPCs can be minted inline from two entry
points: an encounter's participant picker ("Create new…") and a new NPC /
Monster action in the Quick Log palette. A new `represents` relationship
type migrates participant→creature references off direct FK columns onto
entity links, establishing "one linking engine to rule them all." Every
domain table gains soft-delete support (`deletedAt` + `softDeletedBy`) so a
future restore UI and a planned Gantt-style session timeline both inherit
consistent behavior.

## Approach Selected

**Unify everything on the existing `Encounter` record, extended with
narrative fields and driven by the existing `entityLinkRepository`.** Combat
is a type of encounter. Notes are attached to encounters via `contains`
edges. Participant → creature references migrate to `represents` edges. One
linking engine, one mental model, incremental schema cost.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Session (active)                                         │
│                                                          │
│  active encounter: derived from "encounter whose last   │
│  segment has no endedAt" — no stored pointer            │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │ Encounter (active)                          │         │
│  │   id, sessionId, campaignId                 │         │
│  │   title, type: combat|social|exploration    │         │
│  │   description (ProseMirror, optional)       │         │
│  │   body        (ProseMirror, optional)       │         │
│  │   summary     (ProseMirror, optional)       │         │
│  │   tags: string[], location?: string         │         │
│  │   segments: [{ startedAt, endedAt? }]       │         │
│  │   participants: EncounterParticipant[]      │         │
│  │   combatData? (type=combat only)            │         │
│  │   deletedAt?, softDeletedBy?                │         │
│  └─────────────────────────────────────────────┘         │
│                            ▲                             │
│                            │ contains (auto, overridable)│
│                            │                             │
│  Quick Log ────────────────┘                             │
│  ├─ Skill check       ─┐                                 │
│  ├─ Loot              ─┤                                 │
│  ├─ Quote             ─┤  Every action routes through    │
│  ├─ Rumor             ─┤  logToSession → noteRepository  │
│  ├─ HP change         ─┤  .create + createLink (contains)│
│  ├─ Rest / Death roll ─┤  in one Dexie transaction.      │
│  ├─ Note (generic)    ─┤  ◄── NEW lightweight action     │
│  └─ NPC / Monster    ─┘  ◄── NEW mints bestiary entry    │
│                                                          │
│  Session bar:                                            │
│    Active: [Tavern, 8 min]                               │
│    Recently ended: [Bar fight] [←one-click reopen]       │
└──────────────────────────────────────────────────────────┘

Bestiary  (CreatureTemplate table, /bestiary page)
  • Full catalog, reachable from its own page for pre/post session work
  • Also mintable inline from:
      (a) encounter participant picker — "Create new…"
      (b) Quick Log NPC/Monster action
  • EncounterParticipant → CreatureTemplate via `represents` edge
    (NOT a direct FK column — migrated in this design)
```

### Conceptual layers

1. **Session** — the top-level container (one per game night).
2. **Encounter** — the scope/folder. Holds narrative, participants, optional
   combat data. Owns a bag of attached Notes via `contains` edges.
3. **Note** — the atomic log entry. Every Quick Log action creates one.
   Notes carry `sessionId` directly; encounter membership is an edge, not a
   column.
4. **CreatureTemplate** — the bestiary row. Referenced from participants by
   `represents` edge. Unchanged data model, new entry points.

### Key architectural decisions

- **Combat is a `type: 'combat'` encounter.** The note-based combat path and
  `CombatTimeline` fullscreen overlay are removed. Old `type: 'combat'`
  notes are deleted (user confirmed: no migration, clean slate).
- **Notes-folder scope via entity links.** Quick Log entries are linked to
  their active encounter via a new write path that creates a `contains`
  edge. Read path already exists at
  `src/features/encounters/useEncounter.ts:39`.
- **One active encounter at a time, derived, not stored.** "Active" means
  "the encounter in this session whose last segment has no endedAt."
  Session has no `activeEncounterId` column.
- **Segments array instead of scalar start/end.** `Encounter.segments[]`
  supports losslessly representing a paused-and-resumed encounter (tavern
  interrupted by bar fight). Gap data is preserved for the future Gantt.
- **Loose parent linkage via `happened_during` edge.** When Encounter B
  starts while Encounter A is active, a `happened_during` edge
  (B → A) is auto-created. A is auto-ended first. No tree invariants are
  enforced today — future nesting can tighten the semantics.
- **Soft deletes on every domain entity.** `deletedAt` + `softDeletedBy`
  columns. Default query filter via `excludeDeleted` helper. Cascade via
  shared transaction UUID. No restore UI in Phase 1 — foundation only.
- **Participant → creature/character migrated to `represents` edge.**
  `EncounterParticipant.linkedCreatureId` and `linkedCharacterId` columns
  are removed. One linking engine to rule them all.
- **`quickCreateParticipant` is removed.** The inline picker is the one
  path: search existing, "Create new" if absent, minimal fields for
  throwaway NPCs.
- **Gantt note-track groupings are user-configurable.** Stored in settings,
  not hardcoded. Project-wide "Configuration Over Hardcoding" rule captured
  in CLAUDE.md.

## Components

### Data layer

**`encounterRepository`** *(exists, extended)*
- Owns: CRUD for `Encounter` rows.
- Schema additions: `description`, `body`, `summary` (ProseMirror JSON,
  nullable), `tags: string[]`, `location?: string`, `segments: [{
  startedAt, endedAt? }]` (replaces scalar `startedAt`/`endedAt`),
  `deletedAt?`, `softDeletedBy?`.
- New queries:
  - `getActiveEncounterForSession(sessionId)` — returns the encounter whose
    last segment has no `endedAt`, or null.
  - `getRecentEndedEncountersForSession(sessionId, limit)` — for the reopen
    shortcut.
- New mutations:
  - `pushSegment(id, { startedAt })` — appends a new open segment. Asserts
    the previous segment has `endedAt`.
  - `endActiveSegment(id)` — sets `endedAt` on the current open segment.
    Asserts a segment is actually open.
  - `softDelete(id)` / `restore(id)` / `hardDelete(id)` — standard soft-
    delete trio. `softDelete` cascades to owned edges (see entity links).

**`noteRepository`** *(exists, extended)*
- Schema additions: `deletedAt?`, `softDeletedBy?` only. No `encounterId`
  column — encounter membership lives in entity links.
- New mutations: `softDelete`, `restore`, `hardDelete`.

**`entityLinkRepository`** *(exists, extended)*
- Schema additions: `deletedAt?`, `softDeletedBy?` on rows.
- New helper: `deleteLinksForEncounter(encounterId)` — symmetry with
  existing `deleteLinksForNote`. Soft-deletes all edges where the encounter
  is either source or target, using a shared `softDeletedBy` UUID.
- New relationship types introduced by this design:
  - `'contains'` from `encounter` → `note` (write side — the read side
    already works).
  - `'happened_during'` from `encounter` → `encounter` (loose parent).
  - `'represents'` from `encounterParticipant` → `creature` / `character`.
- Top-of-file `entityType` comment updated to include
  `'encounterParticipant'`.

**`creatureTemplateRepository`** *(exists, extended)*
- Schema additions: `deletedAt?`, `softDeletedBy?` only.
- New mutations: `softDelete`, `restore`, `hardDelete`.
- CRUD otherwise unchanged. New call sites come from the inline picker and
  the Quick Log NPC action, but they use existing create methods.

**`sessionRepository`** *(exists, extended)*
- Schema additions: `deletedAt?`, `softDeletedBy?` only.
- No `activeEncounterId` column (derived).

**All other domain repos** (`character`, `party`, `partyMember`, `campaign`)
- Schema additions: `deletedAt?`, `softDeletedBy?` only.
- New mutations: `softDelete`, `restore`, `hardDelete`.

**Shared utility: `src/utils/softDelete.ts`** *(new)*
- `excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[]`
- Every repo read method must route through this helper (or filter inline).
- Enforced by code review and grep.

### Domain hook layer

**`useSessionEncounter(sessionId)`** *(new — `src/features/session/useSessionEncounter.ts`)*
- The single source of truth for "what encounter is currently active in
  this session" at the session-screen level.
- **Instantiation rule:** instantiated exactly once at the `SessionScreen`
  level. Its return value is passed down to child components (SessionBar,
  EncounterScreen when mounted inside the session view) via props or a
  lightweight React context (`SessionEncounterContext` colocated with the
  hook file). Quick Log forms receive the active encounter's id and basic
  metadata from this single source — they MUST NOT instantiate their own
  copy of the hook, which would cause divergent state and race
  conditions.
- Exposes: `activeEncounter`, `recentEnded`, `startEncounter(input)`,
  `endEncounter(id, summary?)`, `reopenEncounter(id)`.
- `startEncounter`:
  1. Read current active encounter (if any).
  2. End its current open segment.
  3. Create the new encounter with `segments: [{ startedAt: now }]` and
     `status: 'active'`.
  4. If a previous active existed, create a `happened_during` edge from the
     new encounter to the previous one.
  5. All wrapped in a single Dexie transaction.
- Owns the invariant: at most one active encounter per session.
- Subscribes to Dexie change hooks on the `encounters` table for
  cross-tab freshness.

**`useEncounter(encounterId)`** *(exists, extended)*
- Already loads encounter + attached notes via
  `getLinksFrom(encounterId, 'contains')`.
- Extended with:
  - Narrative field update methods (`updateDescription`, `updateBody`,
    `updateSummary`, `updateTags`, `updateLocation`).
  - `addParticipantFromTemplate(template)` — now creates a participant AND
    a `represents` edge in one transaction.
  - `removeParticipant(participantId)` — soft-deletes the participant AND
    its outgoing `represents` edges with a shared `softDeletedBy`.
  - `getChildEncounters()` — `getLinksTo(encounterId, 'happened_during')`.
  - `getParentEncounter()` — `getLinksFrom(encounterId, 'happened_during')`.
- **Removed:** `quickCreateParticipant`. The inline picker handles all
  participant creation through the single-path flow.

**`useSessionLog(sessionId)`** *(exists, extended)*
- Currently writes Notes with `sessionId`. Extended:
  - `logToSession(title, type, typeData, { targetEncounterId? })` — the
    single write point for all log types. Creates the note and, if
    `targetEncounterId` is provided (defaults to active encounter), creates
    a `contains` edge in the same transaction.
  - All typed log functions (`logSkillCheck`, `logSpellCast`, `logLoot`,
    `logQuote`, `logRumor`, `logHPChange`, `logRest`, `logDeathRoll`,
    `logCoinChange`, etc.) route through `logToSession`.
  - `reassignNote(noteId, newEncounterId | null)` — drives post-hoc note
    reassignment. Soft-deletes the existing encounter→note `contains`
    edge, optionally creates a new one. Asserts the note and target
    encounter share a session.
  - `logGenericNote(title, body)` — creates a `type: 'generic'` note
    through `logToSession`. Powers the new lightweight Quick Log "Note"
    action.
  - `logNpcCapture(input)` — creates a `CreatureTemplate`, creates a
    `type: 'npc'` note referencing it, creates an `introduced_in` edge
    (note → session), and creates a `contains` edge to the active
    encounter if one exists. All in one Dexie transaction.

### UI layer

**`SessionScreen`** *(exists, restructured)*
- Remove the "Start Combat" button.
- Remove the `CombatTimeline` fullscreen overlay path triggered from notes.
- One button: "Start Encounter."
- New **SessionBar** component (`src/features/session/SessionBar.tsx`) at the top showing:
  - Active encounter chip (name, type, duration, click to open
    `EncounterScreen`).
  - "Recently ended:" row with up to 3 one-click reopen chips (from
    `getRecentEndedEncountersForSession`).
- Start Encounter modal gains fields for: optional description
  (ProseMirror), tags, location, and a `happened_during` override select
  ("Started during: [current active ▾]", clearable).

**`EncounterScreen`** *(exists, extended)*
- New section tabs or panels:
  - **Narrative** — description (editable), live body (ProseMirror with
    auto-save), summary (editable, prompted at end).
  - **Participants** — existing view with the new `EncounterParticipantPicker`.
  - **Attached log** — reverse-chronological list of notes from
    `getLinksFrom(encounterId, 'contains')`. Each note shows a "Move to…"
    action for manual reassignment.
  - **Relations** — chips: "Started during: [Parent]" and "Sub-encounters:
    [Child 1, Child 2, …]" from the two `happened_during` queries.
- For `type: 'combat'`, the existing `CombatEncounterView` stays; initiative
  and round tracking live inside the Participants panel as today, but
  driven by `encounter.combatData` instead of note `typeData`.
- "End Encounter" button opens a modal with optional summary field. Closing
  the modal without submitting leaves the encounter active (no silent
  end-on-dismiss).

**`EncounterParticipantPicker`** *(new — `src/features/encounters/EncounterParticipantPicker.tsx`)*
- Search input filters `CreatureTemplate` by name (soft-deleted excluded).
- Results list + a persistent "+ Create new '{query}'" row at the bottom.
- "Create new" opens an inline mini form (name, category, HP, short
  description, tags), submitting creates the creature AND adds it as a
  participant (with `represents` edge) in one transaction.
- Replaces both the old participant-add flow and `quickCreateParticipant`.

**`SessionQuickActions` / `SessionLogOverlay`** *(exists, extended)*
- Two new actions in the Quick Log palette:
  - **Note** — rich-text mini input, saves as `type: 'generic'` via
    `logGenericNote`.
  - **NPC / Monster** — mini creature form, saves via `logNpcCapture`.
- Every existing action form gains an "Attach to: [active ▾]" control at
  the bottom. Options: currently active, other encounters in this session,
  "session only (no encounter)." Defaults to active. Drives the
  per-entry override.
- **Per-entry reset:** the control's value is NOT sticky between form
  opens. Every time a Quick Log form opens, the control re-defaults to
  the currently-active encounter (or "session only" if none). A user
  who picks "session only" for one skill check will have the next skill
  check default back to the active encounter. This prevents a silent
  misattribution pattern where the user forgets they changed the default.
- **Success feedback:** after a successful Quick Log write, a brief toast
  (via `@radix-ui/react-toast`, the existing toast primitive) appears for
  ~2 seconds: `"Logged to Tavern"` when attached to an encounter,
  `"Logged to session"` when attached to session only. Toast is
  non-blocking and dismissable.

**`BestiaryScreen`** *(exists, unchanged data model)*
- Still the planning/catalog view.
- Must respect soft-delete filtering (list excludes `deletedAt !== null`
  by default, with optional "show archived" toggle).

**`SessionTimelineStrip`** *(planned — NOT in Phase 1 scope)*
- Gantt-style visual on the session page.
- Four configurable note tracks (defaults: mechanics, narrative, inventory,
  NPCs) above a bottom encounter track.
- Encounter bars are drawn from `segments[]` — paused/resumed encounters
  render as split bars (Render A) in v1, with the data model supporting
  continuous-with-notch rendering (Render C) later.
- Tapping a note dot opens a quick-view modal with an Edit action.
- Drag-drop between encounter bands calls `useSessionLog.reassignNote`.
- Deferred to Phase 2. Phase 1 guarantees all data needed is present
  (timestamps, edges, reassign primitive, segments array).

### What changes, what stays, what dies

| Item | State |
|------|-------|
| `Note.type: 'combat'` code path + `CombatTimeline` fullscreen | **Deleted** |
| Existing `type: 'combat'` notes | **Deleted** (clean slate) |
| "Start Combat" button | **Deleted** |
| `useEncounter.quickCreateParticipant` | **Deleted** |
| `EncounterParticipant.linkedCreatureId` / `linkedCharacterId` columns | **Deleted** |
| `Encounter.startedAt` / `endedAt` scalars | **Replaced by `segments[]`** |
| `Encounter` narrative fields (description, body, summary, tags, location) | **New** |
| `deletedAt` + `softDeletedBy` on all domain tables | **New** |
| `useSessionEncounter` hook | **New** |
| `EncounterParticipantPicker` component | **New** |
| `SessionBar` component with reopen chips | **New** |
| Quick Log "Note" action | **New** |
| Quick Log "NPC / Monster" action | **New** |
| Per-entry "Attach to:" override on log forms | **New** |
| Auto-creation of `contains` edges in `logToSession` | **New** |
| `happened_during` relationship type | **New** |
| `represents` relationship type | **New** |
| `'encounterParticipant'` as an entityType | **New** |
| `deleteLinksForEncounter` helper | **New** |
| `excludeDeleted` helper (`src/utils/softDelete.ts`) | **New** |
| `softDelete` / `restore` / `hardDelete` on every repo | **New** |
| `noteRepository` core schema | **Unchanged** |
| `creatureTemplateRepository` core schema | **Unchanged** (only soft delete added) |
| `entityLinkRepository` read/write primitives | **Unchanged** — reused |
| `/bestiary` page | **Unchanged** (behavior respects soft delete) |
| `SessionTimelineStrip` (Gantt) | **Planned Phase 2** |
| User-facing restore UI | **Planned Phase 2** |

## Data Flow

### Flow 1 — Start an encounter (no prior active)

```
User → "Start Encounter" modal → useSessionEncounter.startEncounter(input)
  ├─ encounterRepository.create({
  │    sessionId, title, type, description, tags, location,
  │    segments: [{ startedAt: now }],
  │    participants: [],
  │    status: 'active',
  │  })
  └─ (no happened_during edge — nothing was active)
```

### Flow 2 — Start an encounter while another is active

```
User → "Start Encounter" (tavern already active)
  └─ useSessionEncounter.startEncounter(input)  [single Dexie transaction]
       ├─ Read active encounter (tavern)
       ├─ encounterRepository.endActiveSegment(tavern.id)
       ├─ encounterRepository.create({ ...new encounter, status: 'active' })
       └─ entityLinkRepository.createLink({
            from: newEncounter.id, fromType: 'encounter',
            to:   tavern.id,       toType: 'encounter',
            relationshipType: 'happened_during',
          })
```

The auto-end-previous behavior is non-negotiable — enforces the "one active
at a time" invariant. An override control in the modal allows clearing the
`happened_during` auto-link (e.g., party leaves tavern → ambush outside).

**User feedback:** after the transaction commits, a non-modal toast
(via `@radix-ui/react-toast`) shows `"Tavern ended, Bar Fight started"`
for ~3 seconds. This makes the auto-end visible to the user so it can't
happen silently. If the user didn't realize the Tavern was still active,
the toast is their cue and the "Reopen: Tavern" chip is their recovery
path (one click brings it back).

### Flow 3 — Quick Log entry (auto-attach to active)

```
User → Quick Log → Skill check → form → submit
  └─ useSessionLog.logSkillCheck(character, skill, result, targetEncounterId?)
       │  targetEncounterId defaults to active encounter
       └─ logToSession(...)  [single Dexie transaction]
            ├─ noteRepository.create({ sessionId, type: 'skill-check', ... })
            └─ if targetEncounterId:
                 entityLinkRepository.createLink({
                   from: targetEncounterId, fromType: 'encounter',
                   to:   note.id,            toType: 'note',
                   relationshipType: 'contains',
                 })
```

Every typed log function routes through `logToSession`. Extending it once
covers every log type.

### Flow 4 — Post-hoc reassignment (drives future Gantt drag-drop)

```
User → drags note dot / clicks "Move to…" → useSessionLog.reassignNote(noteId, newEncounterId|null)
  [single Dexie transaction]
  ├─ Look up existing encounter→note contains edge via getLinksTo
  ├─ If one exists: soft-delete it (edges are immutable identities)
  └─ If newEncounterId !== null:
       createLink({ from: newEncounterId, to: noteId, relationshipType: 'contains' })
```

Note is never mutated — only edges are rewritten.

### Flow 5 — End encounter with optional summary

```
User → "End Encounter" → summary modal
  └─ (submit) useSessionEncounter.endEncounter(id, summary?)  [single transaction]
       ├─ encounterRepository.endActiveSegment(id)
       └─ encounterRepository.update(id, { status: 'ended', summary? })

(dismiss without submit) → no-op, encounter stays active
```

### Flow 6 — Reopen a recently-ended encounter

```
User → clicks "Reopen: Tavern" chip → useSessionEncounter.reopenEncounter(tavernId)
  [single transaction]
  ├─ If a different encounter is currently active: end its segment first
  ├─ encounterRepository.pushSegment(tavernId, { startedAt: now })
  └─ encounterRepository.update(tavernId, { status: 'active' })
```

### Flow 7 — NPC capture from inline participant picker

```
User → Encounter → "Add participant" → EncounterParticipantPicker
  ├─ Path A: picks existing creature
  │    └─ useEncounter.addParticipantFromTemplate(template)  [single transaction]
  │         ├─ Append new EncounterParticipant to encounter.participants[]
  │         └─ entityLinkRepository.createLink({
  │              from: participant.id, fromType: 'encounterParticipant',
  │              to:   template.id,    toType: 'creature',
  │              relationshipType: 'represents',
  │            })
  │
  └─ Path B: "+ Create new 'kobol'"
       ├─ Inline mini form (name, category, HP, etc.)
       └─ [single transaction]
            ├─ creatureTemplateRepository.create(...)
            ├─ Append new EncounterParticipant
            └─ createLink({ ...represents edge... })
```

### Flow 8 — NPC capture from Quick Log (no active encounter or outside one)

```
User → Quick Log → "NPC / Monster" → mini creature form → submit
  └─ useSessionLog.logNpcCapture(input)  [single transaction]
       ├─ creatureTemplateRepository.create(input)
       ├─ noteRepository.create({ sessionId, type: 'npc', title: name, typeData })
       ├─ createLink({ from: note.id, to: sessionId,
       │               relationshipType: 'introduced_in' })
       └─ if activeEncounter:
            createLink({ from: activeEncounter.id, to: note.id,
                         relationshipType: 'contains' })
```

### Flow 9 — Generic quick note (new lightweight action)

```
User → Quick Log → "Note" → rich-text mini input → submit
  └─ useSessionLog.logGenericNote(title, body)
       └─ logToSession(...)  [same attach flow as Flow 3]
```

### Flow 10 — Soft delete cascade (encounter example)

```
User → Delete encounter → confirmation dialog
  └─ encounterRepository.softDelete(encounterId)  [single transaction]
       │  txId = generateId()
       │  now  = nowISO()
       ├─ db.encounters.update(encounterId, { deletedAt: now, softDeletedBy: txId })
       └─ entityLinkRepository.softDeleteLinksForEncounter(encounterId, txId, now)
            ├─ All edges where fromEntityId === encounterId (contains to notes,
            │  happened_during to other encounters, represents from participants)
            └─ All edges where toEntityId === encounterId
```

`restore(encounterId)` reads the encounter's `softDeletedBy`, then clears
`deletedAt` + `softDeletedBy` on every row across every table that shares
that txId.

### Key properties

1. **Notes are immutable w.r.t. encounter membership.** Only edges change.
2. **`logToSession` is the one write point for Quick Log attach behavior.**
3. **Active encounter is derived, not stored.** No `session.activeEncounterId` column.
4. **Every cross-entity relationship routes through `entityLinkRepository`.**
5. **Every multi-row write is wrapped in a Dexie transaction.** Partial
   writes are impossible by design.
6. **`excludeDeleted` is called by every read path.** Deleted rows never
   escape the repository layer without `includeDeleted: true`.

## Error Handling

### Edge 1 — Encounter deletion cascade (revised for soft delete)

- Soft delete never removes attached notes — they survive as free notes
  (unattached to any encounter) after restore of their encounter's
  `contains` edges is *not* performed.
- Wait — clarification: when an encounter is soft-deleted, its `contains`
  edges are also soft-deleted (sharing the same `softDeletedBy`). The notes
  themselves are untouched. On restore of the encounter, the edges are
  restored along with it, so the notes re-appear in its Attached Log.
- The user-visible dialog: *"This will move the encounter and its 7 note
  links to the trash. The notes themselves will not be deleted. You can
  restore them later."*
- Implementation: `encounterRepository.softDelete` calls
  `entityLinkRepository.softDeleteLinksForEncounter` in the same Dexie
  transaction with a shared `softDeletedBy` UUID.

### Edge 2 — Partial write failure (note created but `contains` edge wasn't)

- Every multi-write flow is wrapped in a single `db.transaction('rw',
  [...tables], async () => { ... })`. Dexie rolls back on any throw.
- `logToSession` throws on failure; Quick Log forms show an inline error
  and preserve the draft for retry.
- No partial state is possible — the "or" is atomic.

### Edge 3 — Stale active encounter across tabs

**Primary path (required):** Quick Log forms re-query the active encounter
at submit time (inside the same transaction as the write). A stale UI
render cannot cause a misattributed note — the attach logic runs on fresh
data at write time. This is the authoritative defense against cross-tab
staleness and is not optional.

**Secondary path (optional enhancement, defer if risky):**
`useSessionEncounter` MAY subscribe to Dexie change hooks on the
`encounters` table to reactively re-derive the active encounter for UI
freshness. No existing code in Skaldbok uses Dexie hooks today, so adopting
them is green-field. If the first attempt at hooks doesn't work cleanly,
fall back to a poll-on-focus approach (re-query on `window.focus` and on
session bar mount) — the correctness guarantee is already covered by the
primary path. Do NOT block Phase 1 on getting Dexie hooks working.

**In `startEncounter`,** the transaction re-reads the active encounter at
write time and auto-ends whatever is actually active — last writer wins
with correct parent linking. This is the write-side correctness guarantee
paired with the primary read-time re-query above.

### Edge 4 — Reopen target staleness

- "Recently ended" = the 3 most recently ended (non-deleted) encounters in
  this session, session-scoped, no time window.
- A full "All encounters in this session" list is accessible from the
  session screen for reopening older ones.
- If the reopen target no longer exists (deleted from another tab), the
  call errors with a toast and the session bar refreshes.

### Edge 5 — End encounter modal dismissed without submitting

- Dismiss = cancel. Encounter stays active.
- Only explicit submit (with or without summary text) ends the encounter.
- Prevents silent end-on-escape-key bugs.

### Invariants

1. **At most one active encounter per session.** Derived from "last segment
   has no endedAt." Enforced by `startEncounter` and `reopenEncounter` both
   auto-ending any current active encounter.
2. **At most one open segment per encounter.** Enforced by `endActiveSegment`
   (refuses if none open) and `pushSegment` (asserts previous segment is
   ended).
3. **A `contains` edge from encounter to note implies same session.**
   `reassignNote` and `logToSession` both validate this.
4. **Default reads filter soft-deleted rows.** Enforced by the
   `excludeDeleted` helper convention in every repo read method.
5. **Cross-entity relationships use `entityLinks`, not FK columns.** Only
   exception: 1:1 identity FKs like `Note.sessionId` that are part of the
   entity's core identity. Documented in CLAUDE.md.

## Open Questions

1. **Export / import handling of soft-deleted rows.** Exports should skip
   `deletedAt !== null` rows (documented in CLAUDE.md). The merge engine
   (`src/utils/import/mergeEngine.ts`) currently has no notion of soft
   delete — importing a bundle that references a soft-deleted entity needs
   a defined behavior. Deferred to a later phase.
2. **Dexie schema version bump and migration scaffolding.** This design
   bundles multiple schema changes into one version bump: soft-delete
   columns on every table, `Encounter.segments[]`, `Encounter` narrative
   fields, `EncounterParticipant` FK removal. Mechanical; migration script
   written during implementation.

## Approaches Considered

**Approach A — Unified encounter model on entity links (SELECTED)**
Combat becomes a type of encounter. Quick Log attaches to active encounter
via `entityLinkRepository`. Participant→creature migrates to `represents`
edges. One linking engine. Chosen because the read-side infrastructure
already exists, the user explicitly asked to build on existing linking, and
this matches the stated mental model ("encounter = folder for notes").

**Approach B — Keep two combat systems, just add notes-folder behavior to both**
Rejected. Doubles maintenance. Leaves two conflicting mental models in the
codebase. Doesn't address the root cause of the confusion.

**Approach C — Add `encounterId` FK column to `Note` instead of using entity links**
Rejected. Contradicts the existing half-built entity-link path in
`useEncounter.ts:39`. Introduces a second cross-entity linking pattern in a
codebase that's trying to consolidate on one. Loses the "one linking engine
to rule them all" benefit, and makes the future `represents` migration
inconsistent.

**Approach D — True nested encounters (parent/child tree)**
Deferred, not rejected. The selected approach's `happened_during` edge is
a loose precursor that future work can tighten into true nesting by adding
tree invariants. Doing it now would add scope for questionable immediate
benefit given the one-active-at-a-time UX the user preferred.

## Commander's Intent

**Desired End State**

Phase 1 is done when all of the following are simultaneously true:

1. The Skaldbok app has exactly one way to start an in-session scene:
   "Start Encounter." No "Start Combat" button exists in the UI.
2. A running encounter acts as a notes-folder: while active, Quick Log
   entries of every type (skill check, loot, quote, rumor, HP change, death
   roll, rest, coin change, generic note, NPC/Monster) auto-create a
   `contains` edge from the active encounter to the new note, in the same
   Dexie transaction as the note creation.
3. An Encounter row carries narrative fields (`description`, `body`,
   `summary`, `tags`, `location`) and a `segments: [{startedAt, endedAt?}]`
   array instead of scalar start/end timestamps.
4. An encounter can be ended, re-opened (push a new segment), and
   auto-ended by starting another (with a `happened_during` edge auto-
   created from the new encounter to the previously-active one).
5. The Quick Log palette has two new actions — "Note" (generic rich-text)
   and "NPC / Monster" (mints a bestiary entry and a note in one step).
6. The Encounter view has a participant picker that searches the bestiary
   AND can create a new bestiary entry inline. `quickCreateParticipant`
   no longer exists.
7. `EncounterParticipant.linkedCreatureId` and `linkedCharacterId` columns
   do not exist. Participant → creature/character references are
   expressed as `represents` edges in `entityLinkRepository`.
8. Every domain table has `deletedAt?: string` and `softDeletedBy?: string`
   columns. Every repository read method routes through the
   `excludeDeleted` helper. `softDelete`, `restore`, and `hardDelete`
   methods exist on every repository. No user-facing restore UI is
   required in Phase 1.
9. `npm run build` (tsc -b && vite build) and `npm run lint` both exit
   zero after every phase commit.
10. A session that was active before the Phase 1 migration still opens
    cleanly after the migration (schema upgrade tested against a seeded
    database).

**Purpose**

The current system has two parallel combat flows, an Encounter modal that
only captures participants, and a Quick Log that cannot reference NPCs
without leaving the session page. This friction breaks the tabletop flow
during live play. The unified design restores a single mental model —
**an encounter is an open folder; anything logged while it is open drops
into the folder by default** — and routes every cross-entity relationship
through one linking engine so future features (Gantt timeline, restore
UI, export/import, search) all inherit consistent behavior instead of
bolting onto a second pattern.

**Constraints (MUST / MUST NOT)**

- MUST wrap every multi-row write (note + edge, encounter + segment, soft
  delete + cascade) in a single Dexie `transaction('rw', [...], ...)`
  block. Partial writes are not acceptable.
- MUST route every repository read through the `excludeDeleted` helper (or
  an inline `deletedAt` filter). A single forgotten filter leaks deleted
  rows into the UI and breaks the restore mental model.
- MUST preserve the existing `entityLinkRepository` primitives
  (`createLink`, `getLinksFrom`, `getLinksTo`, `deleteLinksForNote`,
  `getAllLinksFrom`, `getAllLinksTo`). Do not break their signatures.
- MUST use the existing Tiptap editor wrapper (already used in Notes) for
  all new encounter narrative fields. Do not introduce a second rich-text
  stack.
- MUST update `CLAUDE.md`'s `entityType` and relationship-type tables when
  new types are added (`encounterParticipant`, `represents`,
  `happened_during`).
- MUST NOT add a `Note.encounterId` FK column. Encounter membership is
  expressed via the `contains` edge and nothing else.
- MUST NOT add a `Session.activeEncounterId` column. "Active" is derived
  from "the encounter in this session whose last segment has no
  `endedAt`."
- MUST NOT use `hardDelete` from UI code. All user-facing delete paths
  route through `softDelete`.
- MUST NOT hardcode user-facing groupings (e.g. Gantt note-track
  categories). Defaults go in a config module, current values live in the
  settings store.
- MUST NOT leave the old `CombatTimeline.tsx` as a dead import path. If
  the file is kept for archival reasons, remove its imports from
  `SessionScreen.tsx` so no code path reaches it at runtime.

**Freedoms (MAY)**

- MAY organize new files under any existing feature folder pattern
  (`src/features/encounters/`, `src/features/session/`) that matches the
  surrounding code style.
- MAY choose internal helper function names, CSS class names, and React
  component file layout without asking.
- MAY decide whether soft-delete cascade uses a shared helper or
  per-repository implementations, as long as the `softDeletedBy`
  transaction UUID is consistent across cascaded rows.
- MAY skip the Dexie cross-tab reactivity (Edge 3 secondary path) entirely
  if it proves awkward — the primary re-query-at-submit path covers
  correctness.
- MAY split the Dexie schema version bump into multiple migrations if the
  single-version upgrade function grows beyond ~80 lines of code.
- MAY add dev-mode invariant assertions (`console.warn` in dev) for the
  three invariants in Error Handling, but this is optional polish, not a
  gate.

## Execution Guidance

**Observe** — signals the agent should monitor after every change:

- `npm run build` (tsc -b && vite build) exits zero. This is the primary
  verification signal — the repo has no test framework, so the typechecker
  and bundler are the only automatic checks available.
- `npm run lint` (eslint .) exits zero.
- A manual smoke test of the Session screen loads the existing seed data
  without console errors (since there is no automated integration test).
- For each new/extended repository method, the agent SHOULD write a
  temporary throwaway script in `scripts/` or a `*.test.ts` file that
  instantiates the repo against a fresh Dexie database, exercises the
  method, and logs assertions. These can be deleted after verification or
  kept as seed documentation.

**Orient** — codebase conventions and anchors to follow:

- **Repository pattern:** all data access goes through
  `src/storage/repositories/*.ts`. Each file exports functions, not
  classes. Each function uses a try/catch wrapping
  `throw new Error('repoName.method failed: ' + e)`. Do NOT introduce a
  new pattern. Existing example: `entityLinkRepository.ts`.
- **Zod schemas:** every persisted row has a Zod schema in
  `src/types/*.ts` used to `safeParse` on read. Add `deletedAt` and
  `softDeletedBy` to every domain entity schema. Example:
  `entityLinkSchema` in `src/types/entityLink.ts`.
- **ID generation:** import `generateId` from `src/utils/ids` for any new
  id. Do not roll your own.
- **Timestamps:** import `nowISO` from `src/utils/dates` for any
  timestamp. Do not use `new Date().toISOString()` directly.
- **ProseMirror / Tiptap:** reuse the existing editor wrapper
  `TiptapNoteEditor` from `src/components/notes/TiptapNoteEditor.tsx`
  (interface `TiptapNoteEditorProps`). Already used in the Notes system.
  Do NOT instantiate a second Tiptap setup or create a parallel wrapper.
  All three encounter narrative fields (`description`, `body`, `summary`)
  use this same component with different initial content / onChange
  bindings. If the wrapper's current prop signature is not flexible
  enough for the encounter use case, extend it — do not fork it.
- **React 19 + react-router-dom v7:** the app uses these versions. Use
  the modern hook patterns — no class components, no legacy router APIs.
- **Tailwind v4:** all styling uses Tailwind utilities via
  `@tailwindcss/vite`. Do not introduce CSS modules or styled-components.
- **Radix UI primitives:** dialogs, dropdowns, tabs, toasts, and tooltips
  all use `@radix-ui/react-*`. New components should use the existing
  Radix wrappers, not build their own primitives.

**Shortcuts — apply these patterns without deliberation:**

- When adding a repository method that reads rows: ALWAYS call
  `excludeDeleted(rows)` before returning. Grep for the helper name to
  verify coverage.
- When adding a cross-entity relationship: ALWAYS use
  `entityLinkRepository.createLink` + a new (or existing)
  `relationshipType` string. Never add a new FK column for
  cross-entity references. (Exceptions: 1:1 identity FKs like
  `Note.sessionId` — unchanged in this design.)
- When performing a multi-row write: ALWAYS wrap in
  `db.transaction('rw', [tables], async () => {...})`. Never rely on
  sequential awaits outside a transaction for atomicity.
- When adding a new entity type that can participate in a link: ALWAYS
  add it to the free-string comment list at the top of
  `entityLinkRepository.ts`. This design adds `'encounterParticipant'`.
- When adding a new `relationshipType`: ALWAYS add a row to the table
  in `CLAUDE.md`'s "Entity Linking" section.
- When user-facing copy needs to express a category / grouping /
  preset list: ALWAYS put it in `src/config/` and read it via a
  settings selector. Never hardcode in a component.

**Escalate when:**

- A schema change is needed beyond the ones listed in this design.
- A new external dependency (npm package) is required.
- `entityLinkRepository`'s existing primitive signatures need to change.
- `quickCreateParticipant` removal uncovers an unexpected caller outside
  `src/features/encounters/`.
- The Dexie migration function grows beyond ~80 lines or requires a
  second version bump.
- Any Tiptap / ProseMirror configuration change is needed.
- A decision would deviate from a MUST / MUST NOT constraint above.

## Acceptance Criteria

Each new or extended component must satisfy these testable conditions before
the agent considers its sub-phase complete. These are enumerated here so
the agent has a self-check list; they are NOT a replacement for
`npm run build` and `npm run lint` passing.

**`encounterRepository` (extended)**
- Creating an encounter with `segments: [{startedAt: now}]` persists and
  round-trips through the Zod schema.
- `endActiveSegment(id)` throws if the last segment already has `endedAt`
  set.
- `pushSegment(id, {startedAt})` throws if the last segment is still open
  (no `endedAt`).
- `getActiveEncounterForSession(sessionId)` returns the encounter whose
  last segment has no `endedAt`, or `null` if none exist.
- `getActiveEncounterForSession(sessionId)` returns `null` for
  soft-deleted encounters even if they have an open segment.
- `softDelete(id)` sets `deletedAt` and `softDeletedBy` on the encounter
  and cascades to all edges (`contains`, `happened_during`) in a single
  transaction with a shared `softDeletedBy` UUID.
- `softDelete(alreadyDeletedId)` is a silent no-op — does not throw,
  does not re-stamp `deletedAt`, does not re-cascade.
- `restore(id)` clears `deletedAt` and `softDeletedBy` on the encounter
  and on every row (across tables) sharing its `softDeletedBy` UUID.
- `restore(nonDeletedId)` is a silent no-op — does not throw, does not
  touch the row.
- These idempotency rules apply uniformly to `softDelete` and `restore`
  on every repository (Session, Note, CreatureTemplate, Character, Party,
  PartyMember, Campaign, EntityLink).

**`useSessionEncounter` hook (new)**
- Calling `startEncounter(input)` when no other encounter is active creates
  a new encounter with one open segment and no `happened_during` edge.
- Calling `startEncounter(input)` when another encounter IS active ends
  the previous one's open segment, creates the new encounter, and creates
  a `happened_during` edge from the new encounter to the previous one,
  all in a single Dexie transaction.
- Calling `startEncounter({ title: '' })` or with a missing/invalid
  `type` throws with a descriptive error (`'useSessionEncounter.startEncounter: title required'`
  / `'useSessionEncounter.startEncounter: type must be combat|social|exploration'`).
  The error is surfaced to the UI form for display.
- Calling `endEncounter(id, summary?)` sets the final `endedAt` on the
  last segment and writes the summary if provided.
- Calling `endEncounter(nonExistentId)` throws with a descriptive error.
- Calling `reopenEncounter(id)` ends any currently-active encounter's
  open segment first, then pushes a new open segment onto the target
  encounter.
- Calling `reopenEncounter(nonExistentId)` or `reopenEncounter(softDeletedId)`
  throws with a descriptive error.
- `activeEncounter` is always the encounter (if any) whose last segment
  has no `endedAt` — derived, never stored.
- `recentEnded` returns the 3 most-recently-ended, non-deleted encounters
  in the session. When the session has zero ended encounters,
  `recentEnded` is an empty array and the SessionBar hides the row
  entirely (no placeholder text).

**`useSessionLog` hook (extended)**
- Every typed log function (`logSkillCheck`, `logLoot`, `logQuote`,
  `logRumor`, `logHPChange`, `logRest`, `logDeathRoll`, `logCoinChange`,
  `logSpellCast`, `logAbilityUse`, `logGenericNote`, `logNpcCapture`)
  routes through a single `logToSession` helper.
- `logToSession` creates the note AND, if a target encounter is provided
  (defaulting to the currently-active encounter, re-queried at write
  time), creates a `contains` edge in the same Dexie transaction.
- `reassignNote(noteId, newEncounterId | null)` soft-deletes the
  existing encounter→note `contains` edge (if any) and optionally creates
  a new one.
- `reassignNote` throws if `newEncounterId` belongs to a different
  session than the note.
- `reassignNote(nonExistentNoteId, ...)` throws with a descriptive error.
- `reassignNote(noteId, nonExistentEncounterId)` throws with a
  descriptive error.
- `reassignNote(noteId, alreadyCurrentEncounterId)` is a silent no-op
  (no edge churn, no error).
- `logGenericNote(title, body)` creates a `type: 'generic'` note via
  `logToSession`.
- `logNpcCapture(input)` creates a `CreatureTemplate`, a `type: 'npc'`
  note, an `introduced_in` edge (note → session), and (if an encounter is
  active) a `contains` edge, all in a single Dexie transaction.

**`useEncounter` hook (extended)**
- `addParticipantFromTemplate(template)` creates the participant AND a
  `represents` edge in the same transaction.
- `removeParticipant(participantId)` soft-deletes the participant AND
  its outgoing `represents` edges with a shared `softDeletedBy` UUID.
- Loading an encounter resolves participant → creature/character
  references through a batched `getLinksFrom` query, not through
  individual FK column reads.
- `quickCreateParticipant` no longer exists. Callers use
  `EncounterParticipantPicker`'s "Create new…" path.

**`entityLinkRepository` (extended)**
- A new helper `softDeleteLinksForEncounter(encounterId, txId, now)`
  soft-deletes every edge where the encounter is source or target.
- `'encounterParticipant'` is added to the valid `entityType` comment
  list.
- A new helper `softDeleteLinksForNote(noteId, txId, now)` exists
  (renamed / wrapping the existing `deleteLinksForNote` to respect soft
  delete conventions).

**Schema migration (Dexie)**
- The migration is declared as `this.version(8).stores({...}).upgrade(async (tx) => {...})`
  in `src/storage/db/client.ts`. The current highest version in that file
  is 7; this design bumps it to 8. All schema changes in this design live
  in a single version bump unless the upgrade function exceeds ~80 lines,
  in which case split into version 8 (soft-delete columns) and version 9
  (encounter restructure).
- Before the schema version bump commits, the upgrade function writes a
  backup JSON dump to `tmp-backup/pre-encounter-rework-{YYYY-MM-DD}.json`.
  The dump is a single JSON object with one key per table, each value
  being the full `toArray()` of that table **at the pre-migration schema
  version**. Tables to back up: `encounters`, `notes`, `entityLinks`,
  `creatureTemplates`, `characters`, `sessions`, `campaigns`, `parties`,
  `partyMembers`. Backup is written via `tx.table('<name>').toArray()`
  before any destructive operation.
- If the backup write fails, the migration throws and does not proceed
  with the destructive schema change. User data is preserved in the
  pre-migration state.
- After running the migration function against a seeded pre-migration
  database, every encounter row has a `segments` array with at least one
  element derived from its old `startedAt` (with `endedAt` copied if
  present).
- After migration, every row in every domain table has `deletedAt` and
  `softDeletedBy` columns (null by default).
- After migration, no `EncounterParticipant.linkedCreatureId` or
  `linkedCharacterId` references remain — they've been converted to
  `represents` edges (for any existing participant rows).
- **Verification grep:** `grep -r "quickCreateParticipant" src/` returns
  zero matches after the rework.
- **Verification grep:** `grep -r "linkedCreatureId\|linkedCharacterId" src/`
  returns zero matches after the rework.
- **Verification grep:** `grep -r "from '../features/combat/CombatTimeline'" src/`
  returns zero matches (no runtime-reachable import of the old component).

**UI (SessionScreen, EncounterScreen, Quick Log)**
- The "Start Combat" button no longer exists anywhere in the UI.
- `CombatTimeline` is no longer imported from `SessionScreen.tsx`.
- The Session screen shows a session bar with the active encounter name
  + up to 3 "Recently ended" reopen chips.
- The Start Encounter modal has fields for title, type, optional
  description, optional tags, optional location, and an optional
  "Started during:" override.
- The Encounter screen has Narrative, Participants, Attached log, and
  Relations sections.
- The Quick Log palette shows a "Note" action and an "NPC / Monster"
  action alongside the existing ones.
- Every existing Quick Log form has an "Attach to: [active ▾]" control
  at the bottom.

## Decision Authority

**Agent decides autonomously (Perform):**
- Dexie migration function shape and internal structure.
- React component file organization within existing feature folders.
- Internal helper function names.
- CSS / Tailwind utility choices.
- Developer-facing error message wording (`console.warn` / thrown Error
  text).
- Test / scratch-script file names and locations.
- Internal Zod schema composition (as long as the public shape matches
  the plan).
- Whether to extract shared helpers into `src/utils/` or
  `src/features/*/utils/`.

**Agent recommends, human approves (Recommend → Decide):**
- Final list and order of Quick Log actions visible in the palette.
- User-facing dialog copy (delete confirmation, end-encounter summary
  prompt, inline NPC creation form labels).
- The exact field set of the inline NPC creation mini-form.
- Any Tiptap configuration change shared between Notes and Encounter
  narrative editors.
- Whether to delete the `CombatTimeline.tsx` source file outright or
  leave it as a dead path with no imports.
- Any deviation from the MUST / MUST NOT constraints in Commander's
  Intent.
- Whether to introduce Dexie cross-tab reactivity in Phase 1 at all.
- Splitting the Dexie schema bump into multiple versions.

**Human decides (Decide, no delegation):**
- Scope changes (adding or removing features beyond this plan).
- Schema changes to entities not mentioned in this plan.
- Adding a new npm dependency.
- Changes to `entityLinkRepository`'s existing primitive signatures.
- Retiring any existing repository method not named in this plan.
- Changes to the overall repository / feature folder layering.

## War-Game Results

**Most Likely Failure — Dexie schema migration**

The version bump touches many tables at once (soft-delete columns on 8
tables, `Encounter.segments[]` restructure, `EncounterParticipant` FK
removal). A bug in the upgrade function could corrupt the database or
leave it in an inconsistent state.

*Mitigation:*
1. The upgrade function writes a pre-migration JSON dump to
   `tmp-backup/pre-encounter-rework-{YYYY-MM-DD}.json` via
   `noteRepository.getAll`, `encounterRepository.getAll`, etc. *before*
   the schema version bump runs.
2. Each table's migration step is wrapped in try/catch that logs detailed
   error context (table name, row id, error message) before rethrowing.
3. The upgrade function is tested against a seeded dev database: seed →
   close → bump version → re-open → verify row counts and schema shape.
4. If the upgrade function grows beyond ~80 lines, split it across
   two Dexie version bumps (e.g. v+1 adds soft-delete columns, v+2 does
   the encounter restructure).

**Scale Stress** — N/A. Skaldbok is a local single-user app. A session
contains tens to low hundreds of notes and a dozen encounters at most.
No scale-related gap found.

**Dependency Disruption — Tiptap API changes**

The encounter narrative fields reuse the existing Tiptap editor from
Notes. A future Tiptap upgrade that breaks one will break both. This is
a feature (single upgrade surface) not a bug, but the implementing agent
MUST reuse the existing wrapper rather than instantiating a second
Tiptap setup — otherwise divergence sneaks in. Encoded as a MUST
constraint in Commander's Intent.

**Maintenance Assessment (6-month readability check)**

Strong. `CLAUDE.md` now documents:
- The entity-linking pattern (with relationship type table and "why
  links, not FK columns" guidance).
- The soft-delete convention (schema, default filtering, cascade via
  `softDeletedBy`, restore semantics).
- The "configuration over hardcoding" rule.

A developer returning to this code in 6 months can read `CLAUDE.md`
first, then `docs/plans/2026-04-10-encounter-notes-folder-unification-design.md`
for the specific decisions that drove this rework, then follow the
conventions into the code. The chain is readable without context from a
prior author.

**Assumption Audit Cross-Reference**

Two assumptions from Phase 1.5 of the evaluation warrant additional
war-gaming:

- ASM-6 (no test infrastructure) compounds with the Dexie migration risk
  above. Without automated tests, the only defense against a broken
  migration is a pre-migration JSON backup plus manual smoke testing.
  Both are mandated above.
- ASM-12 (no feature flag / staged rollout) compounds with ASM-6. If the
  rework ships broken, there's no automatic rollback. Mitigation: the
  pre-migration JSON backup provides a manual recovery path. This is
  acceptable for a local single-user app but would be blocking for a
  multi-user deployment.

## Evaluation Metadata

- Evaluated: 2026-04-10
- Red-teamed: 2026-04-10
- Cynefin Domain: Complicated
- Critical Gaps Found (evaluate): 2 (2 resolved)
- Important Gaps Found (evaluate): 5 (5 resolved)
- Suggestions (evaluate): 3 (2 incorporated, 1 kept as optional polish)
- Assumptions audited: 12 (7 confirmed, 2 supported, 2 unsupported
  mitigated, 1 contradicted and mitigated)
- Red Team CRITICAL findings: 5 (5 resolved)
  - C-1 Missing file paths (Developer) — resolved
  - C-2 Tiptap wrapper unnamed (Developer) — resolved
  - C-3 useSessionEncounter ownership undefined (Architect) — resolved
  - C-4 Migration location undefined (Architect) — resolved
  - C-5 Invalid-input criteria missing (QA) — resolved
- Red Team ADVISORY findings: 7 (7 resolved)
  - A-1 Pre-migration backup scope — resolved
  - A-2 softDelete/restore idempotency — resolved
  - A-3 quickCreateParticipant grep verification — resolved
  - A-4 Recently-ended empty state — resolved
  - A-5 Attach-to reset behavior — resolved
  - A-6 Auto-attach toast feedback — resolved
  - A-7 Auto-end-previous toast feedback — resolved

## Next Steps

- [x] Run `/forge-evaluate` against this design to stress-test assumptions.
- [x] Run `/forge-red-team` for adversarial multi-perspective review.
- [ ] Run `/forge` to turn the design into an agent-executable spec.
- [ ] Run `/forge-prep` to expand sub-specs into detailed phase specs.
- [ ] Run `/forge-run` to execute the phase specs against the codebase.
- [ ] After Phase 1 ships: build `SessionTimelineStrip` (Gantt view) as Phase 2.
- [ ] After Phase 1 ships: build user-facing restore UI (trash view) as Phase 2.
- [ ] Revisit open question 1 (export/import soft-delete handling).
