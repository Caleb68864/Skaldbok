---
type: phase-spec-index
master_spec: "docs/specs/2026-04-16-game-night-reliability-fixes.md"
date: 2026-04-16
sub_specs: 11
---

# Game-Night Reliability Fixes — Phase Specs

Refined from [2026-04-16-game-night-reliability-fixes.md](../2026-04-16-game-night-reliability-fixes.md).

## Sub-Spec Index

| Sub-Spec | Title | Phase | Dependencies | Integration? | Phase Spec |
|----------|-------|-------|--------------|--------------|------------|
| 1 | autosaveFlush registry module | 1 | — | | [sub-spec-1-autosave-flush-registry.md](sub-spec-1-autosave-flush-registry.md) |
| 2 | useAutosave bus registration | 1 | 1 | | [sub-spec-2-useautosave-bus-registration.md](sub-spec-2-useautosave-bus-registration.md) |
| 3 | NoteEditor pendingUpdatesRef + bus | 1 | 1 | | [sub-spec-3-note-editor-pending-ref.md](sub-spec-3-note-editor-pending-ref.md) |
| 4 | Atomic reopenEncounter helper | 1 | — | | [sub-spec-4-atomic-reopen-encounter.md](sub-spec-4-atomic-reopen-encounter.md) |
| 5 | softDeleteLinksForCreature helper | 1 | — | | [sub-spec-5-soft-delete-links-for-creature.md](sub-spec-5-soft-delete-links-for-creature.md) |
| 6 | Flush-bus consumer wiring + combat flush | 1 | 1, 2, 3 | ✅ | [sub-spec-6-flush-bus-consumers.md](sub-spec-6-flush-bus-consumers.md) |
| 7 | Stale-session route-change re-check | 2 | — | | [sub-spec-7-stale-session-route-check.md](sub-spec-7-stale-session-route-check.md) |
| 8 | Resume prompt + Undo toast | 2 | 4 | ✅ | [sub-spec-8-resume-prompt-and-undo.md](sub-spec-8-resume-prompt-and-undo.md) |
| 9 | Dexie v9 migration with snapshot | 3 | — | | [sub-spec-9-dexie-v9-migration.md](sub-spec-9-dexie-v9-migration.md) |
| 10 | Bestiary soft-delete + archive removal + UI rename | 3 | 5, 9 | | [sub-spec-10-bestiary-soft-delete.md](sub-spec-10-bestiary-soft-delete.md) |
| 11 | TrashScreen + route + read-path audit | 3 | 10 | ✅ | [sub-spec-11-trash-screen.md](sub-spec-11-trash-screen.md) |

## Requirement Traceability Matrix

Maps every numbered requirement in the master spec's `## Requirements` section to the sub-spec(s) whose acceptance criteria cover it.

| Requirement | Summary | Covered By |
|-------------|---------|------------|
| R1 | autosaveFlush registry exists with registerFlush / flushAll | SS-1 |
| R2 | useAutosave registers with bus, unregisters on cleanup, empty dep array | SS-2 |
| R3 | NoteEditor uses pendingUpdatesRef + bus-registered flush + unmount flush | SS-3 |
| R4 | CombatEncounterView registers in-flight participant update | SS-6 |
| R5 | Four lifecycle operations await flushAll before mutating | SS-6 |
| R6 | encounterRepository.reopenEncounter exists as atomic rw-transaction | SS-4 |
| R7 | useSessionEncounter.reopenEncounter delegates to repository helper | SS-4 |
| R8 | entityLinkRepository.softDeleteLinksForCreature exists | SS-5 |
| R9 | creatureTemplateRepository.softDelete cascades + archive() removed | SS-10 |
| R10 | CampaignContext staleness check runs on route change with dismissed ref | SS-7 |
| R11 | resumeSession flushes + prompts + offers Undo | SS-8 |
| R12 | Dexie v9 migration with snapshot, tx.table only, idempotent | SS-9 |
| R13 | BestiaryScreen action labeled "Delete" + "View Trash" link | SS-10 |
| R14 | TrashScreen at /bestiary/trash via object-form route | SS-11 |
| R15 | Every creatureTemplates read uses excludeDeleted | SS-11 (audit step) |
| R16 | npm run build passes after each phase; Playwright smoke passes after each phase | SS-6 + SS-11 (phase integration checks) |

All 16 requirements are covered — no orphans.

## Cross-Spec Dependency Audit

### Produces / Consumes Map

| Sub-Spec | Produces | Consumes |
|----------|----------|----------|
| SS-1 | `registerFlush(fn)`, `flushAll()` | — |
| SS-2 | — | `registerFlush` |
| SS-3 | — | `registerFlush` |
| SS-4 | `encounterRepository.reopenEncounter(sessionId, targetId)` | existing: `endActiveSegment`, `pushSegment`, `getActiveEncounterForSession` |
| SS-5 | `entityLinkRepository.softDeleteLinksForCreature(id, txId, now)` | — |
| SS-6 | — | `registerFlush`, `flushAll` |
| SS-7 | — | `useLocation` (existing) |
| SS-8 | `ReopenEncounterPrompt` component | `encounterRepository.reopenEncounter` (SS-4), `flushAll` (SS-1), `encounterRepository.end` (existing) |
| SS-9 | migrated DB at version 9 | — |
| SS-10 | `creatureTemplateRepository.getDeleted()`, cascade-aware `softDelete` + `restore` | `softDeleteLinksForCreature` (SS-5), migrated data (SS-9) |
| SS-11 | — | `creatureTemplateRepository.getDeleted`, `creatureTemplateRepository.restore` (SS-10) |

### Wave Ordering

**Wave 1 (independent):** SS-1, SS-4, SS-5, SS-7, SS-9
**Wave 2 (depends on Wave 1):** SS-2 (← SS-1), SS-3 (← SS-1), SS-8 (← SS-4), SS-10 (← SS-5, SS-9)
**Wave 3 (integration + tail):** SS-6 (← SS-1, SS-2, SS-3), SS-11 (← SS-10)

**Violation check:** every producer is in an earlier or same wave as its consumers. No violations.

**Phase boundaries (master-spec constraint):**
- Phase 1 must ship before Phase 2. Phase 1 includes SS-1 through SS-6.
- Phase 2 includes SS-7 + SS-8. Phase 2 depends on Phase 1 (SS-8 needs SS-4).
- Phase 3 includes SS-9, SS-10, SS-11. Phase 3 depends on Phase 1 (SS-10 needs SS-5).

Within a phase, sub-specs can run in dependency-respecting waves. Across phases: do NOT parallelize — ship Phase 1, then Phase 2, then Phase 3.

## Execution

```bash
# Dry-run the full suite:
/forge-run docs/specs/game-night-reliability-fixes/

# Execute one sub-spec in isolation:
/forge-run docs/specs/game-night-reliability-fixes/ --sub 4

# Execute by phase (suggested):
/forge-run docs/specs/game-night-reliability-fixes/ --sub 1,2,3,4,5,6    # Phase 1
# then commit + verify smoke, then:
/forge-run docs/specs/game-night-reliability-fixes/ --sub 7,8             # Phase 2
# then:
/forge-run docs/specs/game-night-reliability-fixes/ --sub 9,10,11         # Phase 3
```
