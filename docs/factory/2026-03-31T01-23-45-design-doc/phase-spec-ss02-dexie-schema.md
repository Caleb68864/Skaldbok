# Phase Spec — SS-02: Dexie v3 Schema Migration

```yaml
sub-spec: SS-02
title: Dexie v3 Schema Migration
stage: 1
priority: P0
score: 96
depends-on: none
run: 2026-03-31T01-23-45-design-doc
```

> **Dependency Order:** No upstream dependencies. This is the foundation sub-spec. SS-03, SS-04, SS-07, SS-08, SS-09, SS-10, and SS-11 all depend on this sub-spec being complete before they can read/write the new tables. Implement and verify SS-02 first.

---

## Intent

Extend the Dexie database in one clean migration that adds all six new tables with correct indexes. Existing tables must be untouched. The schema must be production-correct on first write — migrations are not easily reversible in IndexedDB.

---

## Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-S2-01 | Dexie version increments to **3**. Upgrade function adds exactly these tables (existing tables unchanged): `campaigns` (indexed: id, status, updatedAt), `sessions` (indexed: id, campaignId, status, date), `notes` (indexed: id, campaignId, sessionId, type, status, pinned), `entityLinks` (see AC-S2-03), `parties` (indexed: id, campaignId), `partyMembers` (indexed: id, partyId, linkedCharacterId). |
| AC-S2-02 | Existing tables are **NOT** modified, dropped, or re-indexed: `characters`, `systems`, `appSettings`, `referenceNotes`, `metadata`. (`referenceNotes` intentionally preserved — drop deferred to a future migration.) |
| AC-S2-03 | `entityLinks` table uses the Dexie schema string: `'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType'`. Both compound indexes are present and queryable. |
| AC-S2-04 | Zod schemas exist in `src/types/` for all new record types: `campaignSchema`, `sessionSchema`, `noteSchema` (discriminated union on `note.type` for `typeData`), `entityLinkSchema`, `partySchema`, `partyMemberSchema`. Each schema matches the TypeScript interface for its domain type. `noteSchema` discriminated union covers at minimum: `generic`, `npc`, `combat`. |
| AC-S2-05 | Repository read functions (AC-S4) validate records against Zod schemas on read. A record failing validation logs a warning and returns `undefined` rather than throwing. |
| AC-S2-06 | After running the migration in a browser, IndexedDB inspector shows all 6 new object stores with the correct key paths. (Verified manually during Stage 1 sign-off.) |
| AC-S2-07 | No TypeScript errors in db schema definition file. |

---

## Implementation Steps

1. **Open `src/storage/db/client.ts`**
   - Locate the existing `db.version(2)` block (do not touch version 1 or 2 blocks)
   - Add a new `db.version(3).stores({ ... })` block

2. **Version 3 `.stores()` call — add ONLY new tables, pass `null` for none of the old ones**
   ```ts
   db.version(3).stores({
     campaigns:    'id, status, updatedAt',
     sessions:     'id, campaignId, status, date',
     notes:        'id, campaignId, sessionId, type, status, pinned',
     entityLinks:  'id, [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType',
     parties:      'id, campaignId',
     partyMembers: 'id, partyId, linkedCharacterId',
   });
   ```
   > Do NOT include existing table names in this `.stores()` call unless you are intentionally modifying them (you are not).

3. **Create `src/types/campaign.ts`**
   - Define `CampaignStatus` type: `'active' | 'archived'`
   - Define `Campaign` interface extending `Timestamped` and `Versioned`
   - Fields: `id: string`, `name: string`, `description?: string`, `system: string` (default `'dragonbane'`), `status: CampaignStatus`, `activeSessionId?: string`, `activePartyId?: string`
   - Export `campaignSchema` (Zod) matching the interface
   - Export `Campaign` type inferred from schema

4. **Create `src/types/session.ts`**
   - Define `SessionStatus` type: `'active' | 'ended'`
   - Define `Session` interface
   - Fields: `id: string`, `campaignId: string`, `title: string`, `status: SessionStatus`, `date: string` (ISO date), `startedAt: string`, `endedAt?: string`
   - Export `sessionSchema` (Zod) and `Session` type

5. **Create `src/types/note.ts`**
   - Define `NoteStatus` type: `'active' | 'archived'`
   - Define base note fields: `id`, `campaignId`, `sessionId?`, `title`, `body` (ProseMirror JSON object), `type`, `status`, `pinned: boolean`, timestamps
   - Define discriminated union variants:
     ```ts
     // generic
     z.object({ type: z.literal('generic'), typeData: z.object({}).optional() })
     // npc
     z.object({ type: z.literal('npc'), typeData: z.object({ role: z.string().optional(), affiliation: z.string().optional() }) })
     // combat — structured schema (contract with SS-11 Combat Timeline)
     z.object({
       type: z.literal('combat'),
       typeData: z.object({
         rounds: z.array(z.object({
           roundNumber: z.number(),
           events: z.array(z.object({
             id: z.string(),
             type: z.enum(['attack', 'spell', 'ability', 'damage', 'heal', 'condition', 'note', 'round-separator']),
             description: z.string().optional(),
             actorName: z.string().optional(),
             actorId: z.string().optional(),
             timestamp: z.string(),
             metadata: z.record(z.unknown()).optional(),
           })),
         })),
         participants: z.array(z.object({
           id: z.string(),
           name: z.string(),
           type: z.enum(['pc', 'npc', 'monster']),
           linkedCharacterId: z.string().optional(),
         })),
       }),
     })
     ```
   - Export `noteSchema = z.discriminatedUnion('type', [...])` and `Note` type
   - Export `NoteType` as `z.infer<typeof noteSchema>['type']`

6. **Create `src/types/entityLink.ts`**
   - Fields: `id`, `fromEntityId`, `fromEntityType`, `toEntityId`, `toEntityType`, `relationshipType: string`, timestamps
   - Export `entityLinkSchema` and `EntityLink` type

7. **Create `src/types/party.ts`**
   - Define `Party` interface: `id`, `campaignId`, `name?`, timestamps
   - Define `PartyMember` interface: `id`, `partyId`, `linkedCharacterId?`, `name?`, `isActivePlayer: boolean`, timestamps
   - Export `partySchema`, `partyMemberSchema`, `Party`, `PartyMember` types

8. **Verify base types exist**
   - Confirm `Timestamped` and `Versioned` base types exist in `src/types/` (or wherever the existing pattern lives)
   - If they don't exist, create a minimal `src/types/base.ts` with these interfaces following the existing pattern

9. **Manual browser verification (AC-S2-06)**
   - Open app in browser, open DevTools → Application → IndexedDB
   - Confirm 6 new object stores appear with correct indexes

---

## Verification Commands

```
# TypeScript check
npx tsc --noEmit

# Manual browser check (DevTools → Application → IndexedDB):
# Confirm the following object stores exist with correct key paths:
#   campaigns     → keyPath: id, indexes: status, updatedAt
#   sessions      → keyPath: id, indexes: campaignId, status, date
#   notes         → keyPath: id, indexes: campaignId, sessionId, type, status, pinned
#   entityLinks   → keyPath: id, indexes: [fromEntityId+relationshipType], [toEntityId+relationshipType], fromEntityType, toEntityType
#   parties       → keyPath: id, indexes: campaignId
#   partyMembers  → keyPath: id, indexes: partyId, linkedCharacterId
```

---

## Files to Create / Modify

| Action | Path |
|--------|------|
| **Modify** | `src/storage/db/client.ts` — add `db.version(3).stores({...})` block |
| **Create** | `src/types/campaign.ts` |
| **Create** | `src/types/session.ts` |
| **Create** | `src/types/note.ts` |
| **Create** | `src/types/entityLink.ts` |
| **Create** | `src/types/party.ts` |
| **Create** | `src/types/base.ts` (only if `Timestamped`/`Versioned` don't already exist) |

---

## Cross-Cutting Constraints (apply to this sub-spec)

- `XC-01` Zero TypeScript errors
- `XC-02` All new IDs use `generateId()` from `src/utils/ids.ts`; timestamps use `nowISO()` from `src/utils/dates.ts`
- `XC-04` Named exports only
- **AC-S2-05** is a constraint for SS-04 (repository reads validate against Zod), but the Zod schemas themselves are deliverables of this sub-spec
