# Phase Spec — SS-02 · KB Repositories (kbNodeRepository + kbEdgeRepository)

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-02
**Phase:** 1 — Foundation
**Priority:** 9/10

---

## Dependency Order

> ⚠️ **Depends on SS-01 being completed first.**
> The Dexie schema must define `kb_nodes` and `kb_edges` tables before these repositories can use them.

---

## Intent

Create two new repository modules following the `noteRepository.ts` module pattern. Both use the singleton `db` from `src/storage/db/client.ts`, export async functions (not classes), and validate on read via Zod. Follow the established pattern exactly — no classes, no default exports, no ORM abstraction.

---

## Files to Create

| File | Exports |
|---|---|
| `src/storage/repositories/kbNodeRepository.ts` | `getNodeById`, `getNodesByType`, `getNodesByCampaign`, `getSharedNodes`, `getNodeByLabel`, `upsertNode`, `deleteNode`, `deleteNodesBySource` |
| `src/storage/repositories/kbEdgeRepository.ts` | `getEdgesFromNode`, `getEdgesToNode`, `getEdgesByCampaign`, `upsertEdge`, `deleteEdge`, `deleteEdgesFromNode`, `deleteEdgesToNode` |

## Files to Modify

*(none)*

---

## Implementation Steps

### Step 1 — Create `src/storage/repositories/kbNodeRepository.ts`

Model this file after `noteRepository.ts`. Key implementation details:

```typescript
import { db } from '../db/client';
import { KBNode } from '../../types/kb'; // or from client.ts if co-located
import { z } from 'zod';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

// Zod schema for validation on read
const kbNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['note', 'character', 'location', 'item', 'tag', 'unresolved']),
  label: z.string(),
  scope: z.enum(['campaign', 'shared']),
  campaignId: z.string(),
  sourceId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export async function getNodeById(id: string): Promise<KBNode | undefined> {
  const raw = await db.kb_nodes.get(id);
  if (!raw) return undefined;
  return kbNodeSchema.parse(raw) as KBNode;
}

export async function getNodesByType(campaignId: string, type: KBNode['type']): Promise<KBNode[]> {
  const raw = await db.kb_nodes.where('[campaignId+type]').equals([campaignId, type]).toArray();
  return raw.map(r => kbNodeSchema.parse(r) as KBNode);
}

// Returns ONLY campaign-scoped nodes for the given campaign
export async function getNodesByCampaign(campaignId: string): Promise<KBNode[]> {
  const raw = await db.kb_nodes.where('campaignId').equals(campaignId).toArray();
  return raw.map(r => kbNodeSchema.parse(r) as KBNode);
}

// Returns ONLY shared (scope='shared') nodes — callers merge with getNodesByCampaign client-side (ASM-13)
export async function getSharedNodes(): Promise<KBNode[]> {
  const raw = await db.kb_nodes.where('scope').equals('shared').toArray();
  return raw.map(r => kbNodeSchema.parse(r) as KBNode);
}

// Case-insensitive label lookup using Dexie equalsIgnoreCase — single indexed lookup, not a table scan
export async function getNodeByLabel(label: string, campaignId: string): Promise<KBNode | undefined> {
  const raw = await db.kb_nodes
    .where('label').equalsIgnoreCase(label)
    .and(node => node.campaignId === campaignId)
    .first();
  if (!raw) return undefined;
  return kbNodeSchema.parse(raw) as KBNode;
}

// Idempotent upsert — safe to call repeatedly
export async function upsertNode(node: KBNode): Promise<void> {
  await db.kb_nodes.put(node);
}

export async function deleteNode(id: string): Promise<void> {
  await db.kb_nodes.delete(id);
}

// Deletes all nodes where sourceId === sourceId (e.g., all nodes from a deleted note)
export async function deleteNodesBySource(sourceId: string): Promise<void> {
  await db.kb_nodes.where('sourceId').equals(sourceId).delete();
}
```

### Step 2 — Create `src/storage/repositories/kbEdgeRepository.ts`

```typescript
import { db } from '../db/client';
import { KBEdge } from '../../types/kb'; // or from client.ts
import { z } from 'zod';

const kbEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  type: z.enum(['wikilink', 'mention', 'descriptor']),
  campaignId: z.string(),
  createdAt: z.string(),
});

export async function getEdgesFromNode(fromId: string): Promise<KBEdge[]> {
  const raw = await db.kb_edges.where('fromId').equals(fromId).toArray();
  return raw.map(r => kbEdgeSchema.parse(r) as KBEdge);
}

export async function getEdgesToNode(toId: string): Promise<KBEdge[]> {
  const raw = await db.kb_edges.where('toId').equals(toId).toArray();
  return raw.map(r => kbEdgeSchema.parse(r) as KBEdge);
}

export async function getEdgesByCampaign(campaignId: string): Promise<KBEdge[]> {
  const raw = await db.kb_edges.where('campaignId').equals(campaignId).toArray();
  return raw.map(r => kbEdgeSchema.parse(r) as KBEdge);
}

// Idempotent upsert
export async function upsertEdge(edge: KBEdge): Promise<void> {
  await db.kb_edges.put(edge);
}

export async function deleteEdge(id: string): Promise<void> {
  await db.kb_edges.delete(id);
}

// Removes all edges where fromId === nodeId (for node delete cascades)
export async function deleteEdgesFromNode(nodeId: string): Promise<void> {
  await db.kb_edges.where('fromId').equals(nodeId).delete();
}

// Removes all edges where toId === nodeId
export async function deleteEdgesToNode(nodeId: string): Promise<void> {
  await db.kb_edges.where('toId').equals(nodeId).delete();
}
```

### Step 3 — Error Handling

All functions must propagate or re-throw with a descriptive message if Dexie throws. No silent failures. Example pattern:

```typescript
try {
  // dexie call
} catch (err) {
  throw new Error(`kbNodeRepository.getNodeById(${id}): ${err instanceof Error ? err.message : String(err)}`);
}
```

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. `getNodeByLabel(label, campaignId)` performs a case-insensitive lookup using Dexie's `equalsIgnoreCase()`. Must resolve in < 50ms for a 500-node dataset (single indexed lookup, not a table scan).
3. `getNodesByCampaign(campaignId)` returns campaign-scoped nodes. A separate `getSharedNodes()` function returns nodes where `scope === 'shared'`. Callers merge the two results client-side (per ASM-13).
4. `upsertNode(node)` uses `db.kb_nodes.put(node)` — idempotent, safe to call repeatedly.
5. `deleteEdgesFromNode(nodeId)` removes all edges where `fromId === nodeId`.
6. `deleteEdgesToNode(nodeId)` removes all edges where `toId === nodeId`.
7. All functions are exported at module level (not as class methods).
8. Each function throws a descriptive `Error` (not a silent failure) if Dexie throws.

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Open app in browser → DevTools → Application → IndexedDB → SkaldbokDB
# Verify: saving a note triggers kb_nodes and kb_edges population
# Verify: getNodeByLabel resolves correctly
```

---

## Constraints / Notes

- Follow the `noteRepository.ts` module pattern exactly — exported async functions, no classes, no default exports.
- Zod validation on DB READ, not write (validate the raw Dexie output, not the input to `put()`).
- All DB access via singleton `db` from `src/storage/db/client.ts`.
- IDs via `generateId()` (`src/utils/ids.ts`), timestamps via `nowISO()` (`src/utils/dates.ts`) — for any ID/timestamp generation in this layer.
- ASM-13: Dexie cannot do `WHERE campaignId=X OR scope='shared'` in one query. Two separate queries merged client-side is the correct pattern.
- Correctness over speed. No shell commands. Cross-platform.
