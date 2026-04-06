# Phase Spec — SS-13: Merge Engine

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 2.5 — Feature B: Merge Engine
**Depends on:** SS-02 (Zod schemas), SS-04 (Repositories), SS-12 (Bundle parser) must be completed first.
**Delivery order note:** Step 13 in execution sequence. Required by SS-15 (hook integration).

---

## Objective

Merge parsed bundle contents into local IndexedDB, resolving conflicts by `updatedAt`, processing entities in FK-safe order, and supporting selective import. Never throw — always return a `MergeReport`. Respect `targetCampaignId` re-parenting for all entities.

---

## File to Create

- `src/utils/import/mergeEngine.ts` — **create new**

---

## Implementation Steps

### Step 1: Define types

```typescript
import { BundleEnvelope, BundleContents } from '../../types/bundle';

export interface MergeOptions {
  targetCampaignId?: string;
  selectedEntityTypes: Set<keyof BundleContents>;
}

export interface MergeError {
  entityType: string;
  entityId: string;
  message: string;
}

export interface MergeReport {
  inserted: number;
  updated: number;
  skipped: number;
  errors: MergeError[];
}
```

### Step 2: Define processing order

The FK-safe processing order is critical. Define it as a constant:

```typescript
const PROCESSING_ORDER: (keyof BundleContents)[] = [
  'campaign',        // Step 1
  'sessions',        // Step 2
  'parties',         // Step 3
  'partyMembers',    // Step 4
  'characters',      // Step 5
  'creatureTemplates', // Step 6
  'encounters',      // Step 7
  'notes',           // Step 8
  'entityLinks',     // Step 9
  'attachments',     // Step 10
];
```

### Step 3: Implement `mergeBundle`

```typescript
export async function mergeBundle(
  bundle: BundleEnvelope,
  options: MergeOptions
): Promise<MergeReport> {
  const report: MergeReport = { inserted: 0, updated: 0, skipped: 0, errors: [] };

  try {
    for (const entityType of PROCESSING_ORDER) {
      // Skip if not selected
      if (!options.selectedEntityTypes.has(entityType)) continue;

      const entities = getEntities(bundle.contents, entityType);
      if (!entities || entities.length === 0) continue;

      for (const entity of entities) {
        try {
          await mergeEntity(entity, entityType, options, report);
        } catch (err) {
          report.errors.push({
            entityType,
            entityId: (entity as any).id ?? 'unknown',
            message: String(err),
          });
        }
      }
    }
  } catch (err) {
    report.errors.push({ entityType: 'unknown', entityId: 'unknown', message: String(err) });
  }

  return report;
}
```

### Step 4: Implement entity-level merge logic

```typescript
async function mergeEntity(
  entity: Record<string, unknown>,
  entityType: keyof BundleContents,
  options: MergeOptions,
  report: MergeReport
): Promise<void> {
  const id = entity.id as string;
  if (!id) {
    report.errors.push({ entityType, entityId: 'no-id', message: 'Entity missing id field' });
    return;
  }

  // Apply re-parenting
  const reparented = applyReparenting(entity, entityType, options.targetCampaignId, bundle.contents);

  // Look up existing entity in IndexedDB
  const existing = await getEntityById(entityType, id);

  if (!existing) {
    // Insert new entity
    await insertEntity(entityType, reparented);
    report.inserted++;
    return;
  }

  // Dedup rules based on updatedAt
  const bundleUpdatedAt = entity.updatedAt as string | undefined;
  const localUpdatedAt = existing.updatedAt as string | undefined;

  if (!bundleUpdatedAt || !localUpdatedAt) {
    // Cannot compare — skip
    report.skipped++;
    return;
  }

  if (bundleUpdatedAt > localUpdatedAt) {
    // Bundle is newer — update local
    await updateEntity(entityType, id, reparented);
    report.updated++;
  } else {
    // Bundle is same or older — keep local
    report.skipped++;
  }
}
```

### Step 5: Implement re-parenting

```typescript
function applyReparenting(
  entity: Record<string, unknown>,
  entityType: keyof BundleContents,
  targetCampaignId: string | undefined,
  bundleContents: BundleContents
): Record<string, unknown> {
  if (!targetCampaignId) return entity;

  const result = { ...entity };

  // Set campaignId on all entities that have it
  if ('campaignId' in result) {
    result.campaignId = targetCampaignId;
  }

  // Handle sessionId: clear if the session is NOT in the bundle
  if ('sessionId' in result && result.sessionId) {
    const sessionInBundle = (bundleContents.sessions ?? []).some(
      (s) => s.id === result.sessionId
    );
    if (!sessionInBundle) {
      result.sessionId = undefined;
    }
  }

  return result;
}
```

### Step 6: Implement entity DB operations

Map entity types to their repository functions. Use a switch or lookup map:

```typescript
async function getEntityById(
  entityType: keyof BundleContents,
  id: string
): Promise<Record<string, unknown> | undefined> {
  switch (entityType) {
    // IMPORTANT: These method names are WRONG in the original spec. Read the actual
    // repository files to get the correct names. Known corrections:
    case 'campaign': return await campaignRepository.getCampaignById(id);
    case 'sessions': return await sessionRepository.getSessionById(id);
    case 'parties': return await partyRepository.getPartyById?.(id); // verify actual name
    case 'partyMembers': return await partyRepository.getPartyMemberById?.(id); // verify — may not exist, use db.table('partyMembers').get(id)
    case 'characters': return await characterRepository.getById(id);
    case 'creatureTemplates': return await creatureTemplateRepository.getById(id); // new repo from SS-04
    case 'encounters': return await encounterRepository.getById(id); // new repo from SS-04
    case 'notes': return await noteRepository.getNoteById(id);
    case 'entityLinks': return undefined; // entityLinkRepository has no getById — use db.table('entityLinks').get(id)
    case 'attachments': return undefined; // attachmentRepository has no getById — use db.table('attachments').get(id)
    default: return undefined;
  }
}
```

Similarly implement `insertEntity` and `updateEntity` using the appropriate repository `create`/`update` functions. For `insertEntity`, use the low-level `db.table(tableName).add(entity)` if the repository's `create` function auto-generates IDs (since import preserves original IDs).

**Important:** For `insertEntity`, the imported entity already has an `id` — use `db.table(tableName).put(entity)` (upsert) rather than `create()` (which generates a new ID). Similarly for `updateEntity`.

### Step 7: Handle unresolvable `linkedCreatureId`

In the encounters processing step, after inserting/updating encounters, for each participant with `linkedCreatureId`:
```typescript
// After merging encounters:
if (entityType === 'encounters') {
  const encounter = reparented as Encounter;
  for (const participant of encounter.participants ?? []) {
    if (participant.linkedCreatureId) {
      const templateExists = await creatureTemplateRepository.getById(participant.linkedCreatureId);
      if (!templateExists) {
        console.warn(
          `[mergeEngine] Unresolvable linkedCreatureId: ${participant.linkedCreatureId} for participant ${participant.id} in encounter ${encounter.id}`
        );
        // Do NOT fail — participant retains instanceState as-is
      }
    }
  }
}
```

### Step 8: Helper to extract entity arrays from BundleContents

```typescript
function getEntities(
  contents: BundleContents,
  entityType: keyof BundleContents
): Record<string, unknown>[] {
  const val = contents[entityType];
  if (!val) return [];
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  // campaign is a single object, not an array
  return [val as Record<string, unknown>];
}
```

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Manual verification:**

1. Import a bundle with a mix of new and existing entities:
   - New entities → `report.inserted` increases
   - Same entity with newer `updatedAt` → `report.updated` increases
   - Same entity with identical or older `updatedAt` → `report.skipped` increases

2. Import same bundle twice → second time all entities skipped (identical `updatedAt`)

3. Import with `targetCampaignId` → all imported entities have `campaignId = targetCampaignId`

4. Import bundle with session but no campaign → entities get `targetCampaignId`, `sessionId` preserved

5. Import bundle with encounter whose participant has `linkedCreatureId` not in bundle → warning logged, import succeeds

6. Import with `selectedEntityTypes = new Set(['notes'])` → only notes processed, no other entity types touched

---

## Acceptance Criteria

- [ ] Processing order matches spec: Campaign → Sessions → Parties → Party Members → Characters → Creature Templates → Encounters → Notes → Entity Links → Attachments
- [ ] Same ID + newer `updatedAt` → local entity updated (count in `report.updated`)
- [ ] Same ID + identical `updatedAt` → entity skipped (count in `report.skipped`)
- [ ] Same ID + older `updatedAt` → local entity kept (count in `report.skipped`)
- [ ] No matching ID → entity inserted (count in `report.inserted`)
- [ ] `targetCampaignId` applied to all imported entities that have a `campaignId` field
- [ ] `sessionId` cleared when session not present in bundle
- [ ] Unresolvable `linkedCreatureId` logs warning; merge does not fail; participant retained with existing `instanceState`
- [ ] Selective import: only entity types in `selectedEntityTypes` are processed
- [ ] Returns `MergeReport` with accurate counts
- [ ] Function never throws — all errors caught and placed in `report.errors`
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- `mergeBundle` must never throw — wrap all async calls in try/catch
- Preserve imported entity IDs (`put`/upsert, not `create` which generates new IDs)
- Adjust all repository import paths to match actual file locations
- `updatedAt` comparison is lexicographic ISO 8601 string comparison (this is correct for ISO dates)
- `campaign` field in `BundleContents` is a single object, not an array — handle accordingly
