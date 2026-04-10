# Phase Spec — SS-03: Cascade Delete partyMembers on Character Delete (EC-08)

**Run:** 2026-03-31T16-49-14-design-doc
**Sub-Spec:** SS-03
**Scenario:** EC-08
**Severity:** PARTIAL
**Score Weight:** 1 / 3
**Dependency:** None — implement independently. Both Fix A and Fix B must be
applied together in this sub-spec; they are independent of SS-01 and SS-02.

---

## Context

`deleteCharacter(id)` removes the character record but does **not** delete
associated `partyMembers` rows. Orphaned rows remain in the DB with a
`linkedCharacterId` pointing to a non-existent character. The Manage Party
drawer renders the raw UUID when the linked character lookup fails, instead of
a friendly fallback.

Two independent fixes are required and must both be implemented in this sub-spec:

- **Fix A** — Cascade delete in `useCharacterActions.ts`
- **Fix B** — Graceful fallback in `ManagePartyDrawer.tsx`

---

## Files to Modify

| File | Action |
|------|--------|
| `src/features/characters/useCharacterActions.ts` | Add cascade delete of `partyMembers` rows |
| `src/features/campaign/ManagePartyDrawer.tsx` | Add "Unknown character" fallback for orphaned members |

---

## Implementation Steps

### Fix A — Cascade Delete (`useCharacterActions.ts`)

1. **Read `src/features/characters/useCharacterActions.ts`** in full to locate
   the `deleteCharacter` function and understand what imports already exist.

2. **Check whether `db` is already imported.** If not, add the import:
   ```typescript
   import { db } from '../../db'; // adjust path to match project structure
   ```
   Alternatively, if a `partyMemberRepository` or similar exists, use that.
   Prefer the direct `db` import if no repository method covers this.

3. **Add the cascade delete** inside `deleteCharacter`, before or after the
   `characterRepository.remove(id)` call:
   ```typescript
   async function deleteCharacter(id: string) {
     // Cascade: remove all partyMembers linked to this character
     await db.partyMembers.where('linkedCharacterId').equals(id).delete();
     // Remove the character itself
     await characterRepository.remove(id);
   }
   ```
   If `deleteCharacter` already has other async operations, maintain the
   existing `await` ordering — just insert the cascade delete call.

4. **Do not restructure** the rest of `useCharacterActions.ts`. Only add the
   one cascade delete line (and the `db` import if missing).

---

### Fix B — Graceful Fallback (`ManagePartyDrawer.tsx`)

5. **Read `src/features/campaign/ManagePartyDrawer.tsx`** in full to locate:
   - Where member rows are rendered
   - How the display name is resolved from `member.linkedCharacterId`
   - What data source (local state, hook, query) provides the character lookup

6. **Find the display name expression.** It likely looks like one of:
   ```typescript
   characters.find(c => c.id === member.linkedCharacterId)?.name
   // or
   characterMap[member.linkedCharacterId]?.name
   // or
   member.linkedCharacterId  // ← the bug: raw UUID rendered directly
   ```

7. **Add a fallback** so that if the character lookup returns `undefined`, the
   string `"Unknown character"` is shown instead of the raw UUID:
   ```typescript
   const displayName =
     characters.find(c => c.id === member.linkedCharacterId)?.name
     ?? 'Unknown character';
   ```
   Replace every location in the render path where the raw `linkedCharacterId`
   could be displayed to the user.

8. **Ensure no `console.error` is thrown** for orphaned members — the fallback
   should be silent and graceful.

---

### Shared Verification Steps

9. **Verify TypeScript:** `npx tsc --noEmit` exits 0 after both fixes.

10. **Verify build:** `npm run build` succeeds after both fixes.

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| EC-08-AC-1 | Deleting a character removes all `partyMembers` rows where `linkedCharacterId === deletedCharacter.id` | DB assertion: `db.partyMembers.where('linkedCharacterId').equals(id).count() === 0` after delete |
| EC-08-AC-2 | The Manage Party drawer shows `"Unknown character"` (not a raw UUID) for any orphaned partyMember rows | Visual / DOM assertion |
| EC-08-AC-3 | No `console.error` / uncaught exceptions when viewing a party that contains orphaned members | Console monitoring |
| EC-08-AC-4 | `npx tsc --noEmit` exits 0 | CI gate |
| EC-08-AC-5 | `npm run build` exits 0 | CI gate |

---

## Verification Commands

```bash
npx tsc --noEmit
npm run build
```

For manual/E2E verification, reference the holdout test plan:
`docs/tests/2026-03-31-skaldmark-full-coverage/.holdout/EC-08-orphaned-party-members.md`

---

## Constraints

- Do **not** restructure `useCharacterActions.ts` — only add the cascade delete
  call and, if necessary, the `db` import.
- The fallback string must be `"Unknown character"` (user-facing, not a UUID or
  technical identifier).
- Use the existing `db.partyMembers.where('linkedCharacterId').equals(id).delete()`
  Dexie query pattern — no raw IndexedDB calls.
- Cross-platform: no OS-specific assumptions (path separators, line endings, env vars).
- TypeScript strict mode must remain satisfied after both fixes.
