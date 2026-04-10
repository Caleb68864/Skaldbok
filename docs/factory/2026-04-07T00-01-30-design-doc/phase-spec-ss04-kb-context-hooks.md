# Phase Spec — SS-04 · Knowledge Base Context + Hooks

**Run:** `2026-04-07T00-01-30-design-doc`
**Sub-spec:** SS-04
**Phase:** 1 — Foundation
**Priority:** 8/10

---

## Dependency Order

> ⚠️ **Depends on SS-01, SS-02, and SS-03 being completed first.**
> The Dexie schema (SS-01), KB repositories (SS-02), and link sync engine (SS-03) must all be in place before this context layer can query them.

---

## Intent

Create `src/features/kb/KnowledgeBaseContext.tsx` following the `CampaignContext.tsx` pattern (`createContext(null)` + consumer hook that throws if null). The context provides all graph query hooks to the component tree below `KnowledgeBaseProvider`.

Install `minisearch` as a dependency if not already present (check `package.json`). Create `src/features/kb/useKBSearch.ts` as the unified MiniSearch index.

---

## Files to Create

| File | Exports |
|---|---|
| `src/features/kb/KnowledgeBaseContext.tsx` | `KnowledgeBaseProvider`, `useKnowledgeBase` (throws if null), `KnowledgeBaseContextValue` |
| `src/features/kb/useKBSearch.ts` | `useKBSearch(query: string): KBNode[]` — MiniSearch over all nodes |

## Files to Modify

| File | Change |
|---|---|
| `package.json` | Add `minisearch` as a runtime dependency if not already present |

---

## Implementation Steps

### Step 1 — Check and add `minisearch` to `package.json`

Read `package.json` and check if `minisearch` is already a dependency. If not, add it to `dependencies`:

```json
"minisearch": "^7.1.0"
```

> Only add this package. No other new npm dependencies are permitted (per escalation rules).

### Step 2 — Create `src/features/kb/KnowledgeBaseContext.tsx`

Follow the exact pattern from `src/features/campaign/CampaignContext.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { KBNode, KBEdge } from '../../storage/db/client'; // or from types/kb
import {
  getEdgesToNode,
  getEdgesFromNode,
  getEdgesByCampaign,
} from '../../storage/repositories/kbEdgeRepository';
import {
  getNodeById,
  getNodesByType,
  getNodesByCampaign,
  getSharedNodes,
  getNodeByLabel,
} from '../../storage/repositories/kbNodeRepository';

export interface KnowledgeBaseContextValue {
  useBacklinks: (nodeId: string) => KBEdge[];
  useForwardLinks: (nodeId: string) => KBEdge[];
  useGraphNeighbors: (nodeId: string, depth?: number) => KBNode[];
  useNodesByType: (campaignId: string, type: KBNode['type']) => KBNode[];
  useResolveWikilink: (label: string, campaignId: string) => KBNode | undefined;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextValue | null>(null);

export function useKnowledgeBase(): KnowledgeBaseContextValue {
  const ctx = useContext(KnowledgeBaseContext);
  if (!ctx) {
    throw new Error('useKnowledgeBase must be used within KnowledgeBaseProvider');
  }
  return ctx;
}

interface KnowledgeBaseProviderProps {
  children: ReactNode;
  campaignId: string;
}

export function KnowledgeBaseProvider({ children, campaignId }: KnowledgeBaseProviderProps) {
  // Implement hooks as stable references using useCallback + useState + useEffect pattern
  // (following CampaignContext pattern)

  // Each hook internally uses useState + useEffect to load from Dexie
  // and returns the current state value

  const value: KnowledgeBaseContextValue = {
    useBacklinks: (nodeId) => useBacklinksImpl(nodeId),
    useForwardLinks: (nodeId) => useForwardLinksImpl(nodeId),
    useGraphNeighbors: (nodeId, depth) => useGraphNeighborsImpl(nodeId, depth),
    useNodesByType: (cId, type) => useNodesByTypeImpl(cId, type),
    useResolveWikilink: (label, cId) => useResolveWikilinkImpl(label, cId),
  };

  return (
    <KnowledgeBaseContext.Provider value={value}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
}
```

> **Note on hook-in-object pattern:** The `KnowledgeBaseContextValue` exposes functions that are themselves hooks. This is valid as long as consumers call them unconditionally (rules of hooks apply). The preferred alternative (and simpler) approach is to expose the raw async functions and let individual components define their own `useState + useEffect` hooks. Implement whichever approach the developer finds cleaner — but it must match the `CampaignContext.tsx` pattern used in the project.

#### Inner Hook Implementations

These are implemented as module-level hooks inside the context file (not exported):

**`useBacklinksImpl(nodeId: string): KBEdge[]`**
- `useState<KBEdge[]>([])` + `useEffect` that calls `getEdgesToNode(nodeId)` on mount and when `nodeId` changes.

**`useForwardLinksImpl(nodeId: string): KBEdge[]`**
- `useState<KBEdge[]>([])` + `useEffect` that calls `getEdgesFromNode(nodeId)`.

**`useGraphNeighborsImpl(nodeId: string, depth: number = 1): KBNode[]`**
- BFS traversal starting from `nodeId`. For each level, fetch edges via `getEdgesFromNode` and `getEdgesToNode`, collect unique neighbor node IDs, fetch nodes via `getNodeById`. Stop at `depth` levels.
- Must complete in < 50ms for a 500-node / 2500-edge dataset (single-level BFS is already fast; keep BFS levels minimal).

**`useNodesByTypeImpl(campaignId: string, type: KBNode['type']): KBNode[]`**
- Calls `getNodesByType(campaignId, type)`.

**`useResolveWikilinkImpl(label: string, campaignId: string): KBNode | undefined`**
- Calls `getNodeByLabel(label, campaignId)` — single Dexie indexed lookup.

### Step 3 — Create `src/features/kb/useKBSearch.ts`

```typescript
import { useState, useEffect, useRef } from 'react';
import MiniSearch from 'minisearch';
import type { KBNode } from '../../storage/db/client';
import { getNodesByCampaign, getSharedNodes } from '../../storage/repositories/kbNodeRepository';

// MiniSearch index built over all kb_nodes for the current campaign
export function useKBSearch(query: string, campaignId: string): KBNode[] {
  const [results, setResults] = useState<KBNode[]>([]);
  const indexRef = useRef<MiniSearch<KBNode> | null>(null);
  const nodesRef = useRef<KBNode[]>([]);

  // Build index on mount
  useEffect(() => {
    const miniSearch = new MiniSearch<KBNode>({
      fields: ['label'],
      storeFields: ['id', 'type', 'label', 'scope', 'campaignId', 'sourceId', 'createdAt', 'updatedAt'],
      searchOptions: {
        fuzzy: 0.2,
        prefix: true,
      },
    });

    async function buildIndex() {
      const [campaignNodes, sharedNodes] = await Promise.all([
        getNodesByCampaign(campaignId),
        getSharedNodes(),
      ]);
      const allNodes = [...campaignNodes, ...sharedNodes];
      nodesRef.current = allNodes;
      // addAllAsync is non-blocking (chunked)
      await miniSearch.addAllAsync(allNodes, { chunkSize: 200 });
      indexRef.current = miniSearch;
    }

    buildIndex().catch(err => {
      if (import.meta.env.DEV) console.warn('[useKBSearch] Index build failed', err);
    });
  }, [campaignId]);

  // Search whenever query changes
  useEffect(() => {
    if (!indexRef.current || !query.trim()) {
      setResults([]);
      return;
    }
    const hits = indexRef.current.search(query);
    // Map search results back to full KBNode objects
    const nodes = hits
      .map(hit => nodesRef.current.find(n => n.id === hit.id))
      .filter((n): n is KBNode => n !== undefined);
    setResults(nodes);
  }, [query]);

  return results;
}
```

---

## Acceptance Criteria

1. `npm run build` succeeds with zero TypeScript errors.
2. `useKnowledgeBase()` called outside a `<KnowledgeBaseProvider>` throws `Error: useKnowledgeBase must be used within KnowledgeBaseProvider`.
3. `useBacklinks('note-id-with-links')` returns an array of `KBEdge` objects where `toId === 'note-id-with-links'`.
4. `useResolveWikilink('Bjorn the Bold', campaignId)` performs a single Dexie `equalsIgnoreCase` lookup (not a full table scan) and returns the matching node or `undefined`.
5. `useKBSearch('bjorn', campaignId)` returns fuzzy-matched nodes from MiniSearch (case-insensitive, partial-match).
6. MiniSearch index is rebuilt asynchronously on provider mount using `addAllAsync` with `chunkSize: 200` (non-blocking).
7. `useGraphNeighbors(nodeId, 2)` returns nodes reachable within 2 hops (BFS across `kb_edges`). Completes in < 50ms for a 500-node / 2500-edge dataset.

---

## Verification Commands

```bash
# TypeScript build check
npm run build

# (Manual) Test in browser:
# 1. Wrap a test component with <KnowledgeBaseProvider campaignId={...}>
# 2. Call useKnowledgeBase() — confirm no crash when inside provider
# 3. Call useKnowledgeBase() outside provider — confirm throws with correct message
# 4. Type in a search box wired to useKBSearch — confirm fuzzy results appear
```

---

## Constraints / Notes

- Follow `createContext(null)` + consumer hook that throws if null — same as `CampaignContext.tsx`.
- Context: `createContext(null)` + consumer throws if null (do NOT use a default/empty context value).
- No `settings.debugMode` — use `import.meta.env.DEV` for all debug logging.
- Only `minisearch` is permitted as a new dependency. No other packages.
- Correctness over speed. No shell commands. Cross-platform.
