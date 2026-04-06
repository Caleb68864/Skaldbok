# Phase Spec — SS-04: Creature Template & Encounter Repositories

**Run:** 2026-04-06T20-36-24-design-doc
**Sub-Spec:** 1.1 — Feature A: Repositories
**Depends on:** SS-02 (Zod type schemas) and SS-01 (Dexie v6 schema) must be completed first.
**Delivery order note:** Step 4 in execution sequence. Repositories are required by all UI sub-specs (SS-05, SS-06, SS-07).

---

## Objective

Implement stateless async CRUD repository functions for `CreatureTemplate` and `Encounter` entities, following the existing repository pattern in the codebase. All functions use `generateId()` and `nowISO()` for IDs and timestamps. All read operations use `safeParse()` with `console.warn` on failure.

---

## Files to Create

- `src/storage/repositories/creatureTemplateRepository.ts` — **create new**
- `src/storage/repositories/encounterRepository.ts` — **create new**

---

## Implementation Steps

### Step 1: Inspect existing repositories for patterns

Before writing, read one or two existing repositories (e.g., `noteRepository.ts`, `characterRepository.ts`) to confirm:
- How `db` is imported
- How `generateId()` and `nowISO()` are imported/used
- The `safeParse` + `console.warn` read pattern
- How `update` patches are applied (get → merge → put)
- How errors are handled (no throws — return `undefined` or result pattern)

Match all patterns exactly.

### Step 2: Create `src/storage/repositories/creatureTemplateRepository.ts`

```typescript
import { db } from '../db/client';
import { generateId, nowISO } from '../../utils/id'; // adjust import path
import { creatureTemplateSchema, CreatureTemplate } from '../../types/creatureTemplate';

export async function create(
  data: Omit<CreatureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
): Promise<CreatureTemplate> {
  const record: CreatureTemplate = {
    ...data,
    id: generateId(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    schemaVersion: 1,
  };
  await db.table('creatureTemplates').add(record);
  return record;
}

export async function getById(id: string): Promise<CreatureTemplate | undefined> {
  const raw = await db.table('creatureTemplates').get(id);
  if (!raw) return undefined;
  const result = creatureTemplateSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[creatureTemplateRepository] getById parse failure', id, result.error);
    return undefined;
  }
  return result.data;
}

export async function listByCampaign(campaignId: string): Promise<CreatureTemplate[]> {
  const raws = await db.table('creatureTemplates').where('campaignId').equals(campaignId).toArray();
  return raws.flatMap((raw) => {
    const result = creatureTemplateSchema.safeParse(raw);
    if (!result.success) {
      console.warn('[creatureTemplateRepository] listByCampaign parse failure', raw?.id, result.error);
      return [];
    }
    return [result.data];
  });
}

export async function update(id: string, patch: Partial<CreatureTemplate>): Promise<CreatureTemplate> {
  const existing = await getById(id);
  if (!existing) throw new Error(`CreatureTemplate not found: ${id}`);
  const updated: CreatureTemplate = { ...existing, ...patch, id, updatedAt: nowISO() };
  await db.table('creatureTemplates').put(updated);
  return updated;
}

export async function archive(id: string): Promise<void> {
  await db.table('creatureTemplates').update(id, { status: 'archived', updatedAt: nowISO() });
}
```

### Step 3: Create `src/storage/repositories/encounterRepository.ts`

```typescript
import { db } from '../db/client';
import { generateId, nowISO } from '../../utils/id'; // adjust import path
import { encounterSchema, Encounter, EncounterParticipant } from '../../types/encounter';

export async function create(
  data: Omit<Encounter, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
): Promise<Encounter> {
  const record: Encounter = {
    ...data,
    id: generateId(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    schemaVersion: 1,
  };
  await db.table('encounters').add(record);
  return record;
}

export async function getById(id: string): Promise<Encounter | undefined> {
  const raw = await db.table('encounters').get(id);
  if (!raw) return undefined;
  const result = encounterSchema.safeParse(raw);
  if (!result.success) {
    console.warn('[encounterRepository] getById parse failure', id, result.error);
    return undefined;
  }
  return result.data;
}

export async function listBySession(sessionId: string): Promise<Encounter[]> {
  const raws = await db.table('encounters').where('sessionId').equals(sessionId).toArray();
  return raws.flatMap((raw) => {
    const result = encounterSchema.safeParse(raw);
    if (!result.success) {
      console.warn('[encounterRepository] listBySession parse failure', raw?.id, result.error);
      return [];
    }
    return [result.data];
  });
}

export async function listByCampaign(campaignId: string): Promise<Encounter[]> {
  const raws = await db.table('encounters').where('campaignId').equals(campaignId).toArray();
  return raws.flatMap((raw) => {
    const result = encounterSchema.safeParse(raw);
    if (!result.success) {
      console.warn('[encounterRepository] listByCampaign parse failure', raw?.id, result.error);
      return [];
    }
    return [result.data];
  });
}

export async function update(id: string, patch: Partial<Encounter>): Promise<Encounter> {
  const existing = await getById(id);
  if (!existing) throw new Error(`Encounter not found: ${id}`);
  const updated: Encounter = { ...existing, ...patch, id, updatedAt: nowISO() };
  await db.table('encounters').put(updated);
  return updated;
}

export async function end(id: string): Promise<Encounter> {
  return update(id, { status: 'ended', endedAt: nowISO() });
}

export async function updateParticipant(
  encounterId: string,
  participantId: string,
  patch: Partial<EncounterParticipant>
): Promise<Encounter> {
  const existing = await getById(encounterId);
  if (!existing) throw new Error(`Encounter not found: ${encounterId}`);
  const updatedParticipants = existing.participants.map((p) =>
    p.id === participantId ? { ...p, ...patch } : p
  );
  return update(encounterId, { participants: updatedParticipants });
}

export async function addParticipant(
  encounterId: string,
  participant: Omit<EncounterParticipant, 'id'>
): Promise<Encounter> {
  const existing = await getById(encounterId);
  if (!existing) throw new Error(`Encounter not found: ${encounterId}`);
  const newParticipant: EncounterParticipant = {
    ...participant,
    id: generateId(),
  };
  return update(encounterId, {
    participants: [...existing.participants, newParticipant],
  });
}
```

---

## Verification Commands

```bash
npx tsc --noEmit
```

**Manual verification:**
- In browser DevTools console, import and call `creatureTemplateRepository.create(...)` — check IndexedDB for inserted record.
- Call `creatureTemplateRepository.listByCampaign(campaignId)` — returns only templates for that campaign.
- Call `encounterRepository.updateParticipant(encounterId, participantId, { currentHp: 5 })` — verify only that participant changes; others unchanged.

---

## Acceptance Criteria

- [ ] `creatureTemplateRepository.create()` inserts record and returns typed `CreatureTemplate` object
- [ ] `creatureTemplateRepository.listByCampaign()` returns only templates for given `campaignId`
- [ ] `encounterRepository.create()` inserts record and returns typed `Encounter` object
- [ ] `encounterRepository.listBySession()` returns encounters for given `sessionId`
- [ ] `encounterRepository.updateParticipant()` updates nested participant without replacing others
- [ ] All read functions use `safeParse()` and `console.warn` on failure; return `undefined` for invalid records
- [ ] No repository function throws for expected failure conditions (record not found returns `undefined` or logs)
- [ ] All functions exported as named exports (not a class)
- [ ] `npx tsc --noEmit` passes with no errors

---

## Constraints

- No new npm dependencies
- Module-export pattern (named async functions — not a class)
- Match import paths for `db`, `generateId`, `nowISO` to existing repository patterns
- Do not modify any existing repository file
- `schemaVersion: 1` hardcoded for all new records
