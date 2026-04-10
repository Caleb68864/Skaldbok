---
type: phase-spec
sub_spec: 9
title: "Verification, Cleanup, and End-to-End Smoke"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8]
wave: 8
---

# Sub-Spec 9 — Verification, Cleanup, and End-to-End Smoke

## Scope

Run grep audits, delete dead code where provably unreachable, confirm `npm run build` and `npm run lint` are green, and execute a manual end-to-end smoke test that exercises the full unified flow.

This sub-spec produces **no new source files**. Its artifacts are: grep results, a possibly-deleted `CombatTimeline.tsx`, green build/lint output, and a manual smoke-test log.

## Context

- All prior sub-specs must be complete and green before this one runs.
- The manual smoke test is the only full-system verification because the repo has no automated test runner.
- `CombatTimeline.tsx` at `src/features/combat/CombatTimeline.tsx` should have no remaining runtime importers after Sub-Spec 7. Verify with grep and delete if confirmed unused.

## Implementation Steps

### Step 1 — Grep audit: forbidden strings

Run each of the following. Every one must return zero matches.

```bash
# Removed legacy code
grep -rn "quickCreateParticipant" src/
grep -rn "linkedCreatureId\|linkedCharacterId" src/
grep -rn "Start Combat" src/

# Removed session-adjacent imports of CombatTimeline
grep -rn "CombatTimeline" src/screens/
grep -rn "CombatTimeline" src/features/session/

# Removed explicit old imports
grep -rn "from '../combat/CombatTimeline'" src/
grep -rn "from '../../features/combat/CombatTimeline'" src/
grep -rn "from '../../../features/combat/CombatTimeline'" src/
```

If any returns a non-zero match, fix the source file in the owning sub-spec (do not paper over the match).

### Step 2 — Dead code removal: `CombatTimeline.tsx`

Check for any remaining importers of `CombatTimeline` anywhere in `src/`:

```bash
grep -rn "CombatTimeline" src/ | grep -v "src/features/combat/CombatTimeline.tsx"
```

- If zero matches: the file is truly unreferenced. **Delete it.**

  ```bash
  rm src/features/combat/CombatTimeline.tsx
  ```

  Re-run `npm run build` to confirm nothing else was depending on it.

- If matches remain in non-session code: leave `CombatTimeline.tsx` in place, and document the remaining importers in the commit message for human review. Do NOT escalate — the file's presence is tolerable as long as no runtime path from SessionScreen reaches it.

### Step 3 — Positive grep checks: new code is wired

```bash
# Sub-Spec 1
grep -q "export function excludeDeleted" src/utils/softDelete.ts

# Sub-Spec 2
grep -q "version(8)" src/storage/db/client.ts

# Sub-Spec 3
grep -q "encounterParticipant" src/storage/repositories/entityLinkRepository.ts
grep -q "segments" src/types/encounter.ts

# Sub-Spec 4
grep -q "export function useSessionEncounter" src/features/session/useSessionEncounter.ts
grep -q "export function SessionEncounterProvider" src/features/session/SessionEncounterContext.tsx

# Sub-Spec 5
grep -q "reassignNote" src/features/session/useSessionLog.ts
grep -q "logGenericNote" src/features/session/useSessionLog.ts
grep -q "logNpcCapture" src/features/session/useSessionLog.ts
grep -q "'represents'" src/features/encounters/useEncounter.ts

# Sub-Spec 6
grep -q "export function SessionBar" src/features/session/SessionBar.tsx
grep -q "export function EncounterParticipantPicker" src/features/encounters/EncounterParticipantPicker.tsx

# Sub-Spec 7
grep -q "SessionEncounterProvider" src/screens/SessionScreen.tsx
grep -q "SessionBar" src/screens/SessionScreen.tsx
grep -q "TiptapNoteEditor" src/features/encounters/EncounterScreen.tsx
grep -q "EncounterParticipantPicker" src/features/encounters/EncounterScreen.tsx

# Sub-Spec 8
test -f src/features/session/quickActions/QuickNoteAction.tsx
test -f src/features/session/quickActions/QuickNpcAction.tsx
test -f src/features/session/quickActions/AttachToControl.tsx
```

Every command must succeed. If any fails, the owning sub-spec did not complete correctly.

### Step 4 — Build and lint

```bash
npm run build
npm run lint
```

Both must exit zero. If not, fix the root cause in the owning sub-spec.

### Step 5 — Manual end-to-end smoke test

Start the dev app:

```bash
npm run dev
```

Navigate to the app in a browser. If the app is already running, refresh to force the Dexie v8 migration against the current database.

**Step-by-step smoke:**

1. Open DevTools → Application → IndexedDB → the Skaldbok database. Confirm version is **8**. Confirm `localStorage` has a key matching `forge:backup:pre-encounter-rework-YYYY-MM-DD.json`.

2. Navigate to `/session`. Start a session if needed. Confirm:
   - The **SessionBar** renders at the top with "no encounter active".
   - There is **exactly one** "Start Encounter" button. There is **no** "Start Combat" button.
   - The page has **no console errors**.

3. Click **Start Encounter**. In the modal, enter:
   - Title: `Tavern`
   - Type: `social`
   - Description: (optionally type a few words)
   - Submit.

4. Confirm:
   - SessionBar shows `Active: Tavern (social)`.
   - Recently Ended row is hidden (no ended encounters yet).
   - Clicking the Tavern chip navigates to `EncounterScreen`.

5. On the EncounterScreen, confirm all four sections render: **Narrative**, **Participants**, **Attached log** (empty), **Relations** (empty).

6. Navigate back to `/session`. Open **Quick Log → Skill Check**. Confirm:
   - The "Attach to" select defaults to `Active: Tavern`.
   - Submit a test skill check.
   - Toast appears: `Logged to Tavern`.

7. Navigate to the Tavern encounter. Confirm the skill check appears in the **Attached log** section.

8. Back on SessionScreen, click **Start Encounter** again. Enter:
   - Title: `Bar Fight`
   - Type: `combat`
   - Submit.

9. Confirm:
   - Toast appears: `Tavern ended, Bar Fight started`.
   - SessionBar now shows `Active: Bar Fight (combat)`.
   - Recently Ended row shows `↺ Tavern` chip.

10. Open **Quick Log → NPC / Monster**. Enter:
    - Name: `Drunk Patron`
    - Category: `npc`
    - Submit.

11. Confirm:
    - Toast: `Logged to Bar Fight`.
    - Navigate to `/bestiary` — Drunk Patron appears as a new entry.
    - Navigate back to the Bar Fight encounter — the `Drunk Patron` note appears in the Attached log (typed as NPC).

12. In Bar Fight, open the participant picker, type `Bandit`, click `+ Create new "Bandit"`, fill minimal fields, submit. Confirm:
    - The participant appears in the Encounter's Participants section.
    - `/bestiary` has a new `Bandit` entry.

13. Click **End Encounter** on Bar Fight, enter a short summary, submit. Confirm:
    - Bar Fight is ended (status visible in UI).
    - SessionBar active chip is now `no encounter active` (or the next active).
    - Recently Ended row shows both `↺ Tavern` and `↺ Bar Fight`.

14. Click the `↺ Tavern` chip. Confirm:
    - Tavern is active again (SessionBar shows it).
    - The `segments` array for Tavern now has 2 elements (inspect via DevTools → IndexedDB).

15. Open **Quick Log → Note** (generic). Enter a quick thought. Submit. Confirm:
    - Toast: `Logged to Tavern`.
    - Navigate to Tavern encounter — the generic note is in the Attached log.

16. End Tavern with a summary. Confirm:
    - Both encounters are ended.
    - Recently Ended row shows both.

17. **Cross-reference via DevTools:** Open IndexedDB → `entityLinks`. Filter by `relationshipType`:
    - `contains` — should have entries for every Quick Log you submitted.
    - `happened_during` — should have exactly one entry: Bar Fight → Tavern.
    - `represents` — should have at least one entry (Bandit participant).
    - `introduced_in` — should have at least one entry (Drunk Patron note → session).

### Step 6 — Document smoke results

Write the results as a short comment in the commit message or as a scratch file `tmp-smoke-test-results.md` (gitignored). Include:
- Dexie version confirmed (8)
- Backup key confirmed in localStorage
- Zero console errors encountered
- Any quirks or near-misses noted during manual testing

### Step 7 — Final build and lint

```bash
npm run build
npm run lint
```

Both must exit zero. This is the final gate.

### Step 8 — Commit

```
chore(encounter): verification cleanup and smoke test pass

- Grep audits all clear: no quickCreateParticipant, linkedCreatureId,
  linkedCharacterId, Start Combat, or session-adjacent CombatTimeline
  imports remain
- {Keep/Delete} src/features/combat/CombatTimeline.tsx
  (deleted: no remaining imports / kept: remaining importer in X)
- npm run build + npm run lint both green
- Manual smoke test completed: full flow from session start through
  encounter lifecycle, NPC capture, participant creation, reopen,
  generic note. All entity link edges verified via DevTools.
- Closes the encounter-notes-folder unification rework.
```

## Interface Contracts

This sub-spec produces no new contracts. It verifies that all prior sub-specs' contracts are in place and that the system composes correctly end-to-end.

## Verification Commands

```bash
# All grep audits (every one must return zero or the grep exit code must indicate zero matches)
grep -rn "quickCreateParticipant" src/ ; [ $? -eq 1 ] || (echo "FAIL: quickCreateParticipant found" && exit 1)
grep -rn "linkedCreatureId\|linkedCharacterId" src/ ; [ $? -eq 1 ] || (echo "FAIL: FK columns found" && exit 1)
grep -rn "Start Combat" src/ ; [ $? -eq 1 ] || (echo "FAIL: Start Combat label found" && exit 1)
grep -rn "CombatTimeline" src/screens/ ; [ $? -eq 1 ] || (echo "FAIL: CombatTimeline still imported in screens" && exit 1)
grep -rn "CombatTimeline" src/features/session/ ; [ $? -eq 1 ] || (echo "FAIL: CombatTimeline still imported in session" && exit 1)

# Final build and lint
npm run build
npm run lint
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| `quickCreateParticipant` fully removed | [MECHANICAL] | `[ $(grep -rn "quickCreateParticipant" src/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: quickCreateParticipant still referenced" && exit 1)` |
| Participant FK columns fully removed | [MECHANICAL] | `[ $(grep -rn "linkedCreatureId\|linkedCharacterId" src/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: FK columns still referenced" && exit 1)` |
| "Start Combat" label removed | [MECHANICAL] | `[ $(grep -rn "Start Combat" src/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: Start Combat label still exists" && exit 1)` |
| `CombatTimeline` unreferenced from screens | [MECHANICAL] | `[ $(grep -rn "CombatTimeline" src/screens/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: CombatTimeline still in screens/" && exit 1)` |
| `CombatTimeline` unreferenced from session | [MECHANICAL] | `[ $(grep -rn "CombatTimeline" src/features/session/ \| wc -l) -eq 0 ] \|\| (echo "FAIL: CombatTimeline still in features/session/" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
| Manual smoke test passes the flow in Step 5 | [HUMAN REVIEW] | manual |
