---
type: phase-spec
sub_spec: 1
title: "Soft-Delete Foundation"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: []
wave: 1
---

# Sub-Spec 1 — Soft-Delete Foundation

## Scope

Add `deletedAt?: string` and `softDeletedBy?: string` columns to every domain entity Zod schema. Create a shared `excludeDeleted` helper. Add `softDelete` / `restore` / `hardDelete` methods to every domain repository. Route every existing read method through `excludeDeleted` (or an inline filter) so deleted rows never leak to the UI by default.

## Context

- No sub-spec depends on work done before this; Sub-Spec 1 is the foundation.
- The existing repo pattern is function-exports (not classes), with try/catch wrapping and Zod `safeParse` on reads. Reference: `src/storage/repositories/entityLinkRepository.ts`.
- Id generation: import `generateId` from `src/utils/ids`. Timestamps: import `nowISO` from `src/utils/dates`.
- `CLAUDE.md` at the repo root documents the soft-delete convention authoritatively. Read it.

## Implementation Steps

### Step 1 — Create the shared `softDelete` utility

**File:** `src/utils/softDelete.ts` (new)

Export:

```ts
export function excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deletedAt);
}

import { generateId } from './ids';

export function generateSoftDeleteTxId(): string {
  return generateId();
}
```

Verify: `npm run build` exits zero.

### Step 2 — Add soft-delete fields to every domain Zod schema

Add `deletedAt: z.string().optional()` and `softDeletedBy: z.string().optional()` to every schema in:

- `src/types/session.ts`
- `src/types/encounter.ts` (on the top-level `Encounter`; NOT on nested `EncounterParticipant`)
- `src/types/note.ts`
- `src/types/creatureTemplate.ts`
- `src/types/character.ts`
- `src/types/party.ts` (both `Party` and `PartyMember` if separate)
- `src/types/campaign.ts`
- `src/types/entityLink.ts`

Place the two fields consistently at the end of each schema, after existing timestamp fields (`createdAt`, `updatedAt`).

Verify: `npm run build` exits zero — TypeScript inferred types automatically pick up the new optional fields.

### Step 3 — Add Dexie indexes for `deletedAt` (optional but recommended)

In `src/storage/db/client.ts`, for the new version 8 (to be declared in Sub-Spec 2), the index list will be extended. Do **not** touch `client.ts` in this sub-spec — Sub-Spec 2 owns it. The helper and Zod additions here are forward-compatible: they work even while the database is still at v7.

### Step 4 — Extend every repository with soft-delete methods

For each repository listed below, add three functions using the existing function-export pattern. Route all existing `toArray()` reads through `excludeDeleted`. Update `getById` / `getBy*` variants to return `undefined` (or null) when the row is soft-deleted.

**Repositories to update:**

1. `src/storage/repositories/sessionRepository.ts`
2. `src/storage/repositories/encounterRepository.ts`
3. `src/storage/repositories/noteRepository.ts`
4. `src/storage/repositories/creatureTemplateRepository.ts`
5. `src/storage/repositories/characterRepository.ts`
6. `src/storage/repositories/partyRepository.ts`
7. `src/storage/repositories/campaignRepository.ts`
8. `src/storage/repositories/entityLinkRepository.ts`

**Per-repo pattern (template):**

```ts
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';

// --- existing read methods: wrap return values in excludeDeleted ---

export async function getAll(options?: { includeDeleted?: boolean }): Promise<Foo[]> {
  try {
    const rows = await db.foos.toArray();
    const parsed = rows
      .map((r) => fooSchema.safeParse(r))
      .filter((p): p is { success: true; data: Foo } => p.success)
      .map((p) => p.data);
    return options?.includeDeleted ? parsed : excludeDeleted(parsed);
  } catch (e) {
    throw new Error(`fooRepository.getAll failed: ${e}`);
  }
}

export async function getById(id: string, options?: { includeDeleted?: boolean }): Promise<Foo | undefined> {
  try {
    const row = await db.foos.get(id);
    if (!row) return undefined;
    const parsed = fooSchema.safeParse(row);
    if (!parsed.success) return undefined;
    if (!options?.includeDeleted && parsed.data.deletedAt) return undefined;
    return parsed.data;
  } catch (e) {
    throw new Error(`fooRepository.getById failed: ${e}`);
  }
}

// --- new soft-delete trio ---

export async function softDelete(id: string, txId?: string): Promise<void> {
  try {
    const row = await db.foos.get(id);
    if (!row) return; // silent no-op for non-existent
    if (row.deletedAt) return; // silent no-op for already-deleted
    const finalTxId = txId ?? generateSoftDeleteTxId();
    await db.foos.update(id, {
      deletedAt: nowISO(),
      softDeletedBy: finalTxId,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`fooRepository.softDelete failed: ${e}`);
  }
}

export async function restore(id: string): Promise<void> {
  try {
    const row = await db.foos.get(id);
    if (!row) return;
    if (!row.deletedAt) return; // silent no-op for non-deleted
    await db.foos.update(id, {
      deletedAt: undefined,
      softDeletedBy: undefined,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`fooRepository.restore failed: ${e}`);
  }
}

export async function hardDelete(id: string): Promise<void> {
  try {
    await db.foos.delete(id);
  } catch (e) {
    throw new Error(`fooRepository.hardDelete failed: ${e}`);
  }
}
```

**Per-repo work:** for each repo, identify every existing read method (any function that calls `.toArray()`, `.get()`, `.where(...).equals(...).toArray()`, `.where(...).toArray()`, etc.) and wrap results in `excludeDeleted` (or filter `!r.deletedAt` inline). Add the `includeDeleted` option where it makes sense.

Special notes:
- `entityLinkRepository.ts` — the existing `getLinksFrom`, `getLinksTo`, `getAllLinksFrom`, `getAllLinksTo` all need to filter out soft-deleted edges. This is critical: a soft-deleted edge must not appear in any encounter load or note reassignment query.
- `sessionRepository.ts` — update `getBySession` / `getByCampaign` / any other bulk reads.
- `noteRepository.ts` — update `getBySession`, `getByCampaign`, anything that returns notes.

Verify after each repo update: `npm run build` exits zero.

### Step 5 — Rename `deleteLinksForNote` → `softDeleteLinksForNote` (or wrap)

`entityLinkRepository.ts:113` exports `deleteLinksForNote` which currently hard-deletes. Change its behavior to soft-delete (set `deletedAt` + `softDeletedBy`) OR add a new `softDeleteLinksForNote` and deprecate the old one.

**Recommended:** rename and update the single existing caller. Grep for callers first:

```bash
grep -rn "deleteLinksForNote" src/
```

Update each caller. The behavior change is: the function now soft-deletes. If any caller explicitly wanted hard-delete, introduce `hardDeleteLinksForNote` as a new internal-only function.

Verify: `npm run build` exits zero.

### Step 6 — Final local validation

Run the full verification loop:

```bash
npm run build
npm run lint
```

Both must exit zero.

### Step 7 — Commit

Suggested message:

```
feat(storage): soft-delete foundation across all repositories

- Add deletedAt/softDeletedBy fields to every domain Zod schema
- Create src/utils/softDelete.ts with excludeDeleted + tx id helper
- Add softDelete/restore/hardDelete methods to every domain repository
- Route every repo read through excludeDeleted by default
- softDelete and restore are idempotent (silent no-op on wrong state)
- Rename deleteLinksForNote to soft-delete behavior

Foundation for the encounter-notes-folder unification. User-facing
delete buttons will now route through softDelete. Restore UI and
trash view are planned for a later phase.
```

## Interface Contracts

### excludeDeleted
- Direction: Sub-Spec 1 → Sub-Specs 3, 4, 5, 6, 7, 8
- Owner: Sub-Spec 1
- Shape: `excludeDeleted<T extends { deletedAt?: string }>(rows: T[]): T[]`
- Location: `src/utils/softDelete.ts`

### generateSoftDeleteTxId
- Direction: Sub-Spec 1 → Sub-Specs 3, 5
- Owner: Sub-Spec 1
- Shape: `generateSoftDeleteTxId(): string`
- Location: `src/utils/softDelete.ts`

### `softDelete` / `restore` / `hardDelete` on every repo
- Direction: Sub-Spec 1 → Sub-Specs 3, 5, 7, 9
- Owner: Sub-Spec 1
- Shape: `softDelete(id: string, txId?: string): Promise<void>`, `restore(id: string): Promise<void>`, `hardDelete(id: string): Promise<void>`
- Idempotency: softDelete is a silent no-op on already-deleted or nonexistent ids; restore is a silent no-op on non-deleted or nonexistent ids.

### Schema fields `deletedAt?`, `softDeletedBy?`
- Direction: Sub-Spec 1 → Sub-Spec 2 (migration), all others (downstream reads)
- Owner: Sub-Spec 1
- Shape: `deletedAt?: string; softDeletedBy?: string` on every domain Zod schema
- Location: every file in `src/types/` listed in Step 2

## Verification Commands

### Build and lint
```bash
npm run build
npm run lint
```

### Mechanical checks (all must pass)
```bash
# Helper exists
test -f src/utils/softDelete.ts || (echo "FAIL: src/utils/softDelete.ts not found" && exit 1)

# excludeDeleted is exported
grep -q "export function excludeDeleted" src/utils/softDelete.ts || (echo "FAIL: excludeDeleted not exported" && exit 1)

# Every domain schema has deletedAt and softDeletedBy
for f in src/types/session.ts src/types/encounter.ts src/types/note.ts src/types/creatureTemplate.ts src/types/character.ts src/types/party.ts src/types/campaign.ts src/types/entityLink.ts; do
  grep -q "deletedAt" "$f" || (echo "FAIL: $f missing deletedAt" && exit 1)
  grep -q "softDeletedBy" "$f" || (echo "FAIL: $f missing softDeletedBy" && exit 1)
done

# Every repo has softDelete, restore, hardDelete
for f in src/storage/repositories/sessionRepository.ts src/storage/repositories/encounterRepository.ts src/storage/repositories/noteRepository.ts src/storage/repositories/creatureTemplateRepository.ts src/storage/repositories/characterRepository.ts src/storage/repositories/partyRepository.ts src/storage/repositories/campaignRepository.ts src/storage/repositories/entityLinkRepository.ts; do
  grep -q "export async function softDelete" "$f" || (echo "FAIL: $f missing softDelete" && exit 1)
  grep -q "export async function restore" "$f" || (echo "FAIL: $f missing restore" && exit 1)
  grep -q "export async function hardDelete" "$f" || (echo "FAIL: $f missing hardDelete" && exit 1)
done

# Repositories import excludeDeleted
grep -rln "excludeDeleted" src/storage/repositories/ | wc -l | xargs -I N test N -ge 8 || (echo "FAIL: fewer than 8 repos import excludeDeleted" && exit 1)
```

### Behavioral checks (exercise via dev app or scratch script)

Create a temporary script `scripts/verify-sub-spec-1.ts` (delete after verification):

```ts
import { db } from '../src/storage/db/client';
import * as noteRepo from '../src/storage/repositories/noteRepository';

// seed a note
const note = await db.notes.add({ id: 'test-1', /* ... */ });

// soft delete
await noteRepo.softDelete('test-1');
const readBack = await noteRepo.getById('test-1');
console.assert(readBack === undefined, 'soft-deleted note should be hidden from default read');

const withDeleted = await noteRepo.getById('test-1', { includeDeleted: true });
console.assert(withDeleted !== undefined, 'includeDeleted: true should return the row');
console.assert(withDeleted?.deletedAt !== undefined, 'deletedAt should be set');

// idempotency: second soft-delete is no-op
const beforeDeletedAt = withDeleted?.deletedAt;
await noteRepo.softDelete('test-1');
const again = await noteRepo.getById('test-1', { includeDeleted: true });
console.assert(again?.deletedAt === beforeDeletedAt, 'second softDelete should be a no-op');

// restore
await noteRepo.restore('test-1');
const restored = await noteRepo.getById('test-1');
console.assert(restored !== undefined, 'restored note should be visible again');
console.assert(restored?.deletedAt === undefined, 'deletedAt should be cleared');

// idempotency: second restore is no-op
await noteRepo.restore('test-1');
console.log('Sub-Spec 1 verification passed');
```

This scratch script is for the agent's local verification; delete it after running and confirming output.

## Checks

Auto-generated from `[MECHANICAL]` and `[STRUCTURAL]` criteria.

| Criterion | Type | Command |
|-----------|------|---------|
| `src/utils/softDelete.ts` exists | [STRUCTURAL] | `test -f src/utils/softDelete.ts \|\| (echo "FAIL: softDelete helper not found" && exit 1)` |
| `excludeDeleted` exported from helper | [STRUCTURAL] | `grep -q "export function excludeDeleted" src/utils/softDelete.ts \|\| (echo "FAIL: excludeDeleted not exported" && exit 1)` |
| Every Zod schema has `deletedAt` and `softDeletedBy` | [STRUCTURAL] | `for f in src/types/{session,encounter,note,creatureTemplate,character,party,campaign,entityLink}.ts; do grep -q "deletedAt" "$f" && grep -q "softDeletedBy" "$f" \|\| (echo "FAIL: $f missing soft delete fields" && exit 1); done` |
| Every repo exports `softDelete` | [STRUCTURAL] | `for f in src/storage/repositories/{session,encounter,note,creatureTemplate,character,party,campaign,entityLink}Repository.ts; do grep -q "export async function softDelete" "$f" \|\| (echo "FAIL: $f missing softDelete" && exit 1); done` |
| Every repo exports `restore` | [STRUCTURAL] | `for f in src/storage/repositories/{session,encounter,note,creatureTemplate,character,party,campaign,entityLink}Repository.ts; do grep -q "export async function restore" "$f" \|\| (echo "FAIL: $f missing restore" && exit 1); done` |
| Every repo exports `hardDelete` | [STRUCTURAL] | `for f in src/storage/repositories/{session,encounter,note,creatureTemplate,character,party,campaign,entityLink}Repository.ts; do grep -q "export async function hardDelete" "$f" \|\| (echo "FAIL: $f missing hardDelete" && exit 1); done` |
| At least 8 repos import excludeDeleted | [MECHANICAL] | `[ $(grep -l "excludeDeleted" src/storage/repositories/*.ts \| wc -l) -ge 8 ] \|\| (echo "FAIL: excludeDeleted not imported in all repos" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
