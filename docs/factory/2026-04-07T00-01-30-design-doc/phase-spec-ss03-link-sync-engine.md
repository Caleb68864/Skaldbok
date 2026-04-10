# Phase Spec — SS-03 · Link Sync Engine

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-03
**Phase:** 1 — Foundation
**Priority:** 9/10

---

## Dependency Order

> ⚠️ **Depends on SS-01 and SS-02 being completed first.**
> The Dexie schema (SS-01) and KB repositories (SS-02) must exist before the sync engine can write to them.

---

## Intent

Create `src/features/kb/linkSyncEngine.ts` as a module of exported async functions. The engine parses Tiptap JSON from note bodies, extracts `[[wikilinks]]`, `@mentions`, and `#descriptor` references, diffs against existing edges, and updates `kb_nodes` / `kb_edges` in IndexedDB. Also handles bulk migration and character node sync.

The engine runs AFTER the note save completes. If the sync fails, the note data is safe. The engine is idempotent — re-running produces identical results.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/linkSyncEngine.ts` | `syncNote(noteId)`, `deleteNoteNode(noteId)`, `syncCharacter(characterId)`, `bulkRebuildGraph(campaignId)` |
| `src/features/kb/tiptapParser.ts` | `extractLinksFromTiptapJSON(json): ExtractedLinks` |

---

## Files to Modify

| File | Change |
|---|---|
| `src/storage/repositories/noteRepository.ts` | After `updateNote()` writes successfully, call `linkSyncEngine.syncNote(id)` fire-and-forget |
| `src/storage/repositories/noteRepository.ts` | After `createNote()` writes successfully, call `linkSyncEngine.syncNote(note.id)` fire-and-forget |
| `src/storage/repositories/noteRepository.ts` | After `deleteNote()` writes successfully, call `linkSyncEngine.deleteNoteNode(id)` fire-and-forget |

---

## Implementation Steps

### Step 1 — Create `src/features/kb/tiptapParser.ts`

```typescript
export interface ExtractedLinks {
  wikilinks: string[];   // label values from wikiLink nodes
  mentions: string[];    // label values from mention nodes
  descriptors: string[]; // label values from descriptorMention nodes
}

// Recursively walks Tiptap JSON tree and extracts link references
export function extractLinksFromTiptapJSON(json: unknown): ExtractedLinks {
  const result: ExtractedLinks = { wikilinks: [], mentions: [], descriptors: [] };
  walkNode(json, result);
  return result;
}

function walkNode(node: unknown, result: ExtractedLinks): void {
  if (!node || typeof node !== 'object') return;
  const n = node as Record<string, unknown>;

  if (n.type === 'wikiLink' && n.attrs && typeof (n.attrs as Record<string, unknown>).label === 'string') {
    result.wikilinks.push((n.attrs as Record<string, unknown>).label as string);
  } else if (n.type === 'mention' && n.attrs && typeof (n.attrs as Record<string, unknown>).label === 'string') {
    result.mentions.push((n.attrs as Record<string, unknown>).label as string);
  } else if (n.type === 'descriptorMention' && n.attrs && typeof (n.attrs as Record<string, unknown>).label === 'string') {
    result.descriptors.push((n.attrs as Record<string, unknown>).label as string);
  } else if (n.type !== undefined && !['wikiLink', 'mention', 'descriptorMention'].includes(n.type as string)) {
    // Log unknown types in dev (not an error)
    if (import.meta.env.DEV && n.type !== 'doc' && n.type !== 'paragraph' && n.type !== 'text'
        && n.type !== 'hardBreak' && n.type !== 'heading' && n.type !== 'bulletList'
        && n.type !== 'orderedList' && n.type !== 'listItem' && n.type !== 'blockquote'
        && n.type !== 'codeBlock' && n.type !== 'horizontalRule' && n.type !== 'image') {
      console.warn(`[tiptapParser] Unknown node type encountered: ${n.type as string} — skipping`);
    }
  }

  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      walkNode(child, result);
    }
  }
}
```

### Step 2 — Create `src/features/kb/linkSyncEngine.ts`

```typescript
import { getNoteById } from '../../storage/repositories/noteRepository';
import {
  getNodeById,
  getNodeByLabel,
  upsertNode,
  deleteNode,
  deleteNodesBySource,
} from '../../storage/repositories/kbNodeRepository';
import {
  getEdgesFromNode,
  upsertEdge,
  deleteEdge,
  deleteEdgesFromNode,
  deleteEdgesToNode,
} from '../../storage/repositories/kbEdgeRepository';
import { extractLinksFromTiptapJSON } from './tiptapParser';
import { getNotesByCampaign } from '../../storage/repositories/noteRepository';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';
import { db } from '../../storage/db/client';
import type { KBNode, KBEdge } from '../../storage/db/client'; // or from types/kb
```

#### `syncNote(noteId: string): Promise<void>`

1. Fetch note by ID from `noteRepository`. If not found, warn and return.
2. Parse `note.body` as JSON (Tiptap format). If parse fails, warn and return.
3. Call `extractLinksFromTiptapJSON(body)` to get `{ wikilinks, mentions, descriptors }`.
4. Upsert the note's own `KBNode` (type: `'note'`, label: `note.title`, sourceId: `noteId`).
5. For each wikilink label:
   - Call `getNodeByLabel(label, note.campaignId)` to resolve.
   - If found: create a `kb_edges` entry (`type: 'wikilink'`, `fromId: noteNode.id`, `toId: resolved.id`).
   - If not found: upsert an `'unresolved'` placeholder `KBNode` with `label`, then create edge to it.
6. Diff: get all existing edges `fromId === noteNode.id` from Dexie. Delete any edges whose `toId` no longer appears in the current link set (stale edge removal).
7. Repeat steps 5–6 for mentions (`type: 'mention'`) and descriptors (`type: 'descriptor'`).
8. In `import.meta.env.DEV`, log added/removed edge counts and sync duration via `console.debug`.
9. Wrap entire function body in try/catch — on error, `console.warn('[linkSyncEngine] syncNote failed', noteId, err)` and return (do NOT rethrow).

#### `deleteNoteNode(noteId: string): Promise<void>`

1. Find the `KBNode` where `sourceId === noteId`.
2. If found: call `deleteEdgesFromNode(node.id)` and `deleteEdgesToNode(node.id)`.
3. Call `deleteNode(node.id)`.
4. Wrap in try/catch, warn on error, do not rethrow.

#### `syncCharacter(characterId: string): Promise<void>`

1. Fetch character by ID (use existing character repository — adapt to whichever is available).
2. Upsert a `KBNode` with `type: 'character'`, `label: character.name`, `sourceId: characterId`.
3. Wrap in try/catch, warn on error, do not rethrow.

#### `bulkRebuildGraph(campaignId: string): Promise<void>`

1. Fetch all notes for the campaign via `getNotesByCampaign(campaignId)`.
2. Call `syncNote(note.id)` for each note (sequentially to avoid IndexedDB contention).
3. Write metadata key `migration_kb_graph_v1` to the `metadata` table on completion.
4. If any individual `syncNote` fails, continue to the next (already handled by syncNote's own try/catch).

### Step 3 — Modify `src/storage/repositories/noteRepository.ts`

Add fire-and-forget sync calls after each write operation. Import lazily to avoid circular dependencies:

```typescript
// Fire-and-forget pattern — sync failure must NOT affect note save
import { syncNote, deleteNoteNode } from '../../features/kb/linkSyncEngine';

// In createNote, after successful put:
syncNote(note.id).catch(() => {}); // already caught internally, this is extra safety

// In updateNote, after successful put:
syncNote(id).catch(() => {});

// In deleteNote, after successful delete:
deleteNoteNode(id).catch(() => {});
```

> **Important:** Use a dynamic import or lazy import pattern if circular dependency warnings appear. The sync calls are fire-and-forget — no `await`, no try/catch needed at the call site (linkSyncEngine handles its own errors).

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. `extractLinksFromTiptapJSON` correctly extracts:
   - Wikilink atom nodes (`{ type: 'wikiLink', attrs: { id, label } }`) into `wikilinks` array
   - Mention atom nodes (`{ type: 'mention', attrs: { id, label } }`) into `mentions` array
   - DescriptorMention nodes (`{ type: 'descriptorMention', attrs: { id, label } }`) into `descriptors` array
   - Recursively walks `content` arrays at any depth
3. `syncNote(noteId)` creates a `kb_nodes` entry for the note (type `'note'`, label = note title).
4. For each wikilink in the note body, `syncNote` resolves the target via `getNodeByLabel` and either creates a `kb_edges` entry to the resolved node, or creates an `'unresolved'` placeholder `KBNode` if no match exists.
5. On re-sync, stale edges (links removed from note body) are deleted. No orphan edges remain.
6. `deleteNoteNode(noteId)` removes the node and all edges where `fromId === noteId` or `toId === noteId`.
7. `bulkRebuildGraph(campaignId)` reads all active notes for the campaign, calls `syncNote` for each, then writes metadata key `migration_kb_graph_v1` on completion.
8. If `syncNote` throws internally, it catches the error, logs `console.warn` with the note ID and error, and does NOT propagate (note save is unaffected).
9. Unknown Tiptap node types encountered during parsing are skipped with a `console.warn` (not thrown).
10. In `import.meta.env.DEV` mode, logs edges added/removed per sync and sync duration in ms via `console.debug`.
11. A note saved in the editor (autosave) results in `kb_nodes` and `kb_edges` being populated in IndexedDB (verifiable via DevTools > Application > IndexedDB).

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Open app in browser
# 1. Create a note with a title, add [[AnotherNote]] in the body
# 2. Save the note (autosave)
# 3. DevTools > Application > IndexedDB > SkaldbokDB > kb_nodes
#    Verify: node for the note exists with type='note'
#    Verify: node for 'AnotherNote' exists with type='unresolved'
# 4. DevTools > Application > IndexedDB > SkaldbokDB > kb_edges
#    Verify: edge exists with fromId=noteNode.id, toId=unresolvedNode.id, type='wikilink'
```

---

## Constraints / Notes

- The sync engine runs AFTER note save. If sync fails, note data is always safe.
- The engine is idempotent — re-running `syncNote` on the same note produces identical results.
- ASM-3: `AppSettings.debugMode` does not exist. All debug logging gated behind `import.meta.env.DEV`.
- Be careful of circular imports: `noteRepository.ts` imports from `linkSyncEngine`, which imports from repositories. Use dynamic imports if needed to break the cycle.
- The `tiptapParser.ts` must handle the Tiptap JSON structure that will be produced by the wikilink extension (SS-05). The node type name `'wikiLink'` is the expected Tiptap node name from SS-05.
- Correctness over speed. No shell commands. Cross-platform.
