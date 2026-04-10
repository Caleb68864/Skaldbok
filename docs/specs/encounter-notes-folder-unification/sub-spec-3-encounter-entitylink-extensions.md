---
type: phase-spec
sub_spec: 3
title: "Encounter + EntityLink Data Layer Extensions"
master_spec: "docs/specs/2026-04-10-encounter-notes-folder-unification.md"
dependencies: [2]
wave: 3
---

# Sub-Spec 3 — Encounter + EntityLink Data Layer Extensions

## Scope

Extend the `Encounter` Zod schema with narrative fields and the segments array. Remove FK columns from `EncounterParticipant`. Add new `encounterRepository` methods for session-scoped queries and segment manipulation. Extend `entityLinkRepository` with the `'encounterParticipant'` entityType and a `softDeleteLinksForEncounter` helper. Wire encounter `softDelete` cascade through the new helper.

## Context

- Sub-Spec 1 added `deletedAt` / `softDeletedBy` to the Zod schemas and basic `softDelete` / `restore` / `hardDelete` methods. This sub-spec extends encounter-specific repo methods on top.
- Sub-Spec 2 migrated existing data to the new shape. This sub-spec's type changes must match what the migration produced.
- The existing `entityLinkRepository.ts:7-10` comment lists valid `entityType` values. Update it.
- `useEncounter.ts:39` already calls `getLinksFrom(encounterId, 'contains')` — that path continues to work and will start returning results once Sub-Spec 5 writes the edges.

## Implementation Steps

### Step 1 — Update `Encounter` Zod schema

**File:** `src/types/encounter.ts`

Add narrative and segments fields to the `Encounter` schema. Remove `startedAt` / `endedAt` scalars if still present (Sub-Spec 2 migrated data, but the schema should match the new shape). Remove `linkedCreatureId` and `linkedCharacterId` from `EncounterParticipant`.

```ts
export const segmentSchema = z.object({
  startedAt: z.string(),
  endedAt: z.string().optional(),
});

export const encounterParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['pc', 'npc', 'monster']),
  // linkedCreatureId and linkedCharacterId REMOVED — use `represents` edges
  instanceState: z.object({
    currentHp: z.number().optional(),
    conditions: z.array(z.string()),
    notes: z.string().optional(),
  }),
  sortOrder: z.number(),
});

export const encounterSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  campaignId: z.string(),
  title: z.string(),
  type: z.enum(['combat', 'social', 'exploration']),
  status: z.enum(['active', 'ended']),
  // --- new narrative fields ---
  description: z.any().optional(), // ProseMirror JSON
  body: z.any().optional(),        // ProseMirror JSON
  summary: z.any().optional(),     // ProseMirror JSON
  tags: z.array(z.string()).default([]),
  location: z.string().optional(),
  // --- new segments array (replaces scalar startedAt/endedAt) ---
  segments: z.array(segmentSchema).default([]),
  // --- participants ---
  participants: z.array(encounterParticipantSchema),
  combatData: z.object({
    currentRound: z.number(),
    events: z.array(z.any()),
  }).optional(),
  // --- shared housekeeping ---
  schemaVersion: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // --- soft delete (from Sub-Spec 1) ---
  deletedAt: z.string().optional(),
  softDeletedBy: z.string().optional(),
});

export type Encounter = z.infer<typeof encounterSchema>;
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
export type Segment = z.infer<typeof segmentSchema>;
```

Verify: `npm run build` exits zero. Any TypeScript errors will surface places where old code uses `encounter.startedAt` or `participant.linkedCreatureId` — those are places that need updating in later sub-specs.

### Step 2 — Add new `encounterRepository` methods

**File:** `src/storage/repositories/encounterRepository.ts`

Add these functions (keeping the existing CRUD):

```ts
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';
import { nowISO } from '../../utils/dates';
import * as entityLinkRepository from './entityLinkRepository';

/**
 * Returns the single active encounter for a session, or null.
 * "Active" = the (non-deleted) encounter whose last segment has no endedAt.
 */
export async function getActiveEncounterForSession(sessionId: string): Promise<Encounter | null> {
  try {
    const rows = await db.encounters.where('sessionId').equals(sessionId).toArray();
    const valid = rows
      .map((r) => encounterSchema.safeParse(r))
      .filter((p): p is { success: true; data: Encounter } => p.success)
      .map((p) => p.data);
    const alive = excludeDeleted(valid);
    const active = alive.find((e) => {
      if (!e.segments || e.segments.length === 0) return false;
      const last = e.segments[e.segments.length - 1];
      return !last.endedAt;
    });
    return active ?? null;
  } catch (e) {
    throw new Error(`encounterRepository.getActiveEncounterForSession failed: ${e}`);
  }
}

/**
 * Returns up to `limit` most-recently-ended encounters for a session.
 * Sorted by the last segment's endedAt descending. Excludes soft-deleted.
 */
export async function getRecentEndedEncountersForSession(
  sessionId: string,
  limit: number,
): Promise<Encounter[]> {
  try {
    const rows = await db.encounters.where('sessionId').equals(sessionId).toArray();
    const valid = rows
      .map((r) => encounterSchema.safeParse(r))
      .filter((p): p is { success: true; data: Encounter } => p.success)
      .map((p) => p.data);
    const alive = excludeDeleted(valid);
    const ended = alive
      .filter((e) => {
        if (!e.segments || e.segments.length === 0) return false;
        const last = e.segments[e.segments.length - 1];
        return !!last.endedAt;
      })
      .sort((a, b) => {
        const aEnd = a.segments[a.segments.length - 1].endedAt ?? '';
        const bEnd = b.segments[b.segments.length - 1].endedAt ?? '';
        return bEnd.localeCompare(aEnd);
      });
    return ended.slice(0, limit);
  } catch (e) {
    throw new Error(`encounterRepository.getRecentEndedEncountersForSession failed: ${e}`);
  }
}

/**
 * Appends a new open segment to an encounter. Throws if the last segment
 * is still open (no endedAt) — invariant: at most one open segment at a time.
 */
export async function pushSegment(
  encounterId: string,
  segment: { startedAt: string },
): Promise<void> {
  try {
    const row = await db.encounters.get(encounterId);
    if (!row) throw new Error(`encounter not found: ${encounterId}`);
    const parsed = encounterSchema.safeParse(row);
    if (!parsed.success) throw new Error(`encounter row invalid: ${encounterId}`);
    const enc = parsed.data;
    if (enc.segments.length > 0 && !enc.segments[enc.segments.length - 1].endedAt) {
      throw new Error(
        `encounterRepository.pushSegment: last segment of ${encounterId} is still open`,
      );
    }
    const newSegments = [...enc.segments, { startedAt: segment.startedAt }];
    await db.encounters.update(encounterId, {
      segments: newSegments,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`encounterRepository.pushSegment failed: ${e}`);
  }
}

/**
 * Sets endedAt on the current open segment of an encounter.
 * Throws if there is no open segment.
 */
export async function endActiveSegment(encounterId: string): Promise<void> {
  try {
    const row = await db.encounters.get(encounterId);
    if (!row) throw new Error(`encounter not found: ${encounterId}`);
    const parsed = encounterSchema.safeParse(row);
    if (!parsed.success) throw new Error(`encounter row invalid: ${encounterId}`);
    const enc = parsed.data;
    if (enc.segments.length === 0) {
      throw new Error(`encounterRepository.endActiveSegment: no segments for ${encounterId}`);
    }
    const last = enc.segments[enc.segments.length - 1];
    if (last.endedAt) {
      throw new Error(
        `encounterRepository.endActiveSegment: last segment of ${encounterId} is already ended`,
      );
    }
    const newSegments = enc.segments.map((s, i) =>
      i === enc.segments.length - 1 ? { ...s, endedAt: nowISO() } : s,
    );
    await db.encounters.update(encounterId, {
      segments: newSegments,
      updatedAt: nowISO(),
    });
  } catch (e) {
    throw new Error(`encounterRepository.endActiveSegment failed: ${e}`);
  }
}
```

### Step 3 — Extend `softDelete` on `encounterRepository` to cascade

Override the basic `softDelete` from Sub-Spec 1 to also call `softDeleteLinksForEncounter`:

```ts
export async function softDelete(encounterId: string, txId?: string): Promise<void> {
  try {
    const finalTxId = txId ?? generateSoftDeleteTxId();
    const now = nowISO();
    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const row = await db.encounters.get(encounterId);
      if (!row) return; // silent no-op
      if (row.deletedAt) return; // idempotent
      await db.encounters.update(encounterId, {
        deletedAt: now,
        softDeletedBy: finalTxId,
        updatedAt: now,
      });
      await entityLinkRepository.softDeleteLinksForEncounter(encounterId, finalTxId, now);
    });
  } catch (e) {
    throw new Error(`encounterRepository.softDelete failed: ${e}`);
  }
}

export async function restore(encounterId: string): Promise<void> {
  try {
    await db.transaction('rw', [db.encounters, db.entityLinks], async () => {
      const row = await db.encounters.get(encounterId);
      if (!row) return;
      if (!row.deletedAt) return;
      const txId = row.softDeletedBy;
      const now = nowISO();
      await db.encounters.update(encounterId, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: now,
      });
      if (txId) {
        await entityLinkRepository.restoreLinksForTxId(txId);
      }
    });
  } catch (e) {
    throw new Error(`encounterRepository.restore failed: ${e}`);
  }
}
```

This REPLACES the generic `softDelete` / `restore` that Sub-Spec 1 added to `encounterRepository`. The generic shape is used for every other entity; encounters get the cascade-aware override.

### Step 4 — Extend `entityLinkRepository` with the new helper and restore helper

**File:** `src/storage/repositories/entityLinkRepository.ts`

Update the top-of-file `entityType` comment:

```ts
// entityType is a free-string field — no whitelist enforced.
// Valid values include: 'note', 'character', 'session', 'campaign',
// 'party', 'partyMember', 'encounter', 'encounterParticipant', 'creature'
// Verified: 2026-04-10 (encounter-notes-folder-unification)
```

Add the two new helpers (and make sure reads filter soft-deleted edges):

```ts
import { excludeDeleted, generateSoftDeleteTxId } from '../../utils/softDelete';

/**
 * Soft-delete every edge where the given encounter is source or target.
 * All edges share the provided txId so they can be restored together.
 */
export async function softDeleteLinksForEncounter(
  encounterId: string,
  txId: string,
  now: string,
): Promise<void> {
  try {
    const fromLinks = await db.entityLinks.where('fromEntityId').equals(encounterId).toArray();
    const toLinks = await db.entityLinks.where('toEntityId').equals(encounterId).toArray();
    const ids = [...fromLinks.map((l) => l.id), ...toLinks.map((l) => l.id)];
    const unique = Array.from(new Set(ids));
    for (const id of unique) {
      await db.entityLinks.update(id, {
        deletedAt: now,
        softDeletedBy: txId,
        updatedAt: now,
      });
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.softDeleteLinksForEncounter failed: ${e}`);
  }
}

/**
 * Restore every edge that was soft-deleted in the given transaction.
 * Clears both deletedAt and softDeletedBy.
 */
export async function restoreLinksForTxId(txId: string): Promise<void> {
  try {
    const rows = await db.entityLinks.where('softDeletedBy').equals(txId).toArray();
    for (const row of rows) {
      await db.entityLinks.update(row.id, {
        deletedAt: undefined,
        softDeletedBy: undefined,
        updatedAt: nowISO(),
      });
    }
  } catch (e) {
    throw new Error(`entityLinkRepository.restoreLinksForTxId failed: ${e}`);
  }
}
```

**Also make sure the existing read methods filter soft-deleted edges.** Sub-Spec 1 already added `excludeDeleted` wrapping to the reads; double-check that `getLinksFrom`, `getLinksTo`, `getAllLinksFrom`, `getAllLinksTo` all route through it.

Verify: `npm run build` exits zero.

### Step 5 — Add Dexie index on `softDeletedBy` to entityLinks

This enables the `.where('softDeletedBy').equals(txId)` query used by `restoreLinksForTxId`. Add it to the Sub-Spec 2 version 8 store declaration if not already there. (This is a Sub-Spec 2 concern, but if it wasn't added, the restore query will fail at runtime. Verify during implementation.)

**Action:** open `src/storage/db/client.ts` and confirm the `entityLinks` store declaration for v8 includes `softDeletedBy` in the index string. If missing, add it:

```ts
entityLinks: '++id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityId, toEntityId, deletedAt, softDeletedBy',
```

### Step 6 — Run build and lint

```bash
npm run build
npm run lint
```

Both must exit zero. TypeScript may surface errors in consumers of the removed `linkedCreatureId` / `linkedCharacterId` fields — those consumers live in later sub-specs' scope, so add `@ts-expect-error` comments ONLY if absolutely needed to get this sub-spec's build green. Prefer to let the errors block and fix them in the owning sub-spec.

### Step 7 — Commit

```
feat(encounter): narrative fields, segments, represents edges

- Add description/body/summary (ProseMirror), tags[], location,
  segments[] to Encounter Zod schema
- Remove linkedCreatureId/linkedCharacterId from EncounterParticipant
  (migrated to represents edges in sub-spec 2)
- Add encounterRepository.getActiveEncounterForSession,
  getRecentEndedEncountersForSession, pushSegment, endActiveSegment
- Override softDelete/restore on encounterRepository to cascade to
  associated edges via softDeleteLinksForEncounter
- Add entityLinkRepository.softDeleteLinksForEncounter + restoreLinksForTxId
- Document 'encounterParticipant' entityType in the repo's valid list
```

## Interface Contracts

### `Encounter` shape (with segments + narrative)
- Direction: Sub-Spec 3 → Sub-Specs 4, 5, 6, 7, 8, 9
- Owner: Sub-Spec 3
- Shape: `Encounter` has `description?`, `body?`, `summary?`, `tags: string[]`, `location?`, `segments: Segment[]` where `Segment = { startedAt: string; endedAt?: string }`. No `linkedCreatureId`/`linkedCharacterId` on `EncounterParticipant`.

### `encounterRepository` new queries
- Direction: Sub-Spec 3 → Sub-Specs 4, 6
- Owner: Sub-Spec 3
- Shape:
  - `getActiveEncounterForSession(sessionId: string): Promise<Encounter | null>`
  - `getRecentEndedEncountersForSession(sessionId: string, limit: number): Promise<Encounter[]>`
  - `pushSegment(id: string, segment: { startedAt: string }): Promise<void>`
  - `endActiveSegment(id: string): Promise<void>`

### `encounterRepository.softDelete` cascade behavior
- Direction: Sub-Spec 3 → Sub-Spec 7 (delete UI)
- Owner: Sub-Spec 3
- Shape: `softDelete(encounterId, txId?)` soft-deletes the encounter AND all associated edges in a single transaction. `restore` brings them back together via the shared `softDeletedBy` UUID.

### `entityLinkRepository.softDeleteLinksForEncounter` + `restoreLinksForTxId`
- Direction: Sub-Spec 3 → Sub-Spec 5 (participant removal)
- Owner: Sub-Spec 3
- Shape:
  - `softDeleteLinksForEncounter(encounterId: string, txId: string, now: string): Promise<void>`
  - `restoreLinksForTxId(txId: string): Promise<void>`

### `'encounterParticipant'` entityType
- Direction: Sub-Spec 3 → Sub-Spec 5 (represents edge creation)
- Owner: Sub-Spec 3
- Shape: the string `'encounterParticipant'` is documented as a valid `fromEntityType` / `toEntityType` for `entityLinks`.

## Verification Commands

### Build and lint
```bash
npm run build
npm run lint
```

### Mechanical checks
```bash
# Encounter has narrative fields
grep -q "description:" src/types/encounter.ts || (echo "FAIL: encounter missing description field" && exit 1)
grep -q "body:" src/types/encounter.ts || (echo "FAIL: encounter missing body field" && exit 1)
grep -q "summary:" src/types/encounter.ts || (echo "FAIL: encounter missing summary field" && exit 1)
grep -q "segments:" src/types/encounter.ts || (echo "FAIL: encounter missing segments field" && exit 1)
grep -q "tags:" src/types/encounter.ts || (echo "FAIL: encounter missing tags field" && exit 1)
grep -q "location:" src/types/encounter.ts || (echo "FAIL: encounter missing location field" && exit 1)

# EncounterParticipant FK columns removed
grep -c "linkedCreatureId\|linkedCharacterId" src/types/encounter.ts | xargs -I N test N -eq 0 || (echo "FAIL: FK columns still present in encounter type" && exit 1)

# New repo methods
grep -q "export async function getActiveEncounterForSession" src/storage/repositories/encounterRepository.ts || (echo "FAIL: getActiveEncounterForSession missing" && exit 1)
grep -q "export async function getRecentEndedEncountersForSession" src/storage/repositories/encounterRepository.ts || (echo "FAIL: getRecentEndedEncountersForSession missing" && exit 1)
grep -q "export async function pushSegment" src/storage/repositories/encounterRepository.ts || (echo "FAIL: pushSegment missing" && exit 1)
grep -q "export async function endActiveSegment" src/storage/repositories/encounterRepository.ts || (echo "FAIL: endActiveSegment missing" && exit 1)

# New entityLink helpers
grep -q "export async function softDeleteLinksForEncounter" src/storage/repositories/entityLinkRepository.ts || (echo "FAIL: softDeleteLinksForEncounter missing" && exit 1)
grep -q "export async function restoreLinksForTxId" src/storage/repositories/entityLinkRepository.ts || (echo "FAIL: restoreLinksForTxId missing" && exit 1)

# encounterParticipant in entityType comment
grep -q "encounterParticipant" src/storage/repositories/entityLinkRepository.ts || (echo "FAIL: encounterParticipant not in entityType comment" && exit 1)
```

## Checks

| Criterion | Type | Command |
|-----------|------|---------|
| Encounter has narrative fields | [STRUCTURAL] | `grep -q "description:" src/types/encounter.ts && grep -q "body:" src/types/encounter.ts && grep -q "summary:" src/types/encounter.ts \|\| (echo "FAIL: encounter narrative fields missing" && exit 1)` |
| Encounter has segments array | [STRUCTURAL] | `grep -q "segments:" src/types/encounter.ts \|\| (echo "FAIL: segments field missing" && exit 1)` |
| Participant FK columns removed | [MECHANICAL] | `[ $(grep -c "linkedCreatureId\|linkedCharacterId" src/types/encounter.ts) -eq 0 ] \|\| (echo "FAIL: FK columns still present" && exit 1)` |
| getActiveEncounterForSession exported | [STRUCTURAL] | `grep -q "export async function getActiveEncounterForSession" src/storage/repositories/encounterRepository.ts \|\| (echo "FAIL: getActiveEncounterForSession missing" && exit 1)` |
| getRecentEndedEncountersForSession exported | [STRUCTURAL] | `grep -q "export async function getRecentEndedEncountersForSession" src/storage/repositories/encounterRepository.ts \|\| (echo "FAIL: getRecentEndedEncountersForSession missing" && exit 1)` |
| pushSegment exported | [STRUCTURAL] | `grep -q "export async function pushSegment" src/storage/repositories/encounterRepository.ts \|\| (echo "FAIL: pushSegment missing" && exit 1)` |
| endActiveSegment exported | [STRUCTURAL] | `grep -q "export async function endActiveSegment" src/storage/repositories/encounterRepository.ts \|\| (echo "FAIL: endActiveSegment missing" && exit 1)` |
| softDeleteLinksForEncounter exported | [STRUCTURAL] | `grep -q "export async function softDeleteLinksForEncounter" src/storage/repositories/entityLinkRepository.ts \|\| (echo "FAIL: softDeleteLinksForEncounter missing" && exit 1)` |
| restoreLinksForTxId exported | [STRUCTURAL] | `grep -q "export async function restoreLinksForTxId" src/storage/repositories/entityLinkRepository.ts \|\| (echo "FAIL: restoreLinksForTxId missing" && exit 1)` |
| encounterParticipant in entityType comment | [STRUCTURAL] | `grep -q "encounterParticipant" src/storage/repositories/entityLinkRepository.ts \|\| (echo "FAIL: encounterParticipant not documented" && exit 1)` |
| Build succeeds | [MECHANICAL] | `npm run build 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: build failed" && exit 1)` |
| Lint succeeds | [MECHANICAL] | `npm run lint 2>&1 \| tail -1; [ ${PIPESTATUS[0]} -eq 0 ] \|\| (echo "FAIL: lint failed" && exit 1)` |
