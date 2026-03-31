---
type: phase-spec
master_spec: "docs/specs/2026-03-30-universal-note-model.md"
sub_spec: 2
title: "MiniSearch Full-Text Search"
dependencies: [1]
date: 2026-03-30
---

# Sub-Spec 2: MiniSearch Full-Text Search

## Shared Context

**Project:** Skaldbok -- Dragonbane TTRPG companion PWA (React 19, TypeScript, Vite, Dexie v4, TipTap, Zod)

**Codebase conventions:**
- React hooks go in `src/features/{domain}/`. Utility functions go in `src/utils/`.
- No tests exist. Verification is `tsc --noEmit` + `npm run build` + grep checks.

**Constraints:**
- Must NOT modify any existing files beyond adding the minisearch dependency to package.json
- MiniSearch index lives in memory only -- no stored plaintext, no IndexedDB persistence
- Index rebuilds from scratch on campaign load (recovery path for any desync)

## Scope

Add MiniSearch library (~6KB gzipped), create a ProseMirror JSON text extraction utility, and create a `useNoteSearch` React hook that manages an in-memory search index. The hook builds the index on campaign load, updates it incrementally on note CRUD, and exposes a search function with fuzzy matching and type/tag filtering.

## Codebase Analysis

### All Files Are New

No existing search infrastructure. All files created fresh:
1. `package.json` -- add `minisearch` dependency
2. `src/utils/prosemirror.ts` -- new utility file
3. `src/features/notes/useNoteSearch.ts` -- new hook file

### Dependency: Sub-Spec 1

This sub-spec uses the simplified `Note` type from Sub-Spec 1:
- `Note` type with `body: unknown` (ProseMirror JSON), `title: string`, `tags: string[]`, `type: string`
- Imported from `../../types/note`

### Existing Patterns to Follow

- `src/features/notes/useNoteActions.ts` -- React hook pattern with `useCallback`, campaign context, error handling via toast
- `src/features/campaign/CampaignContext.tsx` -- `useCampaignContext()` hook for accessing `activeCampaign`

## Implementation Steps

### Step 1: Install MiniSearch

```bash
npm install minisearch
```

**Verification:**
```bash
grep -c "minisearch" package.json
```
Expected: > 0

### Step 2: Create `src/utils/prosemirror.ts`

New file. Single exported function:

```typescript
/**
 * Recursively extract plain text from a ProseMirror JSON document.
 * Walks the node tree and collects text content from text nodes.
 */
export function extractText(doc: unknown): string {
  // Implementation: recursive walk of ProseMirror JSON node tree
  // - If node has `text` property (string), collect it
  // - If node has `content` property (array), recurse into each child
  // - Join all text with spaces
  // - Trim and collapse whitespace
}
```

The ProseMirror JSON structure (from TipTap) looks like:
```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello world" },
        { "type": "text", "text": " more text", "marks": [...] }
      ]
    },
    {
      "type": "heading",
      "content": [
        { "type": "text", "text": "Section Title" }
      ]
    }
  ]
}
```

The function should handle:
- `null` / `undefined` input → return `''`
- Non-object input → return `''`
- Nodes with `text: string` → collect the text
- Nodes with `content: array` → recurse into each child
- Nodes with neither → skip

**Verification:**
```bash
npx tsc --noEmit && echo "TSC OK"
grep -c "extractText" src/utils/prosemirror.ts
```
Expected: TSC passes, extractText count > 0

### Step 3: Create `src/features/notes/useNoteSearch.ts`

New file. React hook that manages an in-memory MiniSearch index.

**MiniSearch Configuration:**
```typescript
import MiniSearch from 'minisearch';

// Index configuration
const searchIndex = new MiniSearch<{ id: string; title: string; bodyText: string; tags: string; type: string }>({
  fields: ['title', 'bodyText', 'tags'],
  storeFields: ['title', 'type'],
  searchOptions: {
    boost: { title: 2, tags: 1.5, bodyText: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
});
```

**Hook API:**

```typescript
export function useNoteSearch() {
  // Returns:
  return {
    search,           // (query: string, options?: { filter?: (result) => boolean }) => SearchResult[]
    rebuildIndex,     // (notes: Note[]) => void -- full rebuild from array of notes
    addToIndex,       // (note: Note) => void -- add single note
    updateInIndex,    // (note: Note) => void -- update single note (remove + add)
    removeFromIndex,  // (id: string) => void -- remove by id
    isIndexed,        // boolean -- whether index has been built
  };
}
```

**Key implementation details:**

1. **Index is a module-level singleton** (not per-component). Use `useRef` or module-scoped variable so the index persists across renders but not across page reloads.

2. **`rebuildIndex(notes: Note[])`:**
   - Clear the existing index (`searchIndex.removeAll()`)
   - For each note: extract text from `note.body` using `extractText()`, join tags into a string, add to index
   - Set `isIndexed = true`

3. **`addToIndex(note: Note)`:**
   - Extract text, add document to index
   - If document with same ID exists, remove first then add

4. **`search(query: string, options?)`:**
   - If query is empty or index not built, return `[]`
   - Call `searchIndex.search(query, { filter: options?.filter })`
   - Return results with `id`, `title`, `type`, `score`, `match` info

5. **Filter support:**
   - MiniSearch's `filter` option takes a function `(result) => boolean`
   - Consumers can filter by type: `search('innkeeper', { filter: r => r.type === 'npc' })`

**Verification:**
```bash
npx tsc --noEmit && echo "TSC OK"
npm run build && echo "BUILD OK"
grep -c "MiniSearch" src/features/notes/useNoteSearch.ts
grep -c "extractText" src/features/notes/useNoteSearch.ts
grep -c "rebuildIndex\|addToIndex\|removeFromIndex\|updateInIndex" src/features/notes/useNoteSearch.ts
```
Expected: TSC passes, build succeeds, MiniSearch > 0, extractText > 0, index methods > 0

### Step 4: Full build verification

```bash
npx tsc --noEmit && echo "TSC OK" || echo "TSC FAILED"
npm run build && echo "BUILD OK" || echo "BUILD FAILED"
```

Both must succeed.

### Step 5: Run acceptance criteria checks

```bash
# MiniSearch in package.json
grep -c "minisearch" package.json

# extractText exists
grep -c "extractText" src/utils/prosemirror.ts

# useNoteSearch exists with MiniSearch
grep -c "MiniSearch" src/features/notes/useNoteSearch.ts

# Hook exports search, rebuild, add, update, remove
grep -c "rebuildIndex\|addToIndex\|removeFromIndex\|updateInIndex\|search" src/features/notes/useNoteSearch.ts
```

Expected: all counts > 0.

## Interface Contract

### Requires (from Sub-Spec 1)

- `Note` type from `src/types/note.ts` with `body: unknown`, `title: string`, `tags?: string[]`, `type: string`, `id: string`

### Provides

- `useNoteSearch` hook from `src/features/notes/useNoteSearch.ts`
- `extractText` utility from `src/utils/prosemirror.ts`

These are new exports. No existing code depends on them yet. They will be wired into the UI in future work (out of scope for this spec).

## Patterns to Follow

- `src/features/notes/useNoteActions.ts` -- React hook structure with `useCallback`, module-level imports
- `src/utils/ids.ts`, `src/utils/dates.ts` -- utility file structure (simple exports, no classes)
