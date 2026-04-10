# Phase Spec — SS-01 · Graph Store Schema + Dexie v7 + scope field

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-01
**Phase:** 1 — Foundation
**Priority:** 10/10
**Dependency order:** None — this is the foundation block. All other sub-specs depend on this.

---

## Intent

Add `kb_nodes` and `kb_edges` tables to the Dexie schema (version 7). Add a `scope` field to the notes index so shared notes can be queried. Migrate existing `referenceNotes` rows into the `notes` table with `scope: 'shared'` and `type: 'reference'` inside the version 7 upgrade block. Add `scope` to `baseNoteSchema` in `src/types/note.ts`.

---

## Files to Modify

| File | Change |
|---|---|
| `src/storage/db/client.ts` | Add `version(7)` block; declare `kb_nodes`, `kb_edges` tables with indexes; extend `notes` index with `scope`; migrate referenceNotes; add `KBNode` and `KBEdge` interface types |
| `src/types/note.ts` | Add `scope: z.enum(['campaign', 'shared']).optional().default('campaign')` to `baseNoteSchema` |

> **No new files required for this sub-spec.**

---

## Implementation Steps

### Step 1 — Add `KBNode` and `KBEdge` interfaces to `src/storage/db/client.ts`

Add the following TypeScript interfaces near the top of `client.ts` (alongside `ReferenceNote` or in `src/types/kb.ts` — either is acceptable):

```typescript
export interface KBNode {
  id: string;            // generateId()
  type: 'note' | 'character' | 'location' | 'item' | 'tag' | 'unresolved';
  label: string;         // display name / note title
  scope: 'campaign' | 'shared';
  campaignId: string;
  sourceId?: string;     // ID of the originating note/character/etc.
  createdAt: string;     // nowISO()
  updatedAt: string;     // nowISO()
}

export interface KBEdge {
  id: string;            // generateId()
  fromId: string;        // KBNode.id of link source
  toId: string;          // KBNode.id of link target
  type: 'wikilink' | 'mention' | 'descriptor';
  campaignId: string;
  createdAt: string;     // nowISO()
}
```

### Step 2 — Extend `SkaldbokDatabase` class to declare new table types

Add `kb_nodes!: Table<KBNode>` and `kb_edges!: Table<KBEdge>` as properties on the `SkaldbokDatabase` class.

### Step 3 — Add `version(7)` block to the Dexie database declaration

**CRITICAL:** Do NOT modify any version 1–6 blocks.

```typescript
this.version(7).stores({
  notes: 'id, campaignId, sessionId, type, scope, [campaignId+type], updatedAt',
  kb_nodes: 'id, campaignId, type, scope, label, sourceId, updatedAt, [campaignId+type]',
  kb_edges: 'id, campaignId, fromId, toId, type',
}).upgrade(async (tx) => {
  // Migrate existing referenceNotes → notes with scope: 'shared'
  const metaKey = 'migration_v7_ref_notes';
  const alreadyRan = await tx.table('metadata').where('key').equals(metaKey).first().catch(() => null);
  if (alreadyRan) return;

  const refNotes = await tx.table('referenceNotes').toArray().catch(() => []);
  for (const ref of refNotes) {
    await tx.table('notes').put({
      ...ref,
      scope: 'shared',
      type: ref.type ?? 'reference',
    });
  }

  await tx.table('metadata').put({ id: metaKey, key: metaKey, value: 'true' });
});
```

> **Note:** The `notes` index string in version 7 must include `scope`. All other existing tables can be omitted from the version 7 `.stores()` call (Dexie preserves them).

### Step 4 — Add `scope` to `baseNoteSchema` in `src/types/note.ts`

Find `baseNoteSchema` and add:
```typescript
scope: z.enum(['campaign', 'shared']).optional().default('campaign'),
```

This is backward-compatible: existing notes without `scope` will parse as `'campaign'` by default.

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors after this change.
2. On first app load after upgrade, Dexie auto-migrates to version 7 without error.
3. `db.kb_nodes` and `db.kb_edges` are accessible as typed `Table<>` properties on `SkaldbokDatabase`.
4. The `notes` table index string in the version 7 `.stores()` declaration includes `scope`.
5. Every existing `ReferenceNote` row in `referenceNotes` is copied to `notes` with `scope: 'shared'` and `type: 'reference'` during the upgrade. The upgrade guard uses metadata key `migration_v7_ref_notes` and runs only once.
6. `baseNoteSchema` parses an object with `scope: 'shared'` without error. Omitting `scope` defaults to `'campaign'`.
7. `getNotesByCampaign` in `noteRepository.ts` continues to work unmodified (scope field is optional/backward-compatible).
8. Existing Dexie version 1–6 blocks are NOT modified.

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Open app in browser → DevTools → Application → IndexedDB → SkaldbokDB
# Verify: kb_nodes table exists
# Verify: kb_edges table exists
# Verify: notes table index includes "scope"
# Verify: existing notes still load in campaign view
```

---

## Constraints / Notes

- `KBNode` and `KBEdge` interfaces may be co-located in `src/storage/db/client.ts` alongside `ReferenceNote`, or extracted to `src/types/kb.ts`. Either is acceptable.
- The version 7 `.stores()` call must re-declare only tables whose indexes change. Only `notes` index changes; other tables can be omitted.
- ASM-13: Dexie cannot do `WHERE campaignId=X OR scope='shared'` in one query — two queries merged client-side is acceptable. This will be implemented in SS-02 repository layer.
- ASM-3: `AppSettings.debugMode` does not exist. All debug logging must be gated behind `import.meta.env.DEV`.
- Correctness over speed. No shell commands. Cross-platform.
