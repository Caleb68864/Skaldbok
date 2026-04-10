# Encounter as Notes-Folder — Unification Spec

## Meta
- Client: Skaldbok (personal project)
- Project: Skaldbok
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldbok
- Date: 2026-04-10
- Author: Caleb Bennett
- Design Source: [[2026-04-10-encounter-notes-folder-unification-design.md]]
- Status: partial (5 of 9 sub-specs complete)
- Executed: 2026-04-10
- Result: 5/9 sub-specs PASS (data layer, hooks, and domain logic complete). Build is green after every wave. Remaining: Sub-Spec 6 (UI primitives), 7 (screen integration), 8 (Quick Log palette), 9 (verification + cleanup). See `docs/specs/encounter-notes-folder-unification/run-state/wave-2-5-results.json`.
- Quality Scores:
  - Outcome clarity: 5/5
  - Scope boundaries: 5/5
  - Decision guidance: 5/5
  - Edge coverage: 5/5
  - Acceptance criteria: 5/5
  - Decomposition: 4/5
  - Purpose alignment: 5/5
  - **Total: 34/35**
- Pipeline stages completed: brainstorm → evaluate → red-team → forge

## Outcome

Skaldbok has exactly one in-session scene mechanism — the Encounter — and it acts as a notes-folder while open. Quick Log entries of every type auto-attach to the active encounter via `entityLinkRepository`. Combat is a `type: 'combat'` encounter with no parallel "Start Combat" path. NPCs can be minted from the encounter participant picker or from a new Quick Log action without leaving the session page. Every cross-entity reference (participant → creature, encounter → note, encounter → encounter parent) flows through one linking engine. Every domain table has soft-delete support so a future restore UI and a planned Gantt timeline both inherit consistent behavior. `npm run build` and `npm run lint` exit zero. An existing session opens cleanly after the Dexie v8 migration.

## Intent

**Trade-off hierarchy (what matters more when valid approaches conflict):**
1. **Consistency with existing Skaldbok patterns over novel design.** Repository functions (not classes), Zod `safeParse` on reads, `generateId` / `nowISO` helpers, Radix primitives, Tailwind utilities, Tiptap wrapper reuse. Match what's there.
2. **Single linking engine over direct FKs.** Every cross-entity relationship goes through `entityLinkRepository`. Exception: 1:1 identity FKs already in place (`Note.sessionId`, `Encounter.sessionId`, etc.).
3. **Transactional atomicity over convenience.** Every multi-row write wraps in `db.transaction('rw', [...], ...)`. No partial writes.
4. **Correctness at the data layer over UX polish.** If in doubt, invariants and validation first. Toasts and animations second.
5. **Deletion is always soft-delete by default.** `hardDelete` is internal-only. User-facing deletes route through `softDelete`.

**Decision boundaries (escalate, don't decide):**
- Any schema change beyond the ones enumerated in the sub-specs.
- Adding a new npm dependency.
- Changing `entityLinkRepository`'s existing primitive signatures.
- Discovering an unexpected caller of `quickCreateParticipant` outside `src/features/encounters/`.
- The Dexie migration function growing beyond ~80 lines or requiring a second version bump.
- Any Tiptap / ProseMirror configuration change.
- Any decision that would violate a MUST / MUST NOT in Constraints.

**Decide autonomously:**
- Internal helper names, CSS / Tailwind classes, file organization within existing feature folders, developer-facing error messages, React component composition.

## Context

This spec implements the evaluated and red-teamed design at `docs/plans/2026-04-10-encounter-notes-folder-unification-design.md`. The design came out of a forge-brainstorm session addressing three user-reported problems on `/session`:

1. "Start Combat" and "Start Encounter" are confusing and feel like they conflict.
2. The encounter modal only allows adding participants, not notes about the encounter.
3. There's no way to add an NPC / monster note from the Quick Log — bestiary is out of the way.

The design reframes Encounter as "an open folder for notes" with the existing entity-link infrastructure providing the folder semantics. Combat becomes a `type: 'combat'` encounter. The note-based `type: 'combat'` path and its fullscreen `CombatTimeline` overlay are removed. `useEncounter.ts:39` already queries `getLinksFrom(encounterId, 'contains')` — the read side of the notes-folder linkage is already wired, but no code creates the edges today.

**Related context already documented:**
- **`CLAUDE.md`** (repo root, written during the brainstorm session): documents the entity-linking pattern, the soft-delete convention, and the "configuration over hardcoding" rule. **Read this first.** All sub-specs must conform to its conventions.
- **Design doc** `docs/plans/2026-04-10-encounter-notes-folder-unification-design.md`: full architecture, data flow diagrams, edge cases, Commander's Intent, Execution Guidance, Acceptance Criteria per component, Decision Authority map, War-Game results. **The authoritative reference for design decisions** — when a sub-spec's acceptance criteria are ambiguous, the design doc resolves them.

**Codebase anchors (verified):**
- Repositories: `src/storage/repositories/*.ts` — function-based, try/catch wrapping, Zod `safeParse` on reads. Example: `entityLinkRepository.ts`.
- Zod schemas: `src/types/*.ts`.
- Id generation: `src/utils/ids.ts` (`generateId`).
- Timestamps: `src/utils/dates.ts` (`nowISO`).
- Tiptap wrapper: `src/components/notes/TiptapNoteEditor.tsx` (`TiptapNoteEditor`, `TiptapNoteEditorProps`).
- Dexie client: `src/storage/db/client.ts` — current max version is 7, this spec adds version 8.
- `useEncounter` read path for attached notes: `src/features/encounters/useEncounter.ts:39`.
- `useSessionLog` exists at `src/features/session/useSessionLog.ts`; all typed log functions already route through a shared `logToSession` helper.
- `CombatEncounterView` (`src/features/encounters/CombatEncounterView.tsx`) is the intended combat UI and is explicitly NOT a wrapper for the old `CombatTimeline`.

## Requirements

1. Combat is unified under `type: 'combat'` encounters. The button "Start Combat" no longer exists in the UI. `CombatTimeline.tsx` has no runtime-reachable import path from session or encounter code.
2. `Encounter` rows carry narrative fields (`description`, `body`, `summary`, all optional ProseMirror JSON), `tags: string[]`, `location?: string`, and a `segments: [{startedAt, endedAt?}]` array replacing the scalar `startedAt`/`endedAt`.
3. Exactly one encounter per session is "active" at a time, defined as "the encounter whose last segment has no `endedAt`." There is no `activeEncounterId` column anywhere — the value is derived.
4. When an encounter is started while another is active, the prior encounter's open segment is closed and a `happened_during` entity link is created from the new encounter to the prior encounter, in the same Dexie transaction as the new encounter creation.
5. Ended encounters can be reopened via a "Recently ended" chip in the session bar. Reopening pushes a new segment onto the target encounter (preserving gap information) after auto-ending any currently-active encounter.
6. `useSessionLog.logToSession` creates a `contains` edge from the active encounter (or an explicit `targetEncounterId`) to every new note in the same Dexie transaction. Every typed log function routes through `logToSession`.
7. `useSessionLog.reassignNote(noteId, newEncounterId | null)` soft-deletes the existing encounter→note `contains` edge and optionally creates a new one, enforcing same-session invariant.
8. Two new Quick Log actions exist: **Note** (generic rich-text, saves as `type: 'generic'`) and **NPC / Monster** (mini form that creates a `CreatureTemplate`, a `type: 'npc'` note, an `introduced_in` edge, and — if active — a `contains` edge, all in one transaction).
9. Every existing Quick Log action form has an "Attach to: [active ▾]" control that defaults to the currently-active encounter on every form open (per-entry reset, not sticky).
10. `EncounterParticipant.linkedCreatureId` and `linkedCharacterId` columns are removed. Participant → creature / character references are expressed as `represents` edges in `entityLinkRepository`. `addParticipantFromTemplate` creates the participant AND the edge in one transaction.
11. `useEncounter.quickCreateParticipant` is removed. `EncounterParticipantPicker` is the single path for adding participants (search existing + "Create new…" mini form for throwaway NPCs).
12. Every domain table (`Session`, `Encounter`, `Note`, `CreatureTemplate`, `Character`, `Party`, `PartyMember`, `Campaign`, `EntityLink`) has `deletedAt?: string` and `softDeletedBy?: string` columns.
13. Every repository read method routes through an `excludeDeleted` helper (located at `src/utils/softDelete.ts`) or an equivalent inline filter. Methods that need deleted rows take an explicit `{includeDeleted: true}` option.
14. Every repository exposes `softDelete(id)`, `restore(id)`, and `hardDelete(id)`. `softDelete` on already-deleted and `restore` on non-deleted are silent no-ops.
15. Encounter `softDelete` cascades to all associated edges (`contains` to notes, `happened_during` in both directions, `represents` from its participants) via a shared `softDeletedBy` UUID. `restore` brings them all back atomically.
16. A Dexie v8 upgrade function migrates existing data. Before any destructive schema change, a backup JSON dump is written to `tmp-backup/pre-encounter-rework-{YYYY-MM-DD}.json`. If the backup fails, the migration throws and the database is left in v7 state.
17. `SessionScreen` wraps its children in a `SessionEncounterContext` provider fed by a single instantiation of `useSessionEncounter(sessionId)` at the screen level. No other component instantiates the hook.
18. `SessionBar` component renders the active encounter chip and up to 3 "Recently ended" reopen chips. When there are zero recently-ended encounters, the row is hidden entirely.
19. `EncounterScreen` renders four sections: **Narrative** (description, body, summary — all editable via `TiptapNoteEditor`), **Participants** (with `EncounterParticipantPicker`), **Attached log** (reverse-chronological list from `getLinksFrom(encounterId, 'contains')`), and **Relations** (parent + children chips from `happened_during` queries).
20. Success toasts appear via `@radix-ui/react-toast` for: Quick Log success attached ("Logged to {title}"), Quick Log success unattached ("Logged to session"), and auto-end-previous on new encounter start ("{prior} ended, {new} started").
21. `npm run build` (tsc -b && vite build) and `npm run lint` both exit zero at the end of every sub-spec.

## Sub-Specs

### Sub-Spec 1 — Soft-Delete Foundation
**Scope:** Add soft-delete columns and standard methods across every domain entity and repository. Create the shared `excludeDeleted` helper. Route every existing read method through it.

**Files:**
- `src/utils/softDelete.ts` (new) — exports `excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[]`, plus a `generateSoftDeleteTxId(): string` convenience wrapper around `generateId`.
- `src/types/session.ts`, `src/types/encounter.ts`, `src/types/note.ts`, `src/types/creatureTemplate.ts`, `src/types/character.ts`, `src/types/party.ts`, `src/types/campaign.ts`, `src/types/entityLink.ts` — add optional `deletedAt` and `softDeletedBy` string fields to each Zod schema.
- `src/storage/repositories/sessionRepository.ts`, `encounterRepository.ts`, `noteRepository.ts`, `creatureTemplateRepository.ts`, `characterRepository.ts`, `partyRepository.ts`, `campaignRepository.ts`, `entityLinkRepository.ts` — add `softDelete(id)`, `restore(id)`, `hardDelete(id)` methods. Update every existing read method to route results through `excludeDeleted`. Add an optional `{ includeDeleted?: boolean }` parameter where recovery reads will eventually need it (at minimum on `getById` and `getAll*` methods).

**Dependencies:** none.

**Acceptance Criteria:**
- `[STRUCTURAL]` `src/utils/softDelete.ts` exists and exports `excludeDeleted<T>(rows: T[]): T[]` that filters out rows where `deletedAt` is a non-empty string.
- `[STRUCTURAL]` Every Zod schema listed above has optional `deletedAt: z.string().optional()` and `softDeletedBy: z.string().optional()` fields.
- `[STRUCTURAL]` Every listed repository exports `softDelete`, `restore`, and `hardDelete` functions with signatures `(id: string) => Promise<void>`.
- `[MECHANICAL]` `grep -rn "\.toArray()" src/storage/repositories/` shows every result either passing through `excludeDeleted(...)` or in a method explicitly named to include deleted rows.
- `[BEHAVIORAL]` `softDelete('nonexistent-id')` resolves without throwing.
- `[BEHAVIORAL]` `softDelete(id)` on a row where `deletedAt` is undefined sets both `deletedAt` (ISO timestamp) and `softDeletedBy` (UUID).
- `[BEHAVIORAL]` `softDelete(id)` on a row where `deletedAt` is already set is a silent no-op — does not modify the row, does not throw.
- `[BEHAVIORAL]` `restore(id)` on a row where `deletedAt` is set clears both `deletedAt` and `softDeletedBy`.
- `[BEHAVIORAL]` `restore(id)` on a row where `deletedAt` is undefined is a silent no-op — does not throw.
- `[BEHAVIORAL]` `hardDelete(id)` removes the row from the table entirely.
- `[BEHAVIORAL]` Default `getById`, `getAll`, and any `getBy*` methods on every repository return `undefined` / empty array for rows whose `deletedAt` is set.
- `[BEHAVIORAL]` Read methods with `{ includeDeleted: true }` return deleted rows alongside non-deleted ones.
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 2 — Dexie v8 Schema Migration
**Scope:** Declare a new Dexie version in `src/storage/db/client.ts` that adds soft-delete columns, restructures Encounter with the segments array and narrative fields, removes EncounterParticipant FK columns, and writes a pre-migration backup to `tmp-backup/`.

**Files:**
- `src/storage/db/client.ts` — add `this.version(8).stores({...}).upgrade(async (tx) => {...})`.
- `tmp-backup/` — runtime-created directory for backup JSON; add to `.gitignore` if not already.
- `.gitignore` — add `tmp-backup/` if not present.

**Dependencies:** Sub-Spec 1.

**Acceptance Criteria:**
- `[STRUCTURAL]` `src/storage/db/client.ts` contains a call to `this.version(8).stores({...})`.
- `[STRUCTURAL]` The v8 `.upgrade(async (tx) => {...})` handler is present.
- `[STRUCTURAL]` `.gitignore` contains an entry for `tmp-backup/` (or an equivalent pattern that excludes it).
- `[BEHAVIORAL]` Running the upgrade against a seeded pre-migration database writes `tmp-backup/pre-encounter-rework-{YYYY-MM-DD}.json` before mutating any schema.
- `[BEHAVIORAL]` The backup JSON is a single object with keys: `encounters`, `notes`, `entityLinks`, `creatureTemplates`, `characters`, `sessions`, `campaigns`, `parties`, `partyMembers`, each holding the full `toArray()` of that table.
- `[BEHAVIORAL]` If the backup write fails (simulated by stubbing the write layer to throw), the upgrade function throws and the database remains at v7.
- `[BEHAVIORAL]` After a successful migration, every existing `Encounter` row has a `segments` array with one element derived from the prior `startedAt` and (if present) `endedAt`.
- `[BEHAVIORAL]` After migration, every existing row in every domain table has `deletedAt: undefined` and `softDeletedBy: undefined` (or the columns are declared such that reads default to those values).
- `[BEHAVIORAL]` After migration, no `EncounterParticipant` has `linkedCreatureId` or `linkedCharacterId` fields set — any previously-set values have been converted to `represents` edges in `entityLinks` for the corresponding participant ids.
- `[MECHANICAL]` `grep -n "version(8)" src/storage/db/client.ts` returns at least one match.
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.
- `[BEHAVIORAL]` Opening the dev app (`npm run dev`) against a freshly seeded database after migration loads the session view without console errors.
- `[INTEGRATION]` Seed v7 data → close database → upgrade function runs → re-open at v8 → every prior session and encounter loads cleanly with narrative fields defaulting to undefined and `segments` populated from old scalar dates.

---

### Sub-Spec 3 — Encounter + EntityLink Data Layer Extensions
**Scope:** Extend `Encounter` type with narrative and segments fields, remove participant FK columns from `EncounterParticipant`. Add new repository query/mutation methods for encounter lifecycle. Extend `entityLinkRepository` with `'encounterParticipant'` entityType support and `softDeleteLinksForEncounter` helper.

**Files:**
- `src/types/encounter.ts` — add `description?`, `body?`, `summary?`, `tags: string[]`, `location?`, `segments: Segment[]`. Remove `linkedCreatureId` and `linkedCharacterId` from `EncounterParticipant` schema.
- `src/storage/repositories/encounterRepository.ts` — add `getActiveEncounterForSession(sessionId)`, `getRecentEndedEncountersForSession(sessionId, limit)`, `pushSegment(id, {startedAt})`, `endActiveSegment(id)`. Keep existing CRUD. Extend `softDelete` (from Sub-Spec 1) to call `softDeleteLinksForEncounter` in the same transaction.
- `src/storage/repositories/entityLinkRepository.ts` — update top-of-file valid entityType comment to include `'encounterParticipant'`. Add `softDeleteLinksForEncounter(encounterId, txId, now)` helper. Ensure existing `deleteLinksForNote` is either renamed to `softDeleteLinksForNote` or wrapped so notes soft-delete cascades through it.

**Dependencies:** Sub-Spec 2.

**Acceptance Criteria:**
- `[STRUCTURAL]` `Encounter` Zod schema has `description: z.any().optional()` (or equivalent ProseMirror JSON type), `body: z.any().optional()`, `summary: z.any().optional()`, `tags: z.array(z.string())`, `location: z.string().optional()`, `segments: z.array(z.object({ startedAt: z.string(), endedAt: z.string().optional() }))`.
- `[STRUCTURAL]` `EncounterParticipant` Zod schema no longer has `linkedCreatureId` or `linkedCharacterId` fields.
- `[MECHANICAL]` `grep -rn "linkedCreatureId\|linkedCharacterId" src/` returns zero matches after this sub-spec.
- `[STRUCTURAL]` `encounterRepository.ts` exports `getActiveEncounterForSession`, `getRecentEndedEncountersForSession`, `pushSegment`, `endActiveSegment`.
- `[BEHAVIORAL]` `getActiveEncounterForSession(sessionId)` returns the non-deleted encounter whose last segment has no `endedAt`, or `null`.
- `[BEHAVIORAL]` `getActiveEncounterForSession` returns `null` for soft-deleted encounters even if they have an open segment.
- `[BEHAVIORAL]` `getRecentEndedEncountersForSession(sessionId, 3)` returns at most 3 encounters sorted by the last segment's `endedAt` descending, excluding soft-deleted.
- `[BEHAVIORAL]` `pushSegment(id, {startedAt})` throws with a descriptive error if the last segment has no `endedAt`.
- `[BEHAVIORAL]` `endActiveSegment(id)` throws with a descriptive error if the last segment already has `endedAt` set.
- `[BEHAVIORAL]` `encounterRepository.softDelete(id)` (from Sub-Spec 1, extended here) cascades to every edge where the encounter is source or target via `softDeleteLinksForEncounter`, sharing the same `softDeletedBy` UUID.
- `[BEHAVIORAL]` `encounterRepository.restore(id)` clears `deletedAt` / `softDeletedBy` on the encounter and on every edge that shares its `softDeletedBy` UUID.
- `[STRUCTURAL]` The top-of-file comment in `entityLinkRepository.ts` includes `'encounterParticipant'` in the valid entityType list.
- `[STRUCTURAL]` `softDeleteLinksForEncounter(encounterId, txId, now)` is exported from `entityLinkRepository.ts`.
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 4 — `useSessionEncounter` Hook and Context
**Scope:** Create the single source of truth for "active encounter in this session" at the session-screen level. Expose lifecycle methods wrapped in Dexie transactions with enforced invariants. Create a React context so child components consume the active encounter without re-instantiating the hook.

**Files:**
- `src/features/session/useSessionEncounter.ts` (new) — exports the hook.
- `src/features/session/SessionEncounterContext.tsx` (new) — exports `SessionEncounterContext` React context and `SessionEncounterProvider` component.

**Dependencies:** Sub-Spec 3.

**Acceptance Criteria:**
- `[STRUCTURAL]` `src/features/session/useSessionEncounter.ts` exports `useSessionEncounter(sessionId: string)` returning `{ activeEncounter, recentEnded, startEncounter, endEncounter, reopenEncounter }`.
- `[STRUCTURAL]` `src/features/session/SessionEncounterContext.tsx` exports a React context whose value is the return type of `useSessionEncounter`, and a provider component that accepts `sessionId` and instantiates the hook exactly once.
- `[BEHAVIORAL]` `startEncounter({ title, type, description?, tags?, location?, parentOverride? })` with no prior active encounter creates a new encounter with `segments: [{ startedAt: now }]`, no `happened_during` edge, in a single Dexie transaction.
- `[BEHAVIORAL]` `startEncounter(...)` with a prior active encounter (re-read at write time inside the transaction) ends the prior's open segment, creates the new encounter, and creates a `happened_during` edge from new → prior (unless `parentOverride` is explicitly `null`), all in a single transaction.
- `[BEHAVIORAL]` `startEncounter({ title: '' })` throws `Error('useSessionEncounter.startEncounter: title is required')`.
- `[BEHAVIORAL]` `startEncounter({ type: 'invalid' })` throws `Error('useSessionEncounter.startEncounter: type must be combat|social|exploration')`.
- `[BEHAVIORAL]` `endEncounter(id, summary?)` sets `endedAt` on the last segment (calling `endActiveSegment`) and writes `summary` via an update if provided.
- `[BEHAVIORAL]` `endEncounter(nonExistentId)` throws with a descriptive error.
- `[BEHAVIORAL]` `reopenEncounter(id)` ends any currently-active encounter's open segment first, then pushes a new segment onto the target encounter, all in a single transaction.
- `[BEHAVIORAL]` `reopenEncounter(nonExistentId)` throws; `reopenEncounter(softDeletedId)` throws.
- `[BEHAVIORAL]` `activeEncounter` is derived at read time by calling `getActiveEncounterForSession(sessionId)`.
- `[BEHAVIORAL]` `recentEnded` is derived by `getRecentEndedEncountersForSession(sessionId, 3)` and is an empty array when no ended encounters exist.
- `[STRUCTURAL]` The hook re-queries `activeEncounter` at write time inside `startEncounter` and `reopenEncounter` (does not rely on the React state snapshot).
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 5 — `useSessionLog` and `useEncounter` Extensions
**Scope:** Wire auto-attach into the shared `logToSession` helper. Add `reassignNote`, `logGenericNote`, `logNpcCapture`. Extend `useEncounter` with narrative update methods, `represents`-edge participant handling, parent/child queries, and remove `quickCreateParticipant`.

**Files:**
- `src/features/session/useSessionLog.ts` — extend `logToSession` to accept `{ targetEncounterId? }` and create a `contains` edge in the same transaction; add `reassignNote`, `logGenericNote`, `logNpcCapture`.
- `src/features/encounters/useEncounter.ts` — update `addParticipantFromTemplate` to use `represents` edge in one transaction; update `removeParticipant` to soft-delete the participant + its edges with shared `softDeletedBy`; add narrative update methods (`updateDescription`, `updateBody`, `updateSummary`, `updateTags`, `updateLocation`); add `getChildEncounters()` and `getParentEncounter()`; remove `quickCreateParticipant`.

**Dependencies:** Sub-Spec 3, Sub-Spec 4.

**Acceptance Criteria:**
- `[STRUCTURAL]` `logToSession(title, type, typeData, options?)` accepts an optional `{ targetEncounterId?: string | null }` parameter.
- `[BEHAVIORAL]` When `options.targetEncounterId` is undefined and the session has an active encounter (re-queried inside the transaction), `logToSession` creates both the note and a `contains` edge (from: active encounter, to: note) in a single Dexie transaction.
- `[BEHAVIORAL]` When `options.targetEncounterId` is `null`, no `contains` edge is created.
- `[BEHAVIORAL]` When `options.targetEncounterId` is a non-null encounter id, the `contains` edge points to that encounter regardless of the active encounter.
- `[BEHAVIORAL]` The entire multi-row write (note + optional edge) is atomic — a simulated failure in the second write rolls back the first.
- `[STRUCTURAL]` `useSessionLog` exports `reassignNote(noteId, newEncounterId | null)`, `logGenericNote(title, body)`, `logNpcCapture(input)`.
- `[BEHAVIORAL]` `reassignNote(noteId, newEncounterId)` soft-deletes the existing encounter→note `contains` edge (if any) and creates a new one in the same transaction.
- `[BEHAVIORAL]` `reassignNote(noteId, null)` soft-deletes the existing edge and creates nothing.
- `[BEHAVIORAL]` `reassignNote` throws if the target encounter's `sessionId` does not match the note's `sessionId`.
- `[BEHAVIORAL]` `reassignNote(nonExistentNoteId, ...)` throws.
- `[BEHAVIORAL]` `reassignNote(noteId, nonExistentEncounterId)` throws.
- `[BEHAVIORAL]` `reassignNote(noteId, currentEncounterId)` is a silent no-op when the note is already attached to that encounter.
- `[BEHAVIORAL]` `logGenericNote('thought', body)` creates a `type: 'generic'` note and auto-attaches via `logToSession`.
- `[BEHAVIORAL]` `logNpcCapture(input)` creates a `CreatureTemplate`, a `type: 'npc'` note whose `typeData` references the creature id, an `introduced_in` edge (from note → session), and a `contains` edge (from active encounter → note) if an encounter is active, all in one Dexie transaction.
- `[STRUCTURAL]` `useEncounter` exports `updateDescription`, `updateBody`, `updateSummary`, `updateTags`, `updateLocation` methods.
- `[BEHAVIORAL]` `addParticipantFromTemplate(template)` appends a participant to `encounter.participants[]` AND creates a `represents` edge from the new participant id → template id in a single transaction.
- `[BEHAVIORAL]` `removeParticipant(participantId)` soft-deletes the participant entry AND its outgoing `represents` edges with a shared `softDeletedBy` UUID in a single transaction.
- `[STRUCTURAL]` `useEncounter` no longer exports `quickCreateParticipant`.
- `[MECHANICAL]` `grep -rn "quickCreateParticipant" src/` returns zero matches at the end of this sub-spec.
- `[STRUCTURAL]` `useEncounter` exports `getChildEncounters()` (queries `getLinksTo(encounterId, 'happened_during')` → resolves encounters) and `getParentEncounter()` (queries `getLinksFrom(encounterId, 'happened_during')` → resolves encounter).
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 6 — UI Primitives: `SessionBar` and `EncounterParticipantPicker`
**Scope:** Create two new UI components that plug into Sub-Spec 7's screen integration.

**Files:**
- `src/features/session/SessionBar.tsx` (new) — consumes `SessionEncounterContext`.
- `src/features/encounters/EncounterParticipantPicker.tsx` (new) — consumes `useEncounter`.

**Dependencies:** Sub-Spec 4, Sub-Spec 5.

**Acceptance Criteria:**
- `[STRUCTURAL]` `src/features/session/SessionBar.tsx` exists and exports `SessionBar`.
- `[STRUCTURAL]` `SessionBar` consumes the active encounter from `SessionEncounterContext` (not via its own `useSessionEncounter` instantiation).
- `[STRUCTURAL]` `SessionBar` renders the active encounter's title and current duration (computed from the open segment's `startedAt`).
- `[STRUCTURAL]` `SessionBar` renders up to 3 "Recently ended" chips drawn from `recentEnded`.
- `[BEHAVIORAL]` When `recentEnded` is empty, the Recently ended row is hidden entirely (no placeholder text, no wrapper element taking visual space).
- `[BEHAVIORAL]` Clicking a Recently ended chip calls `reopenEncounter(id)` from the context.
- `[STRUCTURAL]` `SessionBar` styling uses Tailwind utilities and (where interactive) Radix primitives — no inline styles, no CSS modules.
- `[STRUCTURAL]` `src/features/encounters/EncounterParticipantPicker.tsx` exists and exports `EncounterParticipantPicker`.
- `[STRUCTURAL]` `EncounterParticipantPicker` has a search input that filters `CreatureTemplate` by name via `creatureTemplateRepository` (respecting soft-delete filtering).
- `[STRUCTURAL]` The picker shows a "+ Create new '{query}'" row at the bottom of the results when the query is non-empty.
- `[BEHAVIORAL]` Selecting an existing creature row calls `addParticipantFromTemplate(template)`, which creates both the participant and the `represents` edge.
- `[BEHAVIORAL]` Clicking "+ Create new" opens an inline mini form with fields: name (required), category (monster | npc | animal), HP (number), short description (text), tags (optional).
- `[BEHAVIORAL]` Submitting the mini form creates a `CreatureTemplate` via `creatureTemplateRepository.create`, then calls `addParticipantFromTemplate(newTemplate)` — all in a single Dexie transaction.
- `[BEHAVIORAL]` The picker does not offer a "quick create without bestiary entry" path (there is no `quickCreateParticipant`).
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 7 — SessionScreen + EncounterScreen Integration
**Scope:** Remove the old Start Combat path from `SessionScreen`. Wrap session children in `SessionEncounterProvider`. Mount `SessionBar`. Update the Start Encounter modal with new fields. Restructure `EncounterScreen` with Narrative / Participants / Attached log / Relations sections. Wire `TiptapNoteEditor` for narrative. Wire `EncounterParticipantPicker`. Wire toast for auto-end-previous.

**Files:**
- `src/screens/SessionScreen.tsx`
- `src/features/encounters/EncounterScreen.tsx`
- `src/features/combat/CombatTimeline.tsx` — may be deleted if no other code references it (Sub-Spec 9 verifies); otherwise leave it in place but ensure no import from SessionScreen reaches it.

**Dependencies:** Sub-Spec 6.

**Acceptance Criteria:**
- `[MECHANICAL]` `grep -n "CombatTimeline" src/screens/SessionScreen.tsx` returns zero matches.
- `[MECHANICAL]` `grep -rn "Start Combat" src/` returns zero matches (UI button label removed).
- `[STRUCTURAL]` `SessionScreen.tsx` imports `SessionEncounterProvider` and wraps its children in it, passing the active `sessionId`.
- `[STRUCTURAL]` `SessionScreen.tsx` renders `SessionBar` at the top of the session view.
- `[STRUCTURAL]` `SessionScreen.tsx` has exactly one "Start Encounter" button.
- `[STRUCTURAL]` The Start Encounter modal has fields: `title` (required text), `type` (required radio/select: combat | social | exploration), `description` (optional, renders `TiptapNoteEditor`), `tags` (optional, comma-separated or chip input), `location` (optional text), and a "Started during:" override select that defaults to the current active encounter and is clearable.
- `[BEHAVIORAL]` Submitting the modal with empty title or invalid type shows an inline form error and does not create the encounter.
- `[BEHAVIORAL]` Submitting a valid form calls `useSessionEncounter.startEncounter(input)` where `input` includes the narrative fields, tags, location, and the resolved parent override.
- `[STRUCTURAL]` `EncounterScreen.tsx` renders four sections: **Narrative**, **Participants**, **Attached log**, **Relations**.
- `[STRUCTURAL]` The Narrative section renders three `TiptapNoteEditor` instances bound to `description`, `body`, and `summary` fields, each wired to the corresponding `useEncounter` update method.
- `[STRUCTURAL]` The Participants section renders `EncounterParticipantPicker` (or a button that opens it) for adding participants.
- `[STRUCTURAL]` For `type: 'combat'`, `CombatEncounterView` (from `src/features/encounters/CombatEncounterView.tsx`) is rendered inside the Participants section or alongside it — driven by `encounter.combatData`.
- `[STRUCTURAL]` The Attached log section queries `getLinksFrom(encounterId, 'contains')` and lists the resolved notes in reverse-chronological order by `createdAt`.
- `[STRUCTURAL]` Each attached-log row exposes a "Move to…" action that opens a picker and calls `useSessionLog.reassignNote`.
- `[STRUCTURAL]` The Relations section shows a "Started during: {parent title}" chip when `getParentEncounter()` returns a value, and "Sub-encounters: {count}" with individual chips when `getChildEncounters()` returns a non-empty list.
- `[STRUCTURAL]` The "End Encounter" button opens a Radix dialog containing an optional summary rich-text input. Submitting calls `endEncounter(id, summary?)`. Dismissing the dialog (close button, Escape, backdrop click) leaves the encounter active (no silent end).
- `[BEHAVIORAL]` When `startEncounter` auto-ends a prior active encounter, a Radix toast appears: `"{prior title} ended, {new title} started"` for ~3 seconds, dismissable.
- `[INTEGRATION]` End-to-end: open a session → click Start Encounter → enter title "Tavern", type "social" → submit → session bar shows Tavern as active → click Start Encounter again → enter "Bar Fight", type "combat" → submit → Tavern is auto-ended (toast appears), Bar Fight is active, `happened_during` edge exists (verifiable via `getLinksFrom(barFight.id, 'happened_during')` returning the Tavern id).
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 8 — Quick Log Palette: New Actions + Attach-To Control
**Scope:** Add `Note` and `NPC / Monster` actions to the Quick Log palette. Add a per-entry `"Attach to: [active ▾]"` control to every existing Quick Log action form. Wire success toasts.

**Files:**
- `src/features/session/SessionQuickActions.tsx`
- `src/features/session/SessionLogOverlay.tsx`
- Any related form / drawer files in `src/features/session/` that render individual Quick Log actions (skill check, loot, quote, rumor, shopping, HP change, rest, death roll, coin change).

**Dependencies:** Sub-Spec 5, Sub-Spec 6.

**Acceptance Criteria:**
- `[STRUCTURAL]` The Quick Log palette in `SessionQuickActions.tsx` has actions for: Skill check, Loot, Quote, Rumor, Shopping, HP change, Rest, Death roll, Coin change, **Note** (new), and **NPC / Monster** (new).
- `[STRUCTURAL]` The **Note** action opens a mini drawer containing an optional title input and a `TiptapNoteEditor` bound to body. Submitting calls `useSessionLog.logGenericNote(title, body)`.
- `[STRUCTURAL]` The **NPC / Monster** action opens a mini form with fields: name (required), category (monster | npc | animal), HP (number, optional), short description (text, optional), tags (optional). Submitting calls `useSessionLog.logNpcCapture(input)`.
- `[STRUCTURAL]` Every existing Quick Log action form has an `"Attach to:"` select at the bottom whose options are: the currently-active encounter (labelled with its title), every other non-deleted encounter in this session, and `"Session only (no encounter)"`.
- `[BEHAVIORAL]` The "Attach to" select resets to the currently-active encounter every time the form is opened (per-entry reset — values are not persisted between openings).
- `[BEHAVIORAL]` Selecting a specific encounter passes its id as `targetEncounterId` to `logToSession`.
- `[BEHAVIORAL]` Selecting "Session only" passes `targetEncounterId: null` to `logToSession`.
- `[BEHAVIORAL]` On successful Quick Log write while attached to an encounter, a Radix toast appears: `"Logged to {encounter title}"` for ~2 seconds.
- `[BEHAVIORAL]` On successful Quick Log write without an encounter, a Radix toast appears: `"Logged to session"` for ~2 seconds.
- `[BEHAVIORAL]` On failure (simulated transaction rollback), the form shows an inline error and preserves the draft; no toast appears.
- `[INTEGRATION]` End-to-end: session active, Tavern encounter active → open the Skill Check form → the "Attach to" control shows Tavern as default → submit → toast "Logged to Tavern" appears → EncounterScreen's Attached log section shows the new skill-check entry → open a new Quick Log form → "Attach to" defaults back to Tavern (not sticky to a prior override).
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.

---

### Sub-Spec 9 — Verification, Cleanup, and End-to-End Smoke
**Scope:** Run grep audits, delete dead code if reachable via no runtime path, verify build+lint green, perform a manual smoke test against the seeded app.

**Files:** no new files. May delete `src/features/combat/CombatTimeline.tsx` if verified unused.

**Dependencies:** Sub-Spec 1, 2, 3, 4, 5, 6, 7, 8 (all prior sub-specs).

**Acceptance Criteria:**
- `[MECHANICAL]` `npm run build` (tsc -b && vite build) exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.
- `[MECHANICAL]` `grep -rn "quickCreateParticipant" src/` returns zero matches.
- `[MECHANICAL]` `grep -rn "linkedCreatureId\|linkedCharacterId" src/` returns zero matches.
- `[MECHANICAL]` `grep -rn "Start Combat" src/` returns zero matches.
- `[MECHANICAL]` `grep -rn "CombatTimeline" src/screens/` returns zero matches.
- `[MECHANICAL]` `grep -rn "CombatTimeline" src/features/session/` returns zero matches.
- `[MECHANICAL]` `grep -rn "from '../combat/CombatTimeline'\|from '\.\./features/combat/CombatTimeline'\|from '\.\./\.\./features/combat/CombatTimeline'" src/` returns zero matches.
- `[BEHAVIORAL]` If `CombatTimeline.tsx` has no remaining imports anywhere in `src/`, the file is deleted. If it still has imports from unrelated code, it is left in place and the remaining import is documented in a note to the reviewer.
- `[HUMAN REVIEW]` Manual smoke test: open the dev app, navigate to `/session`, start a session if needed, then:
  1. Click **Start Encounter** → enter "Tavern", type "social" → submit. Confirm session bar shows Tavern as active.
  2. Open **Quick Log → Skill Check** → confirm "Attach to" defaults to Tavern → submit. Confirm toast "Logged to Tavern" appears.
  3. Navigate to the Tavern encounter → confirm the skill check appears in the Attached log section.
  4. Back on SessionScreen, click **Start Encounter** → enter "Bar Fight", type "combat" → submit. Confirm toast "Tavern ended, Bar Fight started" appears. Confirm Tavern appears in Recently Ended chips.
  5. Open **Quick Log → NPC / Monster** → fill in "Drunk Patron" → submit. Confirm toast "Logged to Bar Fight". Confirm the bestiary now has a "Drunk Patron" entry.
  6. In Bar Fight, add a participant via the picker → type "Bandit" → click "+ Create new 'Bandit'" → fill in minimal fields → submit. Confirm participant is added AND a new "Bandit" bestiary entry exists.
  7. Click **End Encounter** → add a short summary → submit. Confirm Bar Fight is ended.
  8. Click the **Reopen: Tavern** chip → confirm Tavern is active again with a new segment.
  9. Open **Quick Log → Note** (generic) → type a quick thought → submit. Confirm toast "Logged to Tavern".
  10. End Tavern with a summary.
- `[INTEGRATION]` The full flow in the Human Review item above completes without any console errors and every auto-attach creates the expected `contains` edge (verifiable by opening Dev Tools → IndexedDB → `entityLinks` and filtering by `relationshipType: contains`).

---

## Edge Cases

The design doc's Error Handling section enumerates the five load-bearing edges in detail. For this spec, the sub-specs must observe these explicit handling rules:

1. **Encounter deletion cascade:** soft-deleting an encounter cascades to its edges (not its notes). Sub-Spec 3 owns the implementation. Notes become "free" (unattached) on cascade and are restored when the encounter is restored.
2. **Partial write failure:** every multi-row write is wrapped in `db.transaction('rw', [...], async () => {...})`. Sub-Specs 4, 5, 6, 7, 8 all depend on this invariant — no exceptions.
3. **Stale active encounter (multi-tab or stale UI render):** Sub-Spec 4's `startEncounter` and Sub-Spec 5's `logToSession` re-query the active encounter at write time inside the transaction. This is the authoritative correctness guarantee. Dexie change hooks for reactive UI freshness are OPTIONAL polish — not a Phase 1 gate.
4. **Recently ended staleness / reopen of non-existent encounter:** `reopenEncounter` re-reads the target at write time. If the target has been deleted, throws; the caller's error boundary shows a toast and refreshes the session bar.
5. **End encounter modal dismissed:** the end operation only fires on explicit submit. Dismissing the dialog (close button, Escape, backdrop click) leaves the encounter active. Sub-Spec 7 enforces this.

**Abstract noun disambiguation:**
- `"handles invalid input"` → **strict** in the hook layer (throw with descriptive error messages). Form layer catches the error and shows inline form validation; no silent normalization.
- `"error handling"` → every repository method wraps its body in try/catch with `throw new Error('repoName.methodName failed: ' + e)`. Every hook method catches expected errors and re-throws with its own namespacing. UI components are the final catch point and show user-facing messaging.
- `"attach to encounter"` → the `contains` edge is the single ground truth. Notes never carry an encounter id as a column. "Currently attached" is determined by `getLinksTo(noteId, 'contains').filter(fromType === 'encounter')`.

## Out of Scope

- **User-facing restore UI (trash view, restore buttons).** Phase 1 ships the soft-delete foundation only. A future Phase 2 will add the UI.
- **`SessionTimelineStrip` (Gantt view) on the session page.** Planned Phase 2. The data model (segments, timestamps, edges, `reassignNote`) is complete so Phase 2 can build on top.
- **Nested encounter tree semantics.** `happened_during` is a loose parent reference today — Phase 1 does not enforce tree invariants (e.g., "cannot end parent before child"). Future work may tighten semantics.
- **Export / import handling of soft-deleted rows.** Exports should skip deleted rows (already documented in `CLAUDE.md`), but retrofitting the merge engine is deferred.
- **Migrating `Note.sessionId` and other identity FKs to `entityLinks`.** Identity FKs stay as columns per the rule in `CLAUDE.md`. Only cross-entity relationships migrate.
- **Dev-mode invariant assertions.** Optional polish per the design doc; not required for Phase 1.
- **Writing automated tests.** The repo has no test framework installed. This spec uses `npm run build` + `npm run lint` + manual smoke testing as the verification signal. Adding a test framework is out of scope and would require an explicit decision (see Escalation Triggers below).
- **Refactoring bestiary page behavior.** `/bestiary` is unchanged except that its read path must respect soft-delete filtering (already covered by Sub-Spec 1's repo changes).
- **Changes to `Note.typeData` schema for any type other than those needed for the new Quick Log actions.**

## Constraints

### Musts
- MUST wrap every multi-row write in a single Dexie `transaction('rw', [...tables], async () => {...})` block.
- MUST route every repository read through `excludeDeleted` (or an inline `deletedAt` filter) unless `{ includeDeleted: true }` is explicitly passed.
- MUST preserve the existing `entityLinkRepository` primitive signatures (`createLink`, `getLinksFrom`, `getLinksTo`, `getAllLinksFrom`, `getAllLinksTo`, `deleteLinksForNote`) — they can be wrapped, not broken.
- MUST reuse `src/components/notes/TiptapNoteEditor.tsx` for every new rich-text input (encounter narrative fields, Quick Log Note action). No parallel Tiptap setup.
- MUST update `CLAUDE.md`'s relationship-type table when a new `relationshipType` is introduced. Sub-Specs 3 and 5 introduce `happened_during` and `represents` — these are already in the table (added during the brainstorm phase), but any further additions during implementation must also be documented.
- MUST keep every literal array of user-facing groupings / presets / categories in configuration rather than in components (per the "Configuration Over Hardcoding" rule in `CLAUDE.md`).
- MUST run `npm run build` and `npm run lint` successfully at the end of every sub-spec.

### Must-Nots
- MUST NOT add a `Note.encounterId` column. Encounter membership lives in the `contains` edge and nothing else.
- MUST NOT add a `Session.activeEncounterId` column. Active encounter is derived.
- MUST NOT call `hardDelete` from UI code. User-facing delete paths always call `softDelete`.
- MUST NOT instantiate `useSessionEncounter` from more than one component per session screen. The hook runs once at the `SessionScreen` level and is propagated via context.
- MUST NOT leave runtime-reachable imports of the old `CombatTimeline` component from session or encounter code.
- MUST NOT mutate Note rows to change which encounter they belong to. Reassignment only touches edges.
- MUST NOT delete the Note when its parent encounter is deleted. The encounter's `contains` edges are cascaded, but the notes themselves survive (free, recoverable via encounter restore).

### Preferences (soft guidelines — apply when valid approaches conflict)
- **Prefer existing Skaldbok patterns over novel design.** Repository function style, Zod schemas, try/catch wrapping, Radix primitives, Tailwind utilities.
- **Prefer single-transaction atomicity over convenience.** Even if it means restructuring a helper.
- **Prefer derivation over storage** for "active encounter" and similar fields that can be computed from source-of-truth data.
- **Prefer soft-delete cascade via shared `softDeletedBy` UUID** over per-row tracking fields.
- **Prefer inline "Create new…" flows** over navigation-away flows for in-session authoring (consistent with the NPC picker's design).
- **Prefer re-query-at-write-time** over reactive subscriptions for correctness-critical paths.
- **Prefer small focused sub-spec commits** over large all-or-nothing commits. Each sub-spec should ideally land as its own commit (or logical group) so bisecting later works.

### Escalation Triggers (stop and ask, don't decide)
- A schema change is needed beyond those enumerated in the sub-specs.
- A new npm dependency is required (including installing a test framework — explicitly out of scope).
- An existing `entityLinkRepository` primitive signature must change to accommodate a new use case.
- `quickCreateParticipant` removal uncovers a caller outside `src/features/encounters/`.
- The Dexie v8 upgrade function grows beyond ~80 lines or requires a second version bump.
- Any Tiptap / ProseMirror configuration change is required.
- Any sub-spec's acceptance criteria would require violating a Must / Must-Not.
- Any behavior not documented in the design doc AND not covered by the sub-spec's acceptance criteria requires a judgment call that affects user-visible behavior.

## Verification

The Verification pipeline runs in order from Sub-Spec 1 through Sub-Spec 9. Each sub-spec owns its own `[MECHANICAL]`, `[STRUCTURAL]`, `[BEHAVIORAL]`, and (where applicable) `[INTEGRATION]` and `[HUMAN REVIEW]` criteria listed above. Sub-Spec 9 runs the final end-to-end smoke test covering the entire unified flow.

**Top-level verification (after all sub-specs):**
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npm run lint` exits zero.
- `[MECHANICAL]` All grep audits in Sub-Spec 9 return zero matches.
- `[BEHAVIORAL]` The dev app (`npm run dev`) opens a session view without console errors against a freshly-seeded database migrated to v8.
- `[INTEGRATION]` Running the manual smoke test in Sub-Spec 9 produces the expected sequence of encounter states, note attachments, bestiary entries, and toast notifications. No console errors. IndexedDB edges (`contains`, `happened_during`, `represents`, `introduced_in`) match expectations.
- `[HUMAN REVIEW]` The three original user complaints are demonstrably resolved:
  1. "Start Combat" and "Start Encounter" no longer conflict — there's only one button.
  2. The encounter view has narrative fields (description, body, summary) in a dedicated Narrative section.
  3. NPCs can be captured from the Quick Log palette (NPC/Monster action) and from the encounter participant picker (inline "Create new") without leaving the session page.

## Phase Specs

Refined by `/forge-prep` on 2026-04-10.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. Soft-Delete Foundation | `docs/specs/encounter-notes-folder-unification/sub-spec-1-soft-delete-foundation.md` |
| 2. Dexie v8 Schema Migration | `docs/specs/encounter-notes-folder-unification/sub-spec-2-dexie-v8-migration.md` |
| 3. Encounter + EntityLink Data Layer Extensions | `docs/specs/encounter-notes-folder-unification/sub-spec-3-encounter-entitylink-extensions.md` |
| 4. `useSessionEncounter` Hook + Context | `docs/specs/encounter-notes-folder-unification/sub-spec-4-use-session-encounter-hook.md` |
| 5. `useSessionLog` + `useEncounter` Extensions | `docs/specs/encounter-notes-folder-unification/sub-spec-5-session-log-encounter-extensions.md` |
| 6. UI Primitives: `SessionBar` + `EncounterParticipantPicker` | `docs/specs/encounter-notes-folder-unification/sub-spec-6-ui-primitives-sessionbar-picker.md` |
| 7. `SessionScreen` + `EncounterScreen` Integration | `docs/specs/encounter-notes-folder-unification/sub-spec-7-session-encounter-screens.md` |
| 8. Quick Log Palette: New Actions + Attach-To Control | `docs/specs/encounter-notes-folder-unification/sub-spec-8-quick-log-palette.md` |
| 9. Verification, Cleanup, and End-to-End Smoke | `docs/specs/encounter-notes-folder-unification/sub-spec-9-verification-cleanup.md` |

Index: `docs/specs/encounter-notes-folder-unification/index.md`

## Notes for the Executing Agent

- **Read `CLAUDE.md` first.** It documents the entity-linking pattern, soft-delete convention, and configuration-over-hardcoding rule. All sub-specs conform to it.
- **Read the design doc for context.** `docs/plans/2026-04-10-encounter-notes-folder-unification-design.md` has the Commander's Intent, Execution Guidance (including all codebase anchors), Acceptance Criteria per component (supplementing this spec's), Decision Authority map, and War-Game results. When a sub-spec's acceptance criteria are ambiguous, the design doc resolves them.
- **The repo has no test framework.** Verification is `npm run build` + `npm run lint` + manual smoke. Do not install vitest, jest, or playwright — that requires an Escalation Trigger resolution.
- **Sub-specs are ordered by dependency.** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Do not reorder.
- **Every transaction touches a specific list of tables.** Be explicit in `db.transaction('rw', [db.encounters, db.entityLinks, db.notes], ...)` — do not transact over the whole database.
- **Preserve existing repository error-message format:** `throw new Error('repoName.methodName failed: ' + e)`. Match it exactly.
- **Preserve existing Zod `safeParse` + `console.warn + filter undefined` pattern** for every new read method. Copy from `entityLinkRepository.ts` as the reference.
