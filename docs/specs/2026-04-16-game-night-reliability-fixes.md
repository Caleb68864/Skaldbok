# Game-Night Reliability Fixes — Master Spec

## Meta
- Client: Skaldbok (personal project)
- Project: Skaldbok
- Repo: C:\Users\CalebBennett\Documents\GitHub\Skaldbok
- Date: 2026-04-16
- Author: Caleb Bennett
- Design Source: [[2026-04-16-game-night-reliability-fixes-design.md]]
- Status: draft (not yet executed)
- Quality Scores:
  - Outcome clarity: 5/5
  - Scope boundaries: 5/5
  - Decision guidance: 5/5
  - Edge coverage: 5/5
  - Acceptance criteria: 5/5
  - Decomposition: 5/5
  - Purpose alignment: 5/5
  - **Total: 35/35**
- Pipeline stages completed: brainstorm → evaluate → red-team (3 passes) → forge

## Outcome

Saturday's tabletop session runs without data loss. Seven reliability issues surfaced during overnight red-team testing are fixed, verified in a live browser pass, and committed in three risk-ordered phases. Specifically:

1. Note edits survive `End Session`, `Clear All Data`, and `Delete Character` (no silent debounce drops).
2. Encounter reopen is atomic — the DB never ends in a state with the prior encounter closed but target not reopened, or vice versa.
3. Deleting a creature template cascades soft-delete through its `represents` entity links under a shared `softDeletedBy` txId.
4. Stale-session modal re-prompts on route changes, not only on hydration.
5. Session resume shows a ReopenEncounterPrompt for the most recently active prior encounter and offers Undo after reopening.
6. Bestiary uses soft-delete (aligned with `CLAUDE.md` convention); archived rows migrate to `deletedAt`+`softDeletedBy` under a Dexie v9 upgrade; a standalone `/bestiary/trash` route exposes Restore.
7. Combat HP writes in flight at session-end are awaited via the flush bus before `endSession` completes.

`npm run build` passes after each phase. Playwright smoke at `output/playwright/session_smoke.cjs` returns `SESSION_SMOKE_PASS`. The three phases are independently shippable — if Saturday creeps up, Phase 1 alone already meets the "don't lose data at the table" bar.

## Intent

**Trade-off hierarchy (what matters more when valid approaches conflict):**
1. **Data integrity over UX polish.** A save that silently drops is worse than a save that fails visibly. Toasts and in-flight UI disabling are required; animations are optional.
2. **Convention consistency over novelty.** Soft-delete cascade patterns mirror the existing `softDeleteLinksForEncounter` helper exactly. No new repository abstractions.
3. **Atomic transactions over convenience.** Any multi-row write wraps in `db.transaction('rw', [...], ...)`. No partial writes.
4. **Risk-ordered shipping over bundled shipping.** Phase 1 lands first and can ship alone if Phases 2–3 slip. Phases must NOT be reordered or parallelized; Phase 2 depends on Phase 1's `reopenEncounter`; Phase 3 depends on Phase 1's `softDeleteLinksForCreature`.
5. **One-way migrations must be recoverable.** Dexie v9 upgrade writes a pre-migration snapshot to the metadata table before transforming any row. Without snapshot, migration is forbidden.

**Decision boundaries (escalate, don't decide):**
- `archive()` grep reveals external callers outside `src/features/bestiary/` — pause and confirm before removing.
- The Dexie current version in `src/storage/db/client.ts` has uncommitted schema work already on disk — halt and surface.
- A planned soft-delete read path can't be wrapped with `excludeDeleted` without refactoring unrelated code — surface the scope expansion before proceeding.
- The note editor's existing state shape makes the `pendingUpdatesRef` approach require non-trivial refactoring of `handle*Change` handlers — surface the decision before landing.
- Any schema change beyond the ones enumerated in the sub-specs.
- Adding a new npm dependency.
- Any decision that would violate a MUST / MUST NOT in Constraints.

**Decide autonomously:**
- Internal registry data structure (Map vs. Set), file names within reasonable convention bounds, variable naming inside new helpers, test file organization, internal implementation of `pendingUpdatesRef`, TypeScript signatures of new helpers (as long as they mirror existing cascade helpers' shape), Drawer vs. Modal choice for `ReopenEncounterPrompt`.

## Context

This spec implements the evaluated and red-teamed design at `docs/plans/2026-04-16-game-night-reliability-fixes-design.md`. The design came out of two overnight Codex sessions that red-teamed the live Skaldbok build, surfaced seven reliability issues, and triaged them into three risk-ordered phases. Commander's Intent, Execution Guidance, Decision Authority, and War-Game Results sections in the design doc informed this spec directly.

**Related context already documented:**
- **`CLAUDE.md`** (repo root): documents the entity-linking pattern via `entityLinks` table, the soft-delete convention (`deletedAt` + `softDeletedBy` cascade under a shared txId, every read uses `excludeDeleted`), and the "configuration over hardcoding" rule. **Read this first.** All sub-specs must conform.
- **`src/storage/repositories/encounterRepository.ts`** (lines 327-345): canonical soft-delete cascade pattern — mirror this shape for creature templates.
- **`src/storage/repositories/entityLinkRepository.ts`** (lines 148-170): `softDeleteLinksForEncounter` helper — mirror this for `softDeleteLinksForCreature`.
- **`src/utils/softDelete.ts`**: `excludeDeleted` helper — use in every new read path.
- **`src/storage/db/client.ts`** (line 245): current Dexie version is **8**. Phase 3 bumps to **version 9**.

**Key discovery from red-team pass 2:** Dexie `upgrade(tx)` callbacks run inside their own dedicated transaction. All DB writes inside `upgrade(tx)` MUST use `tx.table(...)` directly — calling `metadataRepository.set(...)` or any repository helper that opens its own `db.xxx.where(...)` transaction will produce a nested-transaction error. Repository helpers are for runtime code only.

## Requirements

1. A shared `autosaveFlush` registry exists under `src/features/persistence/` with `registerFlush(fn)` (returns `{ id, unregister }`) and `flushAll()` (snapshots registry, awaits all flushes with `Promise.allSettled`).
2. `useAutosave` registers its flush fn with the bus on mount, unregisters on cleanup, and registers exactly once with an empty dep array.
3. `NoteEditorScreen` uses a `pendingUpdatesRef` that holds the latest unsaved field values and is replayed by both the debounce timer and the bus-registered flush fn. Unmount cleanup awaits the flush (not just clears the timer).
4. `CombatEncounterView` registers a flush fn that awaits any in-flight participant update.
5. The following lifecycle operations await `flushAll()` before mutating state: `SessionScreen.confirmEndSession`, `SettingsScreen.handleClearAll`, `ActiveCharacterContext.clearCharacter`, `useCharacterActions.deleteCharacter`.
6. `encounterRepository.reopenEncounter(sessionId, targetId)` exists and performs the "close current open + push new open on target + set target status=active" sequence inside a single `rw` transaction.
7. `useSessionEncounter.reopenEncounter` calls the new repository helper; its old two-step orchestration is removed.
8. `entityLinkRepository.softDeleteLinksForCreature(creatureId, txId, now)` exists and mirrors the shape of `softDeleteLinksForEncounter`.
9. `creatureTemplateRepository.softDelete` is the canonical user-facing delete path; it wraps `softDeleteLinksForCreature` under a shared txId inside one rw-transaction; `archive()` is removed (after grep confirms no callers outside bestiary feature).
10. `CampaignContext` staleness check runs on every route change via a `useLocation`-keyed `useEffect`. A per-session `staleModalDismissedForSessionId` ref suppresses re-prompts after Continue.
11. `CampaignContext.resumeSession` awaits `flushAll()`, flips status to active, queries the most-recently-ended non-deleted encounter, and if one exists shows a `ReopenEncounterPrompt`. Reopen path shows a toast with Undo; Skip or no-prior-encounter path shows a "Session resumed" toast.
12. Dexie v9 migration exists in `src/storage/db/client.ts`. For each `creatureTemplate` where `status === 'archived'` it writes `deletedAt` + `softDeletedBy` + clears `status`, and cascade-soft-deletes matching `represents` edges using `tx.table('entityLinks').update(...)` (never a repository helper) under the same migration txId. Before any transform, it snapshots `creatureTemplates` + all related `entityLinks` (regardless of current `deletedAt` state) to `metadata` under key `bestiary-pre-v9-snapshot` via `tx.table('metadata').put(...)`. Snapshot creation is wrapped in try/catch: on failure, log `console.error` and continue.
13. `BestiaryScreen` action label reads "Delete" (not "Archive") and includes a "View Trash" link to `/bestiary/trash`.
14. `TrashScreen` exists at `src/screens/TrashScreen.tsx`, wired into `src/routes/index.tsx` (object-form `RouteObject[]`, NOT JSX `<Route>`) at path `/bestiary/trash`, lists soft-deleted creature templates via `creatureTemplateRepository.getDeleted()` (new helper), and offers Restore per row.
15. Every read path over `creatureTemplates` uses `excludeDeleted` or passes `includeDeleted: true` explicitly.
16. `npm run build` passes after each phase. Playwright smoke returns `SESSION_SMOKE_PASS` after each phase.

## Sub-Specs

### SS-1: `autosaveFlush` registry module
**Scope:** Create the shared flush registry primitive used by Phase 1 components.
**Files:** `src/features/persistence/autosaveFlush.ts` (new)
**Dependencies:** none

**Acceptance criteria:**
- `[STRUCTURAL]` File `src/features/persistence/autosaveFlush.ts` exists and exports `registerFlush` and `flushAll`.
- `[STRUCTURAL]` Top-of-file docstring explains *why* the registry exists (lifecycle operations like `endSession`, `clearCharacter`, and `deleteCharacter` need deterministic waits for pending debounced writes), not just what.
- `[STRUCTURAL]` `registerFlush(fn: () => Promise<void>): { id: string; unregister: () => void }` — id is generated internally via `generateId()`; callers do not pick ids.
- `[STRUCTURAL]` `flushAll(): Promise<PromiseSettledResult<void>[]>` snapshots the registry at entry (e.g., `Array.from(registry.values())`) and iterates the snapshot so late unregisters don't affect the in-flight batch.
- `[BEHAVIORAL]` Given two registered flushes, calling `flushAll()` awaits both even if one unregisters mid-batch.
- `[BEHAVIORAL]` Given a flush fn that throws, `flushAll()` returns a `PromiseSettledResult` with `status: 'rejected'` for that entry; other flushes still complete.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-2: `useAutosave` registers with the flush bus
**Scope:** Modify the shared `useAutosave` hook to register its flush with the bus. Preserve existing debounce + unmount-flush behavior.
**Files:** `src/hooks/useAutosave.ts` (modified)
**Dependencies:** SS-1

**Acceptance criteria:**
- `[STRUCTURAL]` `useAutosave` imports `registerFlush` from `src/features/persistence/autosaveFlush.ts`.
- `[STRUCTURAL]` Registration happens inside a `useEffect` with an empty dep array `[]`. The flush callback is a closure that awaits `saveFn(pendingRef.current)` when `pendingRef.current` is not null.
- `[STRUCTURAL]` The effect returns the `unregister` fn as its cleanup.
- `[STRUCTURAL]` A comment near the effect documents the caller contract: "`saveFn` must be a stable reference (module-level function or memoized callback). Inline arrows captured here will go stale."
- `[BEHAVIORAL]` When `flushAll()` runs while a debounce is pending, the pending record is saved exactly once. No duplicate save.
- `[BEHAVIORAL]` When `character` becomes null, `pendingRef.current` is cleared AND the unmount flush does NOT fire a save (existing behavior preserved).
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-3: NoteEditor uses `pendingUpdatesRef` + bus registration
**Scope:** Replace the stale-closure debounce with a `pendingUpdatesRef`-based flow and register with the bus. Close the "fast navigation loses note" bug identified at `NoteEditorScreen.tsx:158-162`.
**Files:** `src/screens/NoteEditorScreen.tsx` (modified)
**Dependencies:** SS-1

**Acceptance criteria:**
- `[STRUCTURAL]` `NoteEditorScreen` has a `pendingUpdatesRef = useRef<Partial<Note>>({})`. Every `handle*Change` writes into this ref alongside calling `setState` and `scheduleAutosave`.
- `[STRUCTURAL]` `scheduleAutosave` (or its replacement) no longer takes `updates` as a parameter — it reads from `pendingUpdatesRef.current` when the timer fires.
- `[STRUCTURAL]` The debounce callback calls `updateNote(note.id, pendingUpdatesRef.current)` then resets `pendingUpdatesRef.current = {}`.
- `[STRUCTURAL]` A `useEffect` with empty dep array registers a flush fn with the bus that performs the same save-and-clear. Cleanup calls the unregister.
- `[STRUCTURAL]` Unmount cleanup awaits a final flush, not only clears the timer.
- `[BEHAVIORAL]` Typing into title, then body, then tags within 800ms, then pressing Back: all three updates land in the DB before navigation completes.
- `[BEHAVIORAL]` Triggering `flushAll()` mid-debounce saves the latest merged state.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-4: Atomic `reopenEncounter` helper
**Scope:** Move the "close prior open + push new open + set active" sequence into a single Dexie `rw` transaction inside `encounterRepository`; refactor the hook to call it.
**Files:** `src/storage/repositories/encounterRepository.ts` (modified), `src/features/session/useSessionEncounter.ts` (modified, lines ~171-201)
**Dependencies:** none

**Acceptance criteria:**
- `[STRUCTURAL]` `encounterRepository.reopenEncounter(sessionId: string, targetEncounterId: string)` exists and is exported.
- `[STRUCTURAL]` The function body is a single `db.transaction('rw', [db.encounters], async () => {...})` that: (a) closes any currently-open encounter's active segment on `sessionId`; (b) pushes a new open segment on `targetEncounterId`; (c) sets `status: 'active'` and clears `endedAt` on the target.
- `[STRUCTURAL]` `useSessionEncounter.reopenEncounter` calls `encounterRepository.reopenEncounter(...)` and no longer contains the two-step orchestration.
- `[BEHAVIORAL]` If `pushSegment` throws (e.g., last segment not properly closed), the whole transaction rolls back: the prior encounter remains open and the target remains ended. The hook's `refresh()` reflects unchanged state.
- `[BEHAVIORAL]` A successful reopen produces exactly one open segment across the session's encounters.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-5: `softDeleteLinksForCreature` cascade helper
**Scope:** Mirror `softDeleteLinksForEncounter` in `entityLinkRepository` to cascade creature deletion through `represents` edges.
**Files:** `src/storage/repositories/entityLinkRepository.ts` (modified)
**Dependencies:** none

**Acceptance criteria:**
- `[STRUCTURAL]` `entityLinkRepository.softDeleteLinksForCreature(creatureId: string, txId: string, now: string): Promise<void>` exists, exported, and shaped like `softDeleteLinksForEncounter` (lines 148-170).
- `[STRUCTURAL]` The function soft-deletes every entity link where the creature is `fromEntityId` or `toEntityId`, setting `deletedAt = now` and `softDeletedBy = txId` in one rw-transaction on `entityLinks`.
- `[STRUCTURAL]` The comment block at the top of `entityLinkRepository.ts` (listing relationship types) is updated to reflect any new helper signature.
- `[BEHAVIORAL]` Given a creature with three `represents` edges, calling the helper soft-deletes all three under the same `softDeletedBy` UUID.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-6: Flush-bus consumer wiring + combat flush `[INTEGRATION]`
**Scope:** Wire `flushAll()` into all four lifecycle call sites and register CombatEncounterView's in-flight participant update. Close the Phase 1 loop end-to-end.
**Files:** `src/screens/SessionScreen.tsx` (modified), `src/screens/SettingsScreen.tsx` (modified), `src/context/ActiveCharacterContext.tsx` (modified), `src/features/characters/useCharacterActions.ts` (modified), `src/features/encounters/CombatEncounterView.tsx` (modified)
**Dependencies:** SS-1, SS-2, SS-3

**Acceptance criteria:**
- `[STRUCTURAL]` `SessionScreen.confirmEndSession` awaits `flushAll()` as the first step; if any flush rejects, surfaces a toast via `useToast`, logs `console.error`, and returns early without calling `endSession`.
- `[STRUCTURAL]` The End Session button has a `disabled` state tied to an in-flight flush (e.g., a `useState<boolean>` toggled around the awaited `flushAll()`).
- `[STRUCTURAL]` `SettingsScreen.handleClearAll` awaits `clearCharacter()` (which itself flushes); the redundant flush is explicitly commented as a safe no-op.
- `[STRUCTURAL]` `ActiveCharacterContext.clearCharacter` awaits `flushAll()` before clearing in-memory state + settings.
- `[STRUCTURAL]` `useCharacterActions.deleteCharacter` awaits `clearCharacter()` (when deleting active character) OR a standalone `flushAll()` (when deleting non-active character) before `characterRepository.remove`.
- `[STRUCTURAL]` `CombatEncounterView` registers a flush fn that awaits the latest in-flight participant-update promise (tracked via a ref). No-op promise when nothing is in flight. Registration uses empty-dep `useEffect`.
- `[INTEGRATION]` Playwright: edit a note, click End Session, reload — note text persists. (Repeats the core #1 regression test.)
- `[INTEGRATION]` Playwright: edit a note, click Clear All Data, confirm DELETE — after reload, note row is gone AND character row is gone (no zombie re-insertion).
- `[INTEGRATION]` Playwright: simulate `saveFn` throwing in a registered flush, click End Session — session stays `active`, `endedAt` unset, error toast shown, button re-enabled.
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npx --yes --package playwright node output/playwright/session_smoke.cjs` returns `SESSION_SMOKE_PASS`.

---

### SS-7: Stale-session route-change re-check
**Scope:** Move staleness detection from one-shot hydration to a route-change observer in `CampaignContext`.
**Files:** `src/features/campaign/CampaignContext.tsx` (modified)
**Dependencies:** none

**Acceptance criteria:**
- `[STRUCTURAL]` `CampaignProvider` imports `useLocation` from `react-router-dom` and uses it.
- `[STRUCTURAL]` A `useEffect` keyed on `[location.pathname, activeSession?.id]` runs the staleness check. When `activeSession` exists, `now - activeSession.startedAt > STALE_SESSION_MS`, and the dismissed-id ref does not match, it sets `staleSession`.
- `[STRUCTURAL]` A `useRef<string | null>(null)` named `staleModalDismissedForSessionIdRef` is set to `activeSession.id` when Continue is clicked and cleared when `activeSession.id` changes.
- `[BEHAVIORAL]` With a >24h-old active session: navigate from `/session` → `/library` → `/knowledge` and verify the modal appears at each route change until Continue is clicked.
- `[BEHAVIORAL]` After clicking Continue, navigating between routes does NOT re-show the modal for that session.
- `[BEHAVIORAL]` After End (which clears the session), the dismissed ref clears naturally (tied to `activeSession.id` change).
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-8: Resume with reopen prompt + Undo toast `[INTEGRATION]`
**Scope:** Auto-surface the last-active encounter when a session is resumed. Prompt before reopening; offer Undo after. Undo uses the existing `endEncounter(id)` API on `useSessionEncounter` — no new export needed.
**Files:** `src/features/campaign/CampaignContext.tsx` (modified), `src/components/modals/ReopenEncounterPrompt.tsx` (new)
**Dependencies:** SS-4

**Acceptance criteria:**
- `[STRUCTURAL]` `CampaignContext.resumeSession(sessionId)` awaits `flushAll()`, updates `status: 'active'` + clears `endedAt`, queries non-deleted encounters for `sessionId` sorted by most-recent `endedAt` desc, takes the first.
- `[STRUCTURAL]` `ReopenEncounterPrompt` component exists at `src/components/modals/ReopenEncounterPrompt.tsx` using the existing `Modal` primitive at `src/components/primitives/Modal.tsx`. Props: `encounter`, `onReopen`, `onSkip`.
- `[STRUCTURAL]` When a lastEncounter exists, `resumeSession` renders `ReopenEncounterPrompt`. On Reopen: awaits `encounterRepository.reopenEncounter(sessionId, lastEncounter.id)`, shows toast with an action button "Undo" that calls `endEncounter(lastEncounter.id)` from `useSessionEncounter` (existing API — no new function needed). On Skip: shows "Session resumed" toast.
- `[STRUCTURAL]` If no lastEncounter exists: show "Session resumed" toast directly; no prompt.
- `[BEHAVIORAL]` Given an ended session with one prior encounter: Resume → prompt appears → Reopen → one open segment in DB + toast visible.
- `[BEHAVIORAL]` Click Undo within the toast lifetime: `endEncounter` closes the just-pushed segment; encounter.status reverts to ended.
- `[BEHAVIORAL]` ESC on the prompt is equivalent to Skip. No auto-reopen, "Session resumed" toast shown.
- `[BEHAVIORAL]` Given an ended session with every encounter soft-deleted: Resume shows "Session resumed" toast, no prompt.
- `[INTEGRATION]` Playwright: Resume an ended session with a prior encounter → verify prompt → Reopen → Undo → verify DB state: target encounter.status === 'ended', last segment has `endedAt` set.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-9: Dexie v9 migration with pre-migration snapshot
**Scope:** Bump the Dexie schema to v9 and transform every `status='archived'` creatureTemplate into a soft-deleted row. Snapshot first.
**Files:** `src/storage/db/client.ts` (modified)
**Dependencies:** none

**Acceptance criteria:**
- `[STRUCTURAL]` A new `this.version(9).stores({...}).upgrade(async tx => {...})` block exists in `src/storage/db/client.ts` after the existing `version(8)` block.
- `[STRUCTURAL]` All DB writes inside the upgrade callback use `tx.table('creatureTemplates').update(...)`, `tx.table('entityLinks').update(...)`, and `tx.table('metadata').put(...)`. No calls to repository helpers (no `metadataRepository`, `entityLinkRepository`, `creatureTemplateRepository`).
- `[STRUCTURAL]` Before any row transform, a snapshot is built: `{ creatureTemplates: [...all rows...], entityLinks: [...all edges where creature is fromEntityId or toEntityId, regardless of deletedAt state...] }`. The snapshot is `JSON.stringify`-d and written via `tx.table('metadata').put({ id: generateId(), key: 'bestiary-pre-v9-snapshot', value: <json> })`.
- `[STRUCTURAL]` Snapshot creation is wrapped in try/catch: on throw, `console.error('[bestiary-v9-migration] snapshot failed', e)` and the migration proceeds.
- `[STRUCTURAL]` For each creatureTemplate where `status === 'archived'`, the upgrade sets `deletedAt = migrationTs`, `softDeletedBy = migrationTxId`, strips `status` back to the default (or `'ready'`, matching the pre-archive value), and soft-deletes all its `represents` edges with the same `softDeletedBy`.
- `[STRUCTURAL]` Each migrated row id is logged via `console.info('[bestiary-v9-migration] migrated', id)`.
- `[BEHAVIORAL]` With a seeded DB containing one `status='archived'` creature that has two `represents` edges: after reload, the creature has `deletedAt` + `softDeletedBy` set, the two edges share the same `softDeletedBy`, and `metadata` table has a `bestiary-pre-v9-snapshot` row whose parsed value contains both the creature and both edges.
- `[BEHAVIORAL]` Migration is idempotent: on a second reload, no rows have `status='archived'` so the upgrade body runs its scan and finds nothing to transform.
- `[BEHAVIORAL]` Forcing the upgrade body to throw rolls back the entire transaction: on next reload, `db.verno` is still 8 and no rows changed.
- `[BEHAVIORAL]` Given a seeded `creatureTemplates` row where `status` is `undefined` or a non-`'archived'` value, the v9 upgrade leaves that row unchanged (no `deletedAt` set). A `console.warn('[bestiary-v9-migration] unexpected row, skipping', id)` is logged for rows with unexpected shapes.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-10: Bestiary soft-delete + `archive()` removal + UI rename
**Scope:** Route user-facing creature deletion through `softDelete` with cascade. Remove the `archive()` method and every surface that still relies on the `status='archived'` concept (it was replaced by `deletedAt` in SS-9's migration). Rename UI label.
**Files:** `src/storage/repositories/creatureTemplateRepository.ts` (modified), `src/features/bestiary/useBestiary.ts` (modified), `src/features/bestiary/BestiaryScreen.tsx` (modified)
**Dependencies:** SS-5, SS-9

**Acceptance criteria:**
- `[MECHANICAL]` `git grep -n "\.archive(" src/ | grep -v "creatureTemplateRepository"` returns no results BEFORE `archive()` is removed. If any external callers exist outside the bestiary feature, escalate (do not remove).
- `[STRUCTURAL]` `creatureTemplateRepository.softDelete(id)` wraps `entityLinkRepository.softDeleteLinksForCreature(id, txId, now)` inside one `db.transaction('rw', [db.creatureTemplates, db.entityLinks], ...)`. Both rows share the same `softDeletedBy` txId.
- `[STRUCTURAL]` `creatureTemplateRepository.archive` is removed.
- `[STRUCTURAL]` `creatureTemplateRepository.getDeleted(): Promise<CreatureTemplate[]>` exists (returns rows where `deletedAt != null`, skipping `excludeDeleted`). Needed by SS-11.
- `[STRUCTURAL]` `useBestiary.archive` is removed. The hook exposes `softDelete(id)` (a thin wrapper over `creatureTemplateRepository.softDelete`) that callers use instead.
- `[STRUCTURAL]` `useBestiary`'s existing `showArchived` filter logic (currently at lines 29-30 filtering on `t.status === 'archived'`) is removed. The hook no longer surfaces deleted rows at all — they live exclusively on `TrashScreen`. The `showArchived` toggle is removed from the return object.
- `[STRUCTURAL]` `BestiaryScreen`'s action label reads "Delete" (not "Archive") and the action handler calls `softDelete`, not `archive`.
- `[STRUCTURAL]` `BestiaryScreen` "No archived creatures." empty-state copy (currently at line 134) is removed; the screen no longer has an archived view at all.
- `[STRUCTURAL]` `BestiaryScreen` drawer check `viewingTemplate.status !== 'archived'` (currently at line 288) is removed — since deleted templates never surface in the drawer (they're excluded by the main list), the defensive check is dead code.
- `[STRUCTURAL]` `BestiaryScreen` includes a visible "View Trash" entry point (link or button in the header/toolbar) that navigates to `/bestiary/trash`.
- `[BEHAVIORAL]` Clicking Delete on a creature in the UI: the row disappears from the bestiary list, a new entity-link query returns no non-deleted `represents` edges for that creature, and both entries share the same `softDeletedBy`.
- `[BEHAVIORAL]` `useBestiary`'s return shape no longer contains `showArchived` or `archive` — a TypeScript compile error in any caller surfaces as part of `npm run build`.
- `[MECHANICAL]` `npm run build` exits zero.

---

### SS-11: TrashScreen + route + read-path audit `[INTEGRATION]`
**Scope:** New surface for restoring soft-deleted creatures. Audit every `creatureTemplates` read for `excludeDeleted` coverage.
**Files:** `src/screens/TrashScreen.tsx` (new), `src/routes/index.tsx` (modified — object-form `RouteObject[]`), plus any audit fixes in callers identified by the grep step
**Dependencies:** SS-10

**Acceptance criteria:**
- `[STRUCTURAL]` `src/screens/TrashScreen.tsx` exists and default-exports a React component. Uses `creatureTemplateRepository.getDeleted()` to list soft-deleted templates.
- `[STRUCTURAL]` Each row has a Restore button that calls `creatureTemplateRepository.restore(id)` (existing helper) and re-queries the list.
- `[STRUCTURAL]` `src/routes/index.tsx` gains an object-form entry `{ path: '/bestiary/trash', element: <TrashScreen /> }` inside the `ShellLayout` children array, adjacent to the existing `/bestiary` entry (around line 76). The router uses `RouteObject[]` — do NOT use JSX `<Route>` syntax.
- `[STRUCTURAL]` Empty state: when `getDeleted()` returns empty, render a friendly "Nothing deleted" card.
- `[STRUCTURAL]` Loading state: while `getDeleted()` is resolving on first render, render a minimal loading indicator or skeleton row so the UI doesn't flash the empty state.
- `[MECHANICAL]` `git grep -n "db.creatureTemplates\." src/ -- ':!src/storage/db/'` — every caller either uses `excludeDeleted(...)` from `src/utils/softDelete.ts` or passes `{ includeDeleted: true }` explicitly. Any bare call without filtering counts as a failure. The migration code under `src/storage/db/` is excluded because it uses `tx.table(...)` per SS-9, not `db.creatureTemplates` directly.
- `[BEHAVIORAL]` Delete a creature via Bestiary → navigate to `/bestiary/trash` → creature listed → click Restore → row disappears from Trash, reappears in Bestiary, and the previously-cascaded `represents` edges are also restored (shared `softDeletedBy` atomic restore).
- `[INTEGRATION]` Playwright: seed DB with a `status='archived'` creature + its two `represents` edges → reload (triggers v9 migration) → navigate to `/bestiary/trash` → creature listed → click Restore → verify creature and both edges have `deletedAt=null`.
- `[MECHANICAL]` `npm run build` exits zero.
- `[MECHANICAL]` `npx --yes --package playwright node output/playwright/session_smoke.cjs` returns `SESSION_SMOKE_PASS`.

## Edge Cases

- **Multiple autosave consumers, one throws:** `flushAll()` uses `Promise.allSettled`; the throwing consumer's rejection is surfaced (toast + console.error) but the other consumers still finish. The calling lifecycle operation aborts and does not mark the session ended.
- **Unregister during flush:** `flushAll()` snapshots the registry at entry. A component unmounting mid-flush (its unregister fires) does not affect the in-flight batch.
- **`saveFn` not stable:** The effect in `useAutosave` registers with a closure that references `saveFn` from the render scope. All current consumers pass a stable module-level export (`characterRepository.save`). If a future consumer passes an inline arrow, the closure captures the first render's fn. Caller contract is documented in a comment; an inline-arrow caller is a developer error, not a runtime bug.
- **NoteEditor fast-navigation:** typing title then navigating back within 800ms — `pendingUpdatesRef` captures the latest state; unmount cleanup awaits the flush; edit lands in the DB before navigation completes.
- **Reopen on an encounter whose last segment is malformed:** `pushSegment` throws "last segment still open"; rw-transaction rolls back; prior encounter's segment is NOT closed. Hook's `refresh()` reflects unchanged state. Toast surfaces error.
- **Stale-session modal dismissed then session changes:** dismissed-id ref is keyed on `activeSession.id`; a new session earns a fresh warning.
- **Resume prompt closed via ESC:** treated as Skip; "Session resumed" toast appears.
- **Resume with every encounter soft-deleted:** prompt is skipped silently (no candidate); "Session resumed" toast appears.
- **Undo toast missed:** encounter stays open; user closes manually from the timeline.
- **Dexie migration throws:** schema version does NOT advance to 9; app opens normally on next reload at v8 and can retry.
- **Snapshot stringify fails:** migration logs error and proceeds without snapshot — worse than ideal, strictly better than blocking user at v8 forever.
- **Migration meets malformed row** (missing `status` field): treat as non-archived; leave alone. Log at `console.warn`.
- **Trash scale:** 1000+ soft-deleted creatures block on single query. MVP acceptable; no pagination.
- **Restore of migrated creature:** all edges sharing the migration `softDeletedBy` restore atomically. Edges added after migration (different txId) correctly stay as-is.

## Out of Scope

- Generalizing TrashScreen to other entity types (sessions, notes, campaigns). Tag as a follow-up.
- `beforeunload` flush as defense-in-depth. Browsers are inconsistent about honoring async work in `beforeunload`.
- Registering flush for debounced saves beyond character + note editor (e.g., party editor, session scratch pads). The bus is designed so future consumers can add themselves, but this spec only wires the two known debounces + in-flight combat update.
- Pagination, search, or filter for TrashScreen.
- UX polish for the Undo toast beyond action-button support.
- A UI-level "Restore from snapshot" for the migration recovery path. Recovery is via devtools IndexedDB inspection (documented in the design doc).
- Cleaning up the migration snapshot on a future version bump. Retain indefinitely.
- Any rename or deprecation of `creatureTemplateRepository.archive` callers outside `src/features/bestiary/` — if any exist, escalate.
- Database index additions (e.g., indexing `deletedAt` on `creatureTemplates` for Trash query performance). Noted as a follow-up.

## Constraints

### Musts
- Every read over a domain entity table uses `excludeDeleted` from `src/utils/softDelete.ts` or passes `includeDeleted: true` explicitly.
- Every user-facing Delete routes through `softDelete`; `hardDelete` is internal-only.
- Every cascade soft-delete under a shared `softDeletedBy` txId inside one rw-transaction.
- Dexie `upgrade(tx)` callbacks use `tx.table(...)` directly. Repository helpers are forbidden inside upgrades.
- All four lifecycle consumers listed in Requirement 5 await `flushAll()` before mutating.
- `useAutosave` consumers pass a stable `saveFn` (module-level fn or memoized callback).
- Current Dexie version is 8 (confirmed at `client.ts:245`). Bump to 9, no higher.
- `npm run build` passes after each phase commit.
- Playwright smoke returns `SESSION_SMOKE_PASS` after each phase commit.

### Must-Nots
- MUST NOT introduce new hardcoded user-facing groupings or categories (CLAUDE.md "Configuration Over Hardcoding").
- MUST NOT bypass `flushAll()` in any new lifecycle event that mutates session or character state.
- MUST NOT silently drop a failed save — flush failures abort the triggering operation and surface via toast + `console.error`.
- MUST NOT call repository helpers from inside a Dexie `upgrade(tx)` callback.
- MUST NOT skip or reorder the three phases.
- MUST NOT ship Phase 3 without a verified pre-migration snapshot.
- MUST NOT remove `creatureTemplateRepository.archive()` before confirming zero external callers via grep.

### Preferences
- Prefer mirroring existing patterns (`softDeleteLinksForEncounter`, existing Dexie versions) over inventing new shapes.
- Prefer Modal for `ReopenEncounterPrompt` unless Drawer is already used in similar prompt flows.
- Prefer registering flush once with an empty dep array over re-registering on every render.
- Prefer user-visible toasts over silent console logs for any lifecycle operation the user triggered.

### Escalation Triggers
- `archive()` grep reveals external callers outside `src/features/bestiary/` — halt, surface, ask before removing.
- The Dexie current version has uncommitted schema work on disk — halt, surface.
- A new read path over `creatureTemplates` can't be wrapped with `excludeDeleted` without a wider refactor — halt, surface.
- The note editor's existing state shape requires non-trivial refactor of `handle*Change` handlers to adopt `pendingUpdatesRef` — halt, surface.

## Verification

After all 11 sub-specs complete:

1. `npm run build` exits zero.
2. `npx --yes --package playwright node output/playwright/session_smoke.cjs` returns `SESSION_SMOKE_PASS`.
3. Playwright smoke scenarios (see design doc Next Steps for full list) all pass, including failure-path scenarios.
4. Manual spot check in a live browser:
   - Edit a session note → End Session → reload → note persists.
   - Delete a creature in bestiary → check DevTools → verify `represents` edges have matching `softDeletedBy`.
   - Resume an ended session with prior encounter → prompt appears → Reopen → Undo roundtrip works.
   - Navigate routes on a >24h session → stale modal re-prompts until Continue.
   - Clear All Data while a character field is mid-edit → reload → no zombie character row.
   - DevTools → Application → IndexedDB → `metadata` table → `bestiary-pre-v9-snapshot` key present after first v9 reload with an archived creature seeded.
5. `git grep -n "\.archive(" src/` returns no matches.
6. `git grep -n "db.creatureTemplates\." src/` — every hit uses `excludeDeleted` or `includeDeleted: true`.

## Phase Specs

Refined by `/forge-prep` on 2026-04-16.

| Sub-Spec | Phase Spec |
|----------|------------|
| 1. autosaveFlush registry module | `docs/specs/game-night-reliability-fixes/sub-spec-1-autosave-flush-registry.md` |
| 2. useAutosave bus registration | `docs/specs/game-night-reliability-fixes/sub-spec-2-useautosave-bus-registration.md` |
| 3. NoteEditor pendingUpdatesRef + bus | `docs/specs/game-night-reliability-fixes/sub-spec-3-note-editor-pending-ref.md` |
| 4. Atomic reopenEncounter helper | `docs/specs/game-night-reliability-fixes/sub-spec-4-atomic-reopen-encounter.md` |
| 5. softDeleteLinksForCreature helper | `docs/specs/game-night-reliability-fixes/sub-spec-5-soft-delete-links-for-creature.md` |
| 6. Flush-bus consumer wiring + combat flush | `docs/specs/game-night-reliability-fixes/sub-spec-6-flush-bus-consumers.md` |
| 7. Stale-session route-change re-check | `docs/specs/game-night-reliability-fixes/sub-spec-7-stale-session-route-check.md` |
| 8. Resume prompt + Undo toast | `docs/specs/game-night-reliability-fixes/sub-spec-8-resume-prompt-and-undo.md` |
| 9. Dexie v9 migration with snapshot | `docs/specs/game-night-reliability-fixes/sub-spec-9-dexie-v9-migration.md` |
| 10. Bestiary soft-delete + archive removal + UI rename | `docs/specs/game-night-reliability-fixes/sub-spec-10-bestiary-soft-delete.md` |
| 11. TrashScreen + route + read-path audit | `docs/specs/game-night-reliability-fixes/sub-spec-11-trash-screen.md` |

Index: `docs/specs/game-night-reliability-fixes/index.md`

## Next Steps

- [x] Run `/forge-red-team` on this spec to surface implementation-level gaps. *(2026-04-16: resolved 5 critical + 4 advisory)*
- [x] Run `/forge-prep` to expand each sub-spec into a detailed phase spec with implementation steps and interface contracts. *(2026-04-16)*
- [x] Run `/forge-red-team` on the expanded phase specs to catch gaps introduced by the expansion. *(2026-04-16: resolved 2 critical — ToastContext extension for Undo, migration status='active' not 'ready' — plus 3 advisory)*
- [ ] Run `/forge-run` to execute Phase 1 first (sub-specs SS-1 through SS-6), verify, commit, then Phase 2, then Phase 3.
