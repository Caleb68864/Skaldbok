/**
 * Knowledge Base context provider and consumer hook.
 *
 * @remarks
 * Follows the `CampaignContext.tsx` pattern: `createContext(null)` with a
 * consumer hook that throws if called outside the provider tree.
 *
 * Provides graph query functions (backlinks, forward links, neighbors, etc.)
 * as stable references in the context value.
 */

import { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { KBNode, KBEdge } from '../../storage/db/client';
import {
  getEdgesToNode,
  getEdgesFromNode,
} from '../../storage/repositories/kbEdgeRepository';
import {
  getNodeById,
  getNodesByType,
  getNodeByLabel,
} from '../../storage/repositories/kbNodeRepository';

/**
 * Shape of the value provided by `KnowledgeBaseContext`.
 */
export interface KnowledgeBaseContextValue {
  /** The campaign ID this provider is scoped to. */
  campaignId: string;
  /** Fetches all edges pointing to a node (backlinks). */
  getBacklinks: (nodeId: string) => Promise<KBEdge[]>;
  /** Fetches all edges originating from a node (forward links). */
  getForwardLinks: (nodeId: string) => Promise<KBEdge[]>;
  /** BFS traversal returning nodes reachable within `depth` hops. */
  getGraphNeighbors: (nodeId: string, depth?: number) => Promise<KBNode[]>;
  /** Returns all nodes of a given type for the campaign. */
  getNodesByTypeForCampaign: (type: KBNode['type']) => Promise<KBNode[]>;
  /** Case-insensitive label lookup via Dexie index. */
  resolveWikilink: (label: string) => Promise<KBNode | undefined>;
  /** Fetches a single node by ID. */
  getNodeById: (id: string) => Promise<KBNode | undefined>;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextValue | null>(null);

/**
 * Returns the nearest {@link KnowledgeBaseContextValue}.
 *
 * @throws {Error} When called outside a `<KnowledgeBaseProvider>`.
 */

/** Props for the Knowledge Base graph provider. */
export interface KnowledgeBaseProviderProps {
  children: ReactNode;
  campaignId: string;
}

/**
 * Context provider that exposes graph query functions to the component tree.
 */
export function KnowledgeBaseProvider({ children, campaignId }: KnowledgeBaseProviderProps) {
  const getBacklinks = useCallback(
    (nodeId: string) => getEdgesToNode(nodeId),
    []
  );

  const getForwardLinks = useCallback(
    (nodeId: string) => getEdgesFromNode(nodeId),
    []
  );

  const getGraphNeighbors = useCallback(
    async (nodeId: string, depth: number = 1): Promise<KBNode[]> => {
      const visited = new Set<string>();
      let frontier = [nodeId];
      visited.add(nodeId);

      for (let d = 0; d < depth; d++) {
        const nextFrontier: string[] = [];
        for (const nid of frontier) {
          const [outEdges, inEdges] = await Promise.all([
            getEdgesFromNode(nid),
            getEdgesToNode(nid),
          ]);
          for (const e of outEdges) {
            if (!visited.has(e.toId)) {
              visited.add(e.toId);
              nextFrontier.push(e.toId);
            }
          }
          for (const e of inEdges) {
            if (!visited.has(e.fromId)) {
              visited.add(e.fromId);
              nextFrontier.push(e.fromId);
            }
          }
        }
        frontier = nextFrontier;
        if (frontier.length === 0) break;
      }

      // Remove the origin node from results
      visited.delete(nodeId);

      // Fetch all neighbor nodes
      const nodes: KBNode[] = [];
      for (const nid of visited) {
        const node = await getNodeById(nid);
        if (node) nodes.push(node);
      }
      return nodes;
    },
    []
  );

  const getNodesByTypeForCampaign = useCallback(
    (type: KBNode['type']) => getNodesByType(campaignId, type),
    [campaignId]
  );

  const resolveWikilink = useCallback(
    (label: string) => getNodeByLabel(label, campaignId),
    [campaignId]
  );

  const getNodeByIdFn = useCallback(
    (id: string) => getNodeById(id),
    []
  );

  // Every member is already a `useCallback` or the campaign id itself, so the
  // memo is exact and this object now changes identity only when the campaign
  // does — rather than on every render of whatever renders the provider.
  const value = useMemo<KnowledgeBaseContextValue>(
    () => ({
      campaignId,
      getBacklinks,
      getForwardLinks,
      getGraphNeighbors,
      getNodesByTypeForCampaign,
      resolveWikilink,
      getNodeById: getNodeByIdFn,
    }),
    [
      campaignId,
      getBacklinks,
      getForwardLinks,
      getGraphNeighbors,
      getNodesByTypeForCampaign,
      resolveWikilink,
      getNodeByIdFn,
    ],
  );

  return (
    <KnowledgeBaseContext.Provider value={value}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
}

/** The edges read for one node, plus why the read failed when it did. */
export interface EdgeReadResult {
  edges: KBEdge[];
  /**
   * Set when the edge read rejected. Before this field existed the rejection
   * was caught with `.catch(() => {})`, so a storage failure reached the screen
   * as an empty list — "No notes link here yet." — a claim about the user's
   * notes rather than about the database.
   */
  error: string | null;
}

function useEdgeRead(nodeId: string, read: (id: string) => Promise<KBEdge[]>): EdgeReadResult {
  const [state, setState] = useState<EdgeReadResult>({ edges: [], error: null });
  useEffect(() => {
    let mounted = true;
    read(nodeId)
      .then((edges) => { if (mounted) setState({ edges, error: null }); })
      .catch((err: unknown) => {
        console.error(err);
        if (mounted) {
          setState({ edges: [], error: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => { mounted = false; };
  }, [nodeId, read]);
  return state;
}

/**
 * React hook for using backlinks data reactively.
 */
export function useBacklinks(nodeId: string): EdgeReadResult {
  return useEdgeRead(nodeId, getEdgesToNode);
}

/**
 * React hook for using forward links data reactively.
 */
export function useForwardLinks(nodeId: string): EdgeReadResult {
  return useEdgeRead(nodeId, getEdgesFromNode);
}

