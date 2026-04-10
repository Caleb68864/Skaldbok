# Phase Spec — SS-02: Complete "Clear All Data" (DB-11)

**Run:** 2026-03-31T16-49-14-design-doc
**Sub-Spec:** SS-02
**Scenario:** DB-11
**Severity:** FAIL
**Score Weight:** 1 / 3
**Dependency:** None — implement independently.

---

## Context

`handleClearAll` in `SettingsScreen.tsx` only clears 3 of 12 Dexie tables
(`characters`, `referenceNotes`, `appSettings`). Nine other tables retain user
data after a "Clear All Data" action, leaving the app in an inconsistent state:
campaigns list shows stale data, session screen shows old sessions, etc.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/screens/SettingsScreen.tsx` | Replace `handleClearAll` body with full table clear |

---

## Implementation Steps

1. **Read `src/screens/SettingsScreen.tsx`** in full, specifically around
   `handleClearAll` (currently lines ~55–63), to understand the surrounding
   context: imports, `db` reference, navigation call, state resets.

2. **Confirm `db` import** is already present. If `db` is imported from a
   central location (e.g., `src/db.ts` or `src/lib/db.ts`), no new import is
   needed.

3. **Replace** the existing `handleClearAll` body with the following pattern,
   preserving the `confirmText !== 'DELETE'` guard and post-clear state resets:

   ```typescript
   async function handleClearAll() {
     if (confirmText !== 'DELETE') return;

     // Clear all user-content tables
     await db.characters.clear();
     await db.referenceNotes.clear();
     await db.appSettings.clear();
     await db.campaigns.clear();
     await db.sessions.clear();
     await db.notes.clear();
     await db.entityLinks.clear();
     await db.parties.clear();
     await db.partyMembers.clear();
     await db.attachments.clear();
     // db.metadata and db.systems are system/seed data — preserve them

     setClearStep(0);
     setConfirmText('');
     navigate('/library');
   }
   ```

4. **Verify all table names** match the actual Dexie schema. Read `src/db.ts`
   (or wherever the Dexie instance is defined) to confirm exact property names
   before writing. Common mismatches: `entityLink` vs `entityLinks`,
   `attachment` vs `attachments`.

5. **Ensure every `clear()` call is `await`-ed** — navigation must not fire
   until all tables are cleared.

6. **Verify TypeScript:** `npx tsc --noEmit` must exit 0.

7. **Verify build:** `npm run build` must succeed.

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| DB-11-AC-1 | After "Clear All Data", navigating to `/session` shows "No campaigns" empty state | Integration / E2E |
| DB-11-AC-2 | After "Clear All Data", navigating to `/notes` shows empty notes state | Integration / E2E |
| DB-11-AC-3 | After "Clear All Data", navigating to `/library` shows empty character library | Integration / E2E |
| DB-11-AC-4 | All 10 user-content tables are cleared (verified via `db.<table>.count() === 0`) | Unit / DB assertion |
| DB-11-AC-5 | `npx tsc --noEmit` exits 0 | CI gate |
| DB-11-AC-6 | `npm run build` exits 0 | CI gate |

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

For manual/E2E verification, reference the holdout test plan:
`docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/DB-11-clear-all-data.md`

---

## Tables Reference

| Table | Clear? | Reason |
|-------|--------|--------|
| `characters` | ✅ Yes | User content |
| `referenceNotes` | ✅ Yes | User content |
| `appSettings` | ✅ Yes | User content |
| `campaigns` | ✅ Yes | User content |
| `sessions` | ✅ Yes | User content |
| `notes` | ✅ Yes | User content |
| `entityLinks` | ✅ Yes | User content |
| `parties` | ✅ Yes | User content |
| `partyMembers` | ✅ Yes | User content |
| `attachments` | ✅ Yes | User content |
| `metadata` | ❌ Preserve | System/seed data |
| `systems` | ❌ Preserve | System/seed data |

---

## Constraints

- Use the existing `db.tableName.clear()` Dexie pattern — no raw IndexedDB calls.
- All clears must be `await`-ed before the `navigate()` call.
- No shell commands; no file-system operations.
- Cross-platform: no OS-specific assumptions.
- TypeScript strict mode must remain satisfied.
