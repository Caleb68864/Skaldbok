# Spec: Bug Fixes from Full Coverage Test Run

**Run:** 2026-03-31T16-49-14-design-doc
**Phase:** forge
**Branch:** 2026/03/31-1156-caleb-feat-2026-03-31-unified-production-readiness-design
**HEAD:** 0d665e151fe0
**Date:** 2026-03-31
**Score:** 0 / 3 criteria passing (pre-fix baseline)

---

## Intent Hierarchy

```
GOAL: Restore 3 failing/partial scenarios to PASS in the full coverage test suite
  ├── INTENT: Surface existing MiniSearch infrastructure in Notes UI (SR-02)
  │     └── WHY: The hook is implemented but dead — users cannot search notes at all
  ├── INTENT: Make "Clear All Data" actually clear all user data (DB-11)
  │     └── WHY: 9 of 12 tables survive the clear, leaving app in inconsistent state
  └── INTENT: Prevent orphaned partyMember records and handle existing ones (EC-08)
        └── WHY: Deleting a character leaves ghost rows that render as raw UUIDs
```

---

## Sub-Spec 1 — Notes Screen Search UI (SR-02)

**Severity:** FAIL
**Score weight:** 1 / 3
**Source files:**
- `src/features/notes/useNoteSearch.ts` (hook — already implemented, do not modify)
- `src/screens/NotesScreen.tsx` (add search input + wire hook)

### Problem Statement

`useNoteSearch` is a fully-functional MiniSearch wrapper with field weighting
(`title:2`, `tags:1.5`, `body:1`) and fuzzy/prefix matching. It is not imported
or invoked anywhere in the UI. The Notes screen has no search input.

### Implementation Plan

1. **Import `useNoteSearch`** at the top of `NotesScreen.tsx`.
2. **Call the hook** at component mount; call `rebuildIndex(allNotes)` whenever
   the flat note list changes.
3. **Add a controlled `<input>`** (or existing primitive `Input`) in the action
   bar area, bound to a `query` state string.
4. **Debounce** the query (150–300 ms) before passing to `search()`.
5. **Filter the displayed note list:** when `query` is non-empty, replace the
   grouped note sections with the flat search results; when empty, restore the
   grouped view.
6. **Show "No results"** message when `query` is non-empty and results are empty.
7. Keep existing action bar buttons (Quick Note, Quick NPC, Location, Link Note)
   intact — place the search input before or after them.

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| SR-02-AC-1 | A text input is rendered and visible on the Notes screen | Visual / DOM query |
| SR-02-AC-2 | Typing a term that matches a note title/tag/body causes that note to appear and non-matching notes to be hidden | Functional test |
| SR-02-AC-3 | Clearing the input (empty string) restores the full grouped note list | Functional test |
| SR-02-AC-4 | When search returns zero results, a "No results" (or equivalent) message is displayed | DOM assertion |
| SR-02-AC-5 | `npx tsc --noEmit` exits 0 | CI gate |
| SR-02-AC-6 | `npm run build` exits 0 | CI gate |

### Constraints

- Do **not** rewrite `useNoteSearch.ts` — only consume its public API.
- Debounce must be implemented without shell tooling (use `setTimeout` / `useRef`).
- Cross-platform: no OS-specific file paths or line endings.

---

## Sub-Spec 2 — Complete "Clear All Data" (DB-11)

**Severity:** FAIL
**Score weight:** 1 / 3
**Source files:**
- `src/screens/SettingsScreen.tsx` — `handleClearAll` function (lines ~55–63)

### Problem Statement

`handleClearAll` only clears `characters`, `referenceNotes`, and `appSettings`.
Nine other Dexie tables retain user data: `campaigns`, `sessions`, `notes`,
`entityLinks`, `parties`, `partyMembers`, `attachments`, `metadata`, `systems`.
After a clear the app is in an inconsistent state (campaigns list shows stale
data, session screen shows old sessions, etc.).

### Current Code (to be replaced)

```typescript
async function handleClearAll() {
  if (confirmText !== 'DELETE') return;
  await db.characters.clear();
  await db.referenceNotes.clear();
  await db.appSettings.clear();
  setClearStep(0);
  setConfirmText('');
  navigate('/library');
}
```

### Implementation Plan

Add `db.<table>.clear()` calls for all user-content tables. Preserve `metadata`
and `systems` (system-level seed data, not user content) — these are optional
per the bug report but should be left intact by default.

**Tables to clear (required):**
`characters`, `referenceNotes`, `appSettings`, `campaigns`, `sessions`, `notes`,
`entityLinks`, `parties`, `partyMembers`, `attachments`

**Tables to preserve (optional / system data):**
`metadata`, `systems`

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| DB-11-AC-1 | After "Clear All Data", navigating to `/session` shows "No campaigns" empty state | Integration / E2E |
| DB-11-AC-2 | After "Clear All Data", navigating to `/notes` shows empty notes state | Integration / E2E |
| DB-11-AC-3 | After "Clear All Data", navigating to `/library` shows empty character library | Integration / E2E |
| DB-11-AC-4 | All 10 user-content tables are cleared (verified via `db.<table>.count() === 0`) | Unit / DB assertion |
| DB-11-AC-5 | `npx tsc --noEmit` exits 0 | CI gate |
| DB-11-AC-6 | `npm run build` exits 0 | CI gate |

### Constraints

- Use the existing `db.tableName.clear()` Dexie pattern — no raw IndexedDB calls.
- All clears should be `await`-ed before navigation.
- No shell commands; no file-system operations.

---

## Sub-Spec 3 — Cascade Delete partyMembers on Character Delete (EC-08)

**Severity:** PARTIAL
**Score weight:** 1 / 3
**Source files:**
- `src/features/characters/useCharacterActions.ts` — `deleteCharacter` function
- `src/features/campaign/ManagePartyDrawer.tsx` — member row rendering

### Problem Statement

`deleteCharacter(id)` calls `characterRepository.remove(id)` but does **not**
delete associated `partyMembers` rows. Orphaned rows remain in the DB with a
`linkedCharacterId` pointing to a non-existent character. The Manage Party
drawer renders `member.linkedCharacterId` (a raw UUID) when the linked character
lookup fails.

Two independent fixes are required:

#### Fix A — Cascade delete in `useCharacterActions.ts`

Add `await db.partyMembers.where('linkedCharacterId').equals(id).delete()` before
or after `characterRepository.remove(id)`.

#### Fix B — Graceful fallback in `ManagePartyDrawer.tsx`

In the member row, when resolving the display name, fall back to
`"Unknown character"` if no matching character is found, rather than rendering
the raw UUID. This handles orphaned rows that already exist before Fix A is
deployed.

### Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| EC-08-AC-1 | Deleting a character removes all `partyMembers` rows where `linkedCharacterId === deletedCharacter.id` | DB assertion: `db.partyMembers.where(...).count() === 0` after delete |
| EC-08-AC-2 | The Manage Party drawer shows `"Unknown character"` (not a raw UUID) for any orphaned partyMember rows | Visual / DOM assertion |
| EC-08-AC-3 | No `console.error` / uncaught exceptions when viewing a party that contains orphaned members | Console monitoring |
| EC-08-AC-4 | `npx tsc --noEmit` exits 0 | CI gate |
| EC-08-AC-5 | `npm run build` exits 0 | CI gate |

### Constraints

- Do not restructure `useCharacterActions.ts` — only add the cascade delete call.
- Import `db` directly in `useCharacterActions.ts` if not already present, or use
  a repository method if one exists.
- The fallback string `"Unknown character"` must be user-facing (not a technical ID).

---

## Scoring Summary

| Sub-Spec | Scenario | Severity | AC Count | Weight |
|----------|----------|----------|----------|--------|
| 1 — Notes Search UI | SR-02 | FAIL | 6 | 33% |
| 2 — Clear All Data | DB-11 | FAIL | 6 | 33% |
| 3 — Cascade Delete partyMembers | EC-08 | PARTIAL | 5 | 33% |
| **Total** | | | **17** | **100%** |

**Pre-fix score:** 0 / 3 sub-specs passing
**Target score:** 3 / 3 sub-specs passing

---

## Test Plan Reference

Re-run after fixes:

- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/SR-02-minisearch-fulltext.md`
- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/DB-11-clear-all-data.md`
- `docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/EC-08-orphaned-party-members.md`

Also run full suite (`tests/e2e_full_test.py`) to confirm no regressions in the
44 previously-passing scenarios.

---

## Global Constraints (All Sub-Specs)

1. **Correctness over speed** — prefer explicit, readable fixes over clever
   one-liners.
2. **No shell commands** — all fixes must be pure TypeScript / React / Dexie.
3. **Cross-platform** — no OS-specific assumptions (path separators, line
   endings, env vars).
4. **TypeScript strict** — `npx tsc --noEmit` must pass after every change.
5. **Build gate** — `npm run build` must succeed before marking any sub-spec
   complete.
