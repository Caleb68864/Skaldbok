---
date: 2026-04-16
topic: "Game-night reliability fixes — unified plan for 7 issues"
author: Caleb Bennett
status: evaluated
evaluated_date: 2026-04-16
tags:
  - design
  - reliability
  - session-safety
  - bestiary
  - soft-delete
---

# Game-Night Reliability Fixes — Design

## Summary

Resolves seven reliability and correctness issues surfaced during overnight
red-team testing, grouped into three risk-ordered phases so the most
game-critical fixes ship first. Introduces a shared autosave-flush registry
that lets session-end and character-clear operations wait for pending
debounced writes, hardens the encounter-reopen transaction, cascades creature
deletes through the entity-link graph, and aligns the bestiary with the
project's soft-delete convention.

## Approach Selected

**Approach C — Risk-ordered phases with safe stopping points.** Three phases,
each independently shippable: game-critical correctness first, UX reliability
second, bestiary migration last. If Saturday's deadline creeps up, the
critical bar is already met after Phase 1.

## Architecture

Three phases, three commits. Each phase ends in a verifiable state.

```
Phase 1 — Game-critical correctness  (single commit)
  ├─ #1  Autosave flush bus          feature     new: autosaveFlush.ts registry
  ├─ #2  Atomic encounter reopen     repository  wrap in single rw-transaction
  ├─ #3  Creature-template cascade   repository  add softDeleteLinksForCreature
  └─ #5  Combat HP persistence       feature     flush-bus coverage on session-end

Phase 2 — UX reliability             (single commit)
  ├─ #4  Stale-session re-check      context     re-run check on route change
  └─ #7  Resume prompt + undo        feature     prompt on resume, toast-undo on reopen

Phase 3 — Bestiary soft-delete       (single commit)
  ├─ #6a Dexie migration             db layer    archived → deletedAt + softDeletedBy
  ├─ #6b Repo cascade                repository  softDelete replaces archive()
  ├─ #6c UI rename                   screen      BestiaryScreen: "Archive" → "Delete"
  ├─ #6d TrashScreen                 screen      new /library/trash with restore
  └─ #6e Read-path audit             repository  verify excludeDeleted everywhere
```

**Cross-cutting primitive — `autosaveFlush`:** a small registry
(`src/features/persistence/autosaveFlush.ts`) that lets debounced-save hooks
publish their flush function on mount, and lets lifecycle operations like
`endSession` and `clearCharacter` call `await flushAllAutosaves()` before
mutating state. This is the single mechanism that resolves #1 definitively
and also covers #5's in-flight-combat-write concern.

**Phase inter-dependencies (sequential, not parallelizable):**
- Phase 2 depends on Phase 1 — auto-reopen reuses the new
  `encounterRepository.reopenEncounter` helper from Component 3.
- Phase 3 depends on Phase 1 — `creatureTemplateRepository.softDelete`
  wires in the `softDeleteLinksForCreature` helper from Component 4.
- Do not reorder phases or attempt to land Phase 2/3 without Phase 1.

## Components

### Phase 1

1. **`autosaveFlush`** *(new — `src/features/persistence/autosaveFlush.ts`)*
   - Owns: a small registry `Map<id, () => Promise<void>>`.
   - Exposes: `registerFlush(fn): { id, unregister }` (callers do NOT pick ids — the module generates an internal id via `generateId()` and returns it together with the unregister fn; this eliminates collision surface); `flushAll(): Promise<PromiseSettledResult<void>[]>`.
   - `flushAll()` snapshots the registry at entry and iterates the snapshot — late unregisters don't affect the in-flight batch.
   - Docstring at top of file explains the *why*: lifecycle operations like `endSession`, `clearCharacter`, and `deleteCharacter` need to deterministically wait for pending debounced writes before mutating state; this registry is the single mechanism that makes that possible.
   - Does not own: the debounce logic or persistence logic themselves.

2. **`useAutosave`** *(modified — `src/hooks/useAutosave.ts`)*
   - Change: on mount, register a flush fn that awaits `saveFn(pendingRef.current)` if there's pending data. Return the unregister fn in cleanup. Keep the existing unmount-flush as backup.
   - Owns: debounce timer, pending ref, save lifecycle.
   - **Stability contract:** register *once* on mount with an empty dep array (`useEffect(() => {...}, [])`). The flush fn is a closure that reads the latest `pendingRef.current`, so it stays current without re-registration. Do NOT re-register on every render — that thrashes the registry and risks double-registration during the brief gap between unregister and re-register.
   - **Caller contract on `saveFn`:** consumers MUST pass a stable `saveFn` reference (a module-level function, like `characterRepository.save`, or a `useCallback`-memoized function). Inline arrow functions defined inside a render will capture a stale closure in the flush path. Current consumers already pass `characterRepository.save` so this holds, but state it explicitly so future consumers don't regress.

3. **`encounterRepository.reopenEncounter`** *(new — replaces orchestration in `useSessionEncounter.ts:171-201`)*
   - Owns: atomic transaction that closes any currently-open encounter's active segment, pushes a new open segment on the target, and flips target `status='active'`.
   - Single `rw` transaction on `encounters`. Dexie auto-rolls back on throw.

4. **`entityLinkRepository.softDeleteLinksForCreature`** *(new — mirrors `softDeleteLinksForEncounter`)*
   - Owns: cascading soft-delete of every edge where the creature is a `from` or `to` entity, under a shared `softDeletedBy` txId.
   - Consumed by `creatureTemplateRepository.softDelete` in Phase 3.

5. **Flush-bus consumers** *(all must await `flushAllAutosaves()` before mutating)*
   - `SessionScreen.confirmEndSession` — before `endSession()`. If any flush rejects, abort + toast; do not mark session ended. Button is visually disabled while flush is in-flight.
   - `SettingsScreen.handleClearAll` — before the clear-all transaction. Today's post-red-team fix: without this, a debounced autosave pending when user hits Clear All will land *after* the clear and re-insert a character row.
   - `ActiveCharacterContext.clearCharacter` — before clearing in-memory state and updating settings. Prevents the same recreation race in any other clearCharacter consumer.
   - `useCharacterActions.deleteCharacter` — before removing the character row. Same reason.
   - All four consumers: flush failure aborts the downstream mutation, surfaces a toast, and logs to console. Never proceed with stale data silently.
   - **Redundant-flush semantics:** `SettingsScreen.handleClearAll` calls `await clearCharacter()` which itself flushes. Two sequential flushes per action is intentional — the second is a safe no-op (`pendingRef`s are already cleared by the first). The duplication keeps each lifecycle operation self-sufficient: any of the four can be called in isolation without relying on its caller having already flushed. Same contract applies to `deleteCharacter` calling `clearCharacter`.

6. **Note editor flush — rework, not just registration** *(modified — `NoteEditorScreen.tsx`)*
   - **Critical finding from evaluation:** the current `useEffect` cleanup at lines 158-162 only clears the debounce timer — it does NOT call `updateNote` with pending changes. Notes lose data on any fast navigation, not just session-end.
   - Change (three parts):
     1. Add a `pendingUpdatesRef = useRef<Partial<Note>>({})` that always holds the merged latest unsaved field values. Every `handle*Change` writes into this ref alongside calling `setState` and scheduling the debounce.
     2. The debounce callback calls `updateNote(noteId, pendingUpdatesRef.current)` then clears the ref. The flush fn registered in the bus reads from the same ref — guarantees we flush the *latest* state, not stale closed-over data.
     3. Unmount cleanup both clears the timer AND awaits the flush fn, so any navigation (not just session-end) preserves pending edits.
   - This is the actual fix for #1. Without it, the flush bus saves stale or empty state.

7. **Combat participant flush registration** *(modified — `src/features/encounters/CombatEncounterView.tsx`)*
   - Change: register a flush fn that awaits the last-known in-flight participant-update promise (store it in a ref). No-op promise when nothing is in flight.

### Phase 2

8. **`CampaignContext` stale-session observer** *(modified — `CampaignContext.tsx`)*
   - Change: move staleness detection from one-shot hydration effect to a `useEffect` keyed on `location.pathname + activeSessionId`. Runs on every route change. Uses an in-memory ref `staleModalDismissedForSessionId` so Continue sticks for the session.
   - Owns: stale detection state + modal trigger.

9. **`CampaignContext.resumeSession`** + **`ReopenEncounterPrompt` modal** *(modified + new)*
   - Change: after flipping session status to active, query the session's non-deleted encounters, pick the one with the most recent `endedAt`, and if found, render the `ReopenEncounterPrompt` modal with options `[Reopen]` / `[Skip]`.
   - On Reopen: call `encounterRepository.reopenEncounter`, then show a toast "Reopened {name}" with an `[Undo]` action (Undo calls `endActiveEncounter` on the same encounter).

### Phase 3

10. **Dexie schema version bump + migration** *(new — in `src/storage/db/client.ts`)*
    - **Concrete versions:** current Dexie version is **8** (confirmed at `client.ts:245`). Phase 3 bumps to **version 9**.
    - Owns: one-time transform — for every `creatureTemplate` where `status === 'archived'`, set `deletedAt = <migration-timestamp>`, `softDeletedBy = <migration-txId>`, strip `status` back to default, and cascade-soft-delete that creature's `represents` edges under the same migration txId.
    - Runs inside Dexie's `upgrade(tx)` callback for version 9. Idempotent.
    - **All DB writes inside `upgrade(tx)` MUST use `tx.table(...)`, never the high-level repository API.** Calling `metadataRepository.set(...)`, `entityLinkRepository.softDeleteLinksForCreature(...)`, or any function that opens its own `db.xxx.where(...)` transaction from inside an active `upgrade(tx)` callback will produce a nested-transaction error or silent data mismatch. The migration must use `tx.table('creatureTemplates').update(...)`, `tx.table('entityLinks').update(...)`, and `tx.table('metadata').put(...)` directly. Repository helpers are safe to call from runtime code only.
    - **Pre-migration snapshot (required, not optional):** before transforming any row, serialize the full pre-migration state of `creatureTemplates` plus ALL `entityLinks` where the creature is `fromEntityId` or `toEntityId` regardless of current `deletedAt` state (so a manual restore preserves the pre-migration graph exactly — including edges that were already soft-deleted by earlier cascades). JSON-stringify and write via `tx.table('metadata').put({ id: generateId(), key: 'bestiary-pre-v9-snapshot', value: JSON.stringify(snapshot) })`. Dexie version bumps are one-way; without this snapshot, a bad migration is unrecoverable.
    - **Snapshot failure handling:** wrap snapshot creation in try/catch. If `JSON.stringify` or the `tx.table(...).put` call throws, log `console.error('[bestiary-v9-migration] snapshot failed', e)` and continue the migration without the snapshot. Losing the recovery path is worse than ideal, but it is strictly better than blocking the user at v8 with no way forward.
    - **Snapshot recovery:** if the v9 migration misbehaves, open DevTools → Application → IndexedDB → Skaldbok → `metadata` table → find key `bestiary-pre-v9-snapshot` → copy the `value` field. JSON contains `creatureTemplates` and `entityLinks` arrays at their pre-migration state. A dedicated restore UI is out of MVP scope.
    - **Snapshot retention:** retain indefinitely for MVP. Size is small (< 1 MB even with a thousand creatures). Tag as an optional follow-up: a later migration may mark the snapshot as "migration-confirmed" on first successful post-v9 reload and delete it then.
    - Logs each migrated row id via `console.info('[bestiary-v9-migration] migrated', id)` for debuggability.

11. **`creatureTemplateRepository.softDelete`** *(refactored)*
    - Change: becomes the single user-facing delete path. Wraps `softDeleteLinksForCreature` under a shared txId inside one rw-transaction over `creatureTemplates + entityLinks`.
    - `archive()`: deleted. Verify zero external callers first.

12. **`BestiaryScreen`** *(modified — `src/features/bestiary/` + `BestiaryScreen.tsx`)*
    - Change: relabel "Archive" action to "Delete". Add a small link "View Trash" that navigates to `/library/trash`. No restore UI inside this screen.

13. **`TrashScreen`** *(new — `src/screens/TrashScreen.tsx`, route `/library/trash`)*
    - Owns: list of soft-deleted creature templates with a Restore button per row. Scoped to creatures for MVP; structured so other entity types can be added later.
    - Uses `creatureTemplateRepository.getDeleted()` (add helper) and `.restore(id)` (already exists).
    - **Route wiring:** add `<Route path="/library/trash" element={<TrashScreen />} />` in the project's router config. At time of writing the routes live in `src/App.tsx` or `src/app/AppRoutes.tsx`; grep for existing `<Route path="/library"` to find the block and add the new entry there.
    - **Index note:** the Trash query reads `where('deletedAt is not null')` on `creatureTemplates`. If `deletedAt` isn't already an indexed field on that table, the query is a full table scan. Acceptable for MVP scale; flag for a future migration if trash regularly exceeds a few hundred rows.

14. **Read-path audit** *(verification — not code per se)*
    - Grep every `db.creatureTemplates.where(...)` and `db.creatureTemplates.toArray(...)` caller. Confirm each goes through `excludeDeleted` or passes `includeDeleted: true` explicitly.

## Data Flow

**A — Debounced autosave with external flush**

```
user edits field
  → updateCharacter() sets new record in memory
  → useAutosave effect: pendingRef = new record, debounce (re)scheduled
  → [normal path] timer fires after 1s → saveFn(pendingRef.current)

  → [session-end path]
      SessionScreen.confirmEndSession()
        → End Session button set to disabled state (UI reflects in-flight flush)
        → await flushAllAutosaves()
              registry iterates all registered flushes (character, note, combat)
              each flush awaits its save
              Promise.allSettled collects results
              if any rejected: abort + toast, re-enable button, do NOT end session
        → await endActiveEncounter() (if any)
        → await endSession()
        → toast "Session ended"
```

**B — Atomic encounter reopen**

```
user clicks Reopen
  → useSessionEncounter.reopenEncounter(targetId)
      → encounterRepository.reopenEncounter(sessionId, targetId)
          db.transaction('rw', [encounters], async () => {
            closeAnyCurrentlyOpenEncountersOnSession(sessionId)
            pushNewOpenSegment(targetId)
            setStatusActive(targetId)
          })
      → refresh() re-reads encounter state
```

**C — Creature template delete with cascade**

```
user clicks Delete in Bestiary
  → creatureTemplateRepository.softDelete(id)
      txId = generateId(); now = nowISO()
      db.transaction('rw', [creatureTemplates, entityLinks], async () => {
        await db.creatureTemplates.update(id, { deletedAt: now, softDeletedBy: txId })
        await entityLinkRepository.softDeleteLinksForCreature(id, txId, now)
      })
  → useBestiary re-queries via excludeDeleted → row disappears

  [restore path]
  user clicks Restore in TrashScreen
    → creatureTemplateRepository.restore(id)
        reads softDeletedBy off the row
        clears deletedAt + softDeletedBy on the row and every edge sharing that txId
        single rw-transaction
```

**D — One-time Dexie migration (Phase 3)**

```
app startup
  → Dexie opens db at new version N
  → upgrade callback runs:
      migrationTxId = 'bestiary-archive-migration-<ISO>'
      migrationTs = nowISO()
      for each row in creatureTemplates where status === 'archived':
          update row: deletedAt=migrationTs, softDeletedBy=migrationTxId, status=<default>
          for each entity link where fromEntity or toEntity == row.id:
              update link: deletedAt=migrationTs, softDeletedBy=migrationTxId
  → app proceeds
  (idempotent: second run finds no archived rows)
```

**E — Session resume with prompt + undo**

```
user clicks Resume
  → CampaignContext.resumeSession(sessionId)
      await flushAllAutosaves()
      db.sessions.update(sessionId, { status: 'active', endedAt: null })
      lastEncounter = query encounters where sessionId == session, not deleted,
                      sort by most-recent endedAt, take first
      if lastEncounter exists:
          show ReopenEncounterPrompt(lastEncounter):
              [Reopen] → await reopenEncounter(sessionId, lastEncounter.id)
                         toast "Reopened <name>" + [Undo]
                         [Undo] → endActiveEncounter(lastEncounter.id)
              [Skip]   → toast "Session resumed" (confirms the resume landed)
      else:
          toast "Session resumed" (confirms the resume landed)
```

**F — Stale-session re-check on route change**

```
any route change (location.pathname changes)
  → CampaignContext useEffect fires
      if activeSession
         && (now - activeSession.startedAt) > 24h
         && activeSession.id !== staleModalDismissedForSessionId:
            show StaleSessionModal
      on Continue: set staleModalDismissedForSessionId = activeSession.id
      on End: clear session
```

## Error Handling

**Phase 1:**
- Flush failure during `endSession`: `flushAllAutosaves` snapshots the registry at the start of the call and iterates the snapshot — late unregisters (e.g., a screen unmounting mid-flush) don't affect the in-flight batch. Uses `Promise.allSettled`; if any rejected, abort `endSession` and show toast. Never mark ended with unsaved data. All rejections also `console.error` for debuggability, independent of the user-facing toast.
- Atomic reopen: Dexie rolls back on throw. Hook re-reads state regardless; toast surfaces any error.
- Creature cascade: same — rollback on throw, creature stays visible.
- Combat HP: flush-bus covers session-end path. Tab-close mid-keystroke remains unavoidable; accepted.
- Note editor flush is mandatory — without it, #1 is NOT fixed. Explicit test scenario.

**Phase 2:**
- Stale modal dismissal: in-memory ref keyed on sessionId. Resets on session change / reload; fresh reload earns fresh warning.
- Resume prompt ESC/close: treat as Skip. No auto-reopen.
- Undo toast miss: encounter stays open; user can close from timeline.
- Every encounter deleted: prompt is skipped silently.

**Phase 3:**
- Migration idempotence: second run finds zero archived rows — no-op.
- Migration partial failure: Dexie `upgrade` is transactional; schema version doesn't bump on throw; retry on next startup.
- Restore of migrated creature: edges sharing the migration txId restore atomically. Edges added after migration stay as-is (correct).
- Pre-migration orphaned participants: the condition already existed; this migration fixes going forward but does not retroactively re-link already-broken participants.
- TrashScreen empty state: friendly empty card.
- TrashScreen scale: no pagination MVP. Acceptable unless a user deletes thousands.

## Open Questions

1. **Flush bus scope beyond character + note editor?** MVP registers the known autosaves. Bus is designed so adding more (party editor, session scratch) is trivial. No action now.
2. **TrashScreen generalization to all entity types?** MVP = creatures only. Worth tagging as a follow-up; do not expand scope now.
3. **`beforeunload` flush as defense-in-depth?** Browsers are inconsistent about honoring async work in `beforeunload`. Skip for this plan. Tag as open.
4. **Rename `archive()` — delete or keep as deprecated shim?** Leaning delete. Verify via grep that no code outside `useBestiary` calls it before removing.

## Approaches Considered

- **Approach A — One unified PR, single sweep.** Minimal overhead, one review, but any one fix dragging blocks the whole batch. Not selected because Saturday deadline + bestiary migration risk make atomic release risky.
- **Approach B — Layered by architecture (repos → features → screens).** Clean diffs per layer, reviewable in vertical slices, but doesn't map to risk. A critical bug (#1) could sit behind lower-severity work (#6). Not selected.
- **Approach C — Risk-ordered phases with safe stopping points.** *(Selected.)* Three phases, each independently shippable. Game-critical fixes ship first. Phase 3's data migration is isolated from core play loop.

## Commander's Intent

**Desired End State:** Saturday's tabletop session runs without data loss. The seven red-teamed bugs are fixed, verified in a live browser pass, and committed. Specifically: note edits survive `End Session`; encounter reopen never leaves the DB inconsistent; creature-template deletes cascade through `represents` edges; stale-session modal re-prompts on navigation; resume prompts before reopening the last encounter and offers Undo; the bestiary uses soft-delete with a Trash screen; and archived-row data is migrated without loss.

**Purpose:** Game on Saturday. Overnight red-team surfaced seven reliability issues; this plan patches all of them in risk-ordered phases so the critical play-loop fixes ship first and the invasive bestiary migration ships last, isolated from everything else.

**Constraints:**
- **MUST** honor the soft-delete convention in `CLAUDE.md` — every domain entity read filters `deletedAt` by default (use the `excludeDeleted` helper).
- **MUST** route every user-facing "Delete" through `softDelete`, never `hardDelete`.
- **MUST** cascade entity-link deletes under a shared `softDeletedBy` txId in a single rw-transaction.
- **MUST NOT** bypass `flushAllAutosaves()` in any new lifecycle event that mutates session or character state.
- **MUST NOT** silently drop a failed save — flush failures abort the triggering operation and surface via toast + `console.error`.
- **MUST** verify the current Dexie version in `src/storage/db/client.ts` before bumping; halt if uncommitted schema work is on disk.
- **MUST NOT** introduce new hardcoded user-facing groupings or categories (see `CLAUDE.md` Configuration Over Hardcoding).

**Freedoms:**
- Agent **MAY** choose internal data structures for the flush registry (Map vs. WeakMap, Set of ids vs. array).
- Agent **MAY** organize new modules under `src/features/persistence/` or an adjacent folder if the existing convention dictates otherwise.
- Agent **MAY** choose test file placement (co-located `*.test.ts` vs. a `__tests__/` folder) to match whatever convention already exists for the touched modules.
- Agent **MAY** write the `ReopenEncounterPrompt` as a Modal or Drawer depending on which primitive is less intrusive on mobile.

## Execution Guidance

**Observe:**
- `npm run build` passes after every component change. Keep the baseline green.
- Playwright smoke runner at `output/playwright/session_smoke.cjs` still returns `SESSION_SMOKE_PASS` after Phase 1 changes.
- `tsc -b` surfaces no new errors; fix immediately, don't defer.
- For Phase 3: open devtools → Application → IndexedDB → Skaldbok on a seeded database with a `status='archived'` creature, reload, and confirm the row has `deletedAt` + `softDeletedBy` after migration.

**Orient (codebase conventions to match):**
- Soft-delete pattern: see `encounterRepository.softDelete` at `encounterRepository.ts:327-345` and `entityLinkRepository.softDeleteLinksForEncounter` at `entityLinkRepository.ts:148-170`. Mirror these signatures and transaction shape.
- Atomic transactions: use `db.transaction('rw', [tables], async () => {...})` — see existing pattern in the same repositories.
- Toasts: use `useToast().showToast(message, kind?)` from `src/context/ToastContext.tsx`.
- Drawers vs. Modals: Drawer for form/edit surfaces (e.g., `Drawer` primitive in `src/components/primitives/Drawer.tsx`), Modal for blocking prompts. Reopen prompt is a Modal.
- React Router: `useLocation` and `useNavigate` are available; `CampaignProvider` is already inside `BrowserRouter` (verified at `AppProviders.tsx`).
- ID generation: `import { generateId } from '../utils/ids'`.
- Timestamps: `import { nowISO } from '../utils/dates'`.

**Escalate When:**
- `archive()` grep reveals external callers outside `src/features/bestiary/` — pause and confirm before removing.
- The Dexie current version in `client.ts` has uncommitted schema work already on disk — halt and surface.
- A planned soft-delete read path can't be wrapped with `excludeDeleted` without refactoring unrelated code — surface the scope expansion before proceeding.
- The note editor's existing state shape makes the `pendingUpdatesRef` approach require non-trivial refactoring of `handle*Change` handlers — surface the decision before landing.

**Shortcuts (Apply Without Deliberation):**
- **Mirror `softDeleteLinksForEncounter`** (`entityLinkRepository.ts:148`) for the new `softDeleteLinksForCreature`. Same signature, same transaction shape, different `entityType` filter.
- **Mirror `encounterRepository.softDelete`** (`encounterRepository.ts:327-345`) for `creatureTemplateRepository.softDelete`'s cascade wiring.
- **Use the existing `Drawer` primitive** (`src/components/primitives/Drawer.tsx`) or `Modal` primitive for any new UI surface — do NOT roll a new overlay.
- **Use `useToast`** (`src/context/ToastContext.tsx`) for the Undo toast — pass an action button, not a raw HTML element.
- **Follow the Dexie migration pattern already in `src/storage/db/client.ts`** — `.version(N+1).stores({...}).upgrade(tx => {...})`. The existing versions are the template.
- **Use the `excludeDeleted` helper** (`src/utils/softDelete.ts`) in any new read path over `creatureTemplates`.
- **Migration carve-out:** all shortcuts above describe runtime code. Inside Dexie `upgrade(tx)` callbacks, use `tx.table(...)` directly — repository helpers (`metadataRepository.set`, `entityLinkRepository.softDeleteLinksForCreature`, `creatureTemplateRepository.softDelete`, etc.) open their own transactions and will error or silently mis-behave if called from inside an active upgrade tx.

## Decision Authority

**Agent Decides Autonomously:**
- Internal data structure of the flush registry (Map, Set, etc.).
- File names and folder placement within reasonable convention bounds.
- Variable naming inside new helpers and hooks.
- Test file naming and organization (match existing convention for the touched modules).
- Internal implementation of the `pendingUpdatesRef` pattern in `NoteEditorScreen`.
- Typescript signatures of new helpers (as long as they mirror existing cascade helpers' shape).

**Agent Recommends, Human Approves:**
- Dexie schema version bump number (surface the current version + proposed next).
- Deletion of `archive()` from `creatureTemplateRepository` after grep confirms no external callers.
- Exact UX copy for the Undo toast, Trash screen header, Reopen prompt text.
- Placement of "View Trash" entry point in `BestiaryScreen` (header link vs. footer vs. action menu).

**Human Decides:**
- Scope expansion: generalizing Trash to other entity types (Open Question 2) — stays out of MVP.
- Whether to add `beforeunload` as defense-in-depth (Open Question 3) — stays out of MVP.
- Adding new debounced-save consumers to the flush bus beyond character + note editor (Open Question 1) — stays out of MVP.
- Any visual/brand copy that ships to end users.

## War-Game Results

**Most Likely Failure:** Phase 3 Dexie migration encountering an archived creature with a missing or malformed `status` field (pre-existing data corruption). Dexie's `upgrade()` is transactional so the schema version doesn't advance on throw, but the app is blocked from opening until the row is repaired.
**Mitigation:** Migration treats `status === 'archived' || (!row.deletedAt && row.status !== 'active' && row.status !== 'ready')` as eligible for migration — conservative enough to catch malformed rows, strict enough not to migrate healthy ready/active templates. Log each migrated row's id for debuggability.

**Scale Stress:** TrashScreen rendering 1000+ soft-deleted creatures blocks on a single query + render.
**Mitigation:** MVP is acceptable — no user is expected to reach that scale before Saturday. Tag as a follow-up.

**Dependency Risk:** A parallel branch with uncommitted Dexie schema work could collide with the Phase 3 version bump, silently corrupting user data.
**Mitigation:** Execution Guidance `Escalate When:` rule requires verifying current version before bump. Agent halts if any in-flight schema change is on disk.

**Maintenance Assessment (6-month check):** The flush registry is a new primitive and will be surprising to a developer who doesn't know it exists. A one-paragraph docstring at the top of `autosaveFlush.ts` explaining the *why* (not the *what*) mitigates this. Everything else maps onto existing patterns (soft-delete cascade, Dexie migration, Modal/Drawer primitives) and will read naturally.

## Evaluation Metadata

- Evaluated: 2026-04-16
- Red-teamed: 2026-04-16 (9-role adversarial pass, then second pass to catch fix-induced regressions)
- Cynefin Domain: Complicated
- Critical Gaps Found: 1 from /forge-evaluate (resolved) + 2 from /forge-red-team pass 1 (resolved) + 1 from /forge-red-team pass 2 (resolved) + 0 from pass 3
- Important Gaps Found: 4 from /forge-evaluate (resolved) + 8 from /forge-red-team pass 1 (resolved) + 4 from /forge-red-team pass 2 (resolved) + 4 from /forge-red-team pass 3 (all resolved — saveFn stability contract, migration carve-out in shortcuts, snapshot failure handling, snapshot scope clarified to include already-deleted edges)
- Suggestions: 3 (all integrated)
- Role Scorecards: Developer 3, QA 1, End User 1, Integration Architect 3, Scope Realist 0 (no defer-rate data), Security 0 (client-only app), SRE 1, Data 2, Product 0

## Next Steps

- [ ] Turn this design into a Forge spec (`/forge docs/plans/2026-04-16-game-night-reliability-fixes-design.md`)
- [ ] Verify `archive()` has zero external callers before deletion (grep step during Phase 3; already listed in Execution Guidance escalation rules)
- [ ] Plan Playwright smoke scenarios (happy paths and failure paths):
  - Phase 1 happy: edit a note → click End Session → reload → note text persists.
  - Phase 1 happy: click Reopen on an ended encounter → verify one open segment in DB, prior encounter closed.
  - Phase 1 happy: delete a creature in bestiary → verify `represents` edges are soft-deleted with matching `softDeletedBy`.
  - Phase 1 failure: simulate `saveFn` throwing in a registered flush → click End Session → verify session stays `active`, `endedAt` is never set, error toast shown, button re-enabled.
  - Phase 1 failure: simulate `reopenEncounter` transaction throwing → verify UI reflects unchanged state via `refresh()` and an error toast appears.
  - Phase 2 happy: start a stale session scenario → navigate routes → modal re-prompts until Continue.
  - Phase 2 happy: click Resume on an ended session with prior encounter → prompt appears → Reopen → Undo → encounter closed again.
  - Phase 2 happy: Resume with no prior encounter → "Session resumed" toast appears and no prompt is shown.
  - Phase 3 happy: seed with `status='archived'` creature → reload → verify migrated row has `deletedAt` and `softDeletedBy`; Trash screen lists it; Restore brings it back.
  - Phase 3 failure: force migration to throw mid-upgrade → reload → verify Dexie schema did NOT advance to v9, app opens cleanly on next retry, `bestiary-pre-v9-snapshot` is present in metadata.
- [ ] After game night, evaluate whether to generalize TrashScreen and extend the flush bus (Open Questions 1 and 2).
