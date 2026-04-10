---
type: phase-spec-index
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
date: 2026-04-10
sub_specs: 9
---

# Encounter as Notes-Folder — Phase Specs

Refined from [`2026-04-10-encounter-notes-folder-unification.md`](../2026-04-10-encounter-notes-folder-unification.md).

**Verification signal:** `npm run build` (tsc -b && vite build) + `npm run lint` + manual smoke. The repo has no test framework; adding one is out of scope.

**Adapted TDD pattern:** because there's no test runner, each step follows this loop:
1. Write the type signature / interface / skeleton first.
2. Write minimal implementation.
3. Run `npm run build` — must exit zero.
4. Run `npm run lint` — must exit zero.
5. Optionally, write a throwaway verification script in `scripts/` (or exercise via dev app) to confirm behavior.
6. Commit.

## Phase Specs

| Sub-Spec | Title | Dependencies | Phase Spec |
|----------|-------|--------------|------------|
| 1 | Soft-Delete Foundation | none | [sub-spec-1-soft-delete-foundation.md](sub-spec-1-soft-delete-foundation.md) |
| 2 | Dexie v8 Schema Migration | 1 | [sub-spec-2-dexie-v8-migration.md](sub-spec-2-dexie-v8-migration.md) |
| 3 | Encounter + EntityLink Data Layer Extensions | 2 | [sub-spec-3-encounter-entitylink-extensions.md](sub-spec-3-encounter-entitylink-extensions.md) |
| 4 | `useSessionEncounter` Hook + Context | 3 | [sub-spec-4-use-session-encounter-hook.md](sub-spec-4-use-session-encounter-hook.md) |
| 5 | `useSessionLog` + `useEncounter` Extensions | 3, 4 | [sub-spec-5-session-log-encounter-extensions.md](sub-spec-5-session-log-encounter-extensions.md) |
| 6 | UI Primitives: `SessionBar` + `EncounterParticipantPicker` | 4, 5 | [sub-spec-6-ui-primitives-sessionbar-picker.md](sub-spec-6-ui-primitives-sessionbar-picker.md) |
| 7 | `SessionScreen` + `EncounterScreen` Integration | 6 | [sub-spec-7-session-encounter-screens.md](sub-spec-7-session-encounter-screens.md) |
| 8 | Quick Log Palette: New Actions + Attach-To Control | 5, 6 | [sub-spec-8-quick-log-palette.md](sub-spec-8-quick-log-palette.md) |
| 9 | Verification, Cleanup, and End-to-End Smoke | 1–8 | [sub-spec-9-verification-cleanup.md](sub-spec-9-verification-cleanup.md) |

## Wave Ordering

Dependency-ordered waves (sub-specs within a wave are parallelizable):

- **Wave 1:** Sub-Spec 1 (Soft-Delete Foundation)
- **Wave 2:** Sub-Spec 2 (Dexie v8 Migration)
- **Wave 3:** Sub-Spec 3 (Encounter + EntityLink Data Layer)
- **Wave 4:** Sub-Spec 4 (useSessionEncounter)
- **Wave 5:** Sub-Spec 5 (useSessionLog + useEncounter Extensions)
- **Wave 6:** Sub-Spec 6 (UI Primitives)
- **Wave 7:** Sub-Spec 7 (Screens) + Sub-Spec 8 (Quick Log) — parallel
- **Wave 8:** Sub-Spec 9 (Verification + Cleanup)

## Requirement Traceability Matrix

Every numbered requirement from the master spec's `## Requirements` section, mapped to the sub-spec(s) that cover it.

| Requirement | Summary | Covered By |
|-------------|---------|------------|
| R1 | Combat unified under encounter; no Start Combat button; CombatTimeline unimported | Sub-Spec 7, Sub-Spec 9 |
| R2 | Encounter narrative fields + segments array | Sub-Spec 3 |
| R3 | One active encounter per session, derived from segments | Sub-Spec 3, Sub-Spec 4 |
| R4 | `happened_during` edge auto-created on start-while-active | Sub-Spec 4 |
| R5 | Reopen via Recently ended chip; pushes new segment | Sub-Spec 4, Sub-Spec 6 |
| R6 | `logToSession` creates `contains` edge in same transaction | Sub-Spec 5 |
| R7 | `reassignNote` with same-session invariant | Sub-Spec 5 |
| R8 | New Quick Log actions: Note + NPC/Monster | Sub-Spec 5, Sub-Spec 8 |
| R9 | Per-entry "Attach to" control with reset behavior | Sub-Spec 8 |
| R10 | `EncounterParticipant` FK columns removed → `represents` edges | Sub-Spec 3, Sub-Spec 5 |
| R11 | `quickCreateParticipant` removed; picker is single path | Sub-Spec 5, Sub-Spec 6, Sub-Spec 9 |
| R12 | Soft delete columns on every domain table | Sub-Spec 1 |
| R13 | Repo reads route through `excludeDeleted` | Sub-Spec 1 |
| R14 | `softDelete` / `restore` / `hardDelete` on every repo, idempotent | Sub-Spec 1 |
| R15 | Encounter soft-delete cascades via shared `softDeletedBy` UUID | Sub-Spec 3 |
| R16 | Dexie v8 migration with pre-migration backup | Sub-Spec 2 |
| R17 | `SessionScreen` wraps in `SessionEncounterProvider`, single hook instance | Sub-Spec 7 |
| R18 | `SessionBar` with active chip + up to 3 reopen chips, hidden when empty | Sub-Spec 6, Sub-Spec 7 |
| R19 | `EncounterScreen` four sections: Narrative, Participants, Attached log, Relations | Sub-Spec 7 |
| R20 | Success toasts for Quick Log and auto-end-previous | Sub-Spec 7, Sub-Spec 8 |
| R21 | `npm run build` + `npm run lint` green at end of every sub-spec | Every sub-spec (check command) |

No orphaned requirements. R3, R5, R10, R11, R18, and R20 are split across sub-specs — this is expected because they describe end-to-end behaviors whose implementation spans a data-layer sub-spec and a UI-layer sub-spec. The master spec's sub-spec definitions make ownership explicit within each.

## Cross-Spec Dependency Audit

Produce / consume inventory:

**Sub-Spec 1 produces:** `excludeDeleted` helper, `softDelete`/`restore`/`hardDelete` on every repo, `deletedAt`/`softDeletedBy` Zod fields.
**Sub-Spec 2 produces:** Dexie version 8, pre-migration backup write.
**Sub-Spec 3 produces:** `Encounter` narrative + segments shape, new encounter repo methods, `softDeleteLinksForEncounter`, `'encounterParticipant'` entityType.
**Sub-Spec 4 produces:** `useSessionEncounter(sessionId)` hook, `SessionEncounterContext`.
**Sub-Spec 5 produces:** extended `logToSession(targetEncounterId?)`, `reassignNote`, `logGenericNote`, `logNpcCapture`, extended `useEncounter` with narrative/represents/parent-child methods, removal of `quickCreateParticipant`.
**Sub-Spec 6 produces:** `SessionBar`, `EncounterParticipantPicker` components.
**Sub-Spec 7 consumes:** `SessionBar`, `SessionEncounterProvider`, `EncounterParticipantPicker`, extended `useEncounter`, `TiptapNoteEditor` (existing).
**Sub-Spec 8 consumes:** extended `useSessionLog`, `useSessionEncounter` via context.
**Sub-Spec 9 consumes:** everything; verification only.

**No wave-order violations detected.** Every consumer is in an equal or later wave than every producer it depends on.

## Execution

Run `/forge-run docs/specs/encounter-notes-folder-unification/` to execute all phase specs in dependency order.
Run `/forge-run docs/specs/encounter-notes-folder-unification/ --sub N` to execute a single sub-spec.
