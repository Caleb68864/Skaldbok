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

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
 * Shape of the value provided by {@link KnowledgeBaseContext}.
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

  const value: KnowledgeBaseContextValue = {
    campaignId,
    getBacklinks,
    getForwardLinks,
    getGraphNeighbors,
    getNodesByTypeForCampaign,
    resolveWikilink,
    getNodeById: getNodeByIdFn,
  };

  return (
    <KnowledgeBaseContext.Provider value={value}>
      {children}
    </KnowledgeBaseContext.Provider>
  );
}

/**
 * React hook for using backlinks data reactively.
 */
export function useBacklinks(nodeId: string): KBEdge[] {
  const [edges, setEdges] = useState<KBEdge[]>([]);
  useEffect(() => {
    let mounted = true;
    getEdgesToNode(nodeId)
      .then((result) => { if (mounted) setEdges(result); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [nodeId]);
  return edges;
}

/**
 * React hook for using forward links data reactively.
 */
export function useForwardLinks(nodeId: string): KBEdge[] {
  const [edges, setEdges] = useState<KBEdge[]>([]);
  useEffect(() => {
    let mounted = true;
    getEdgesFromNode(nodeId)
      .then((result) => { if (mounted) setEdges(result); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [nodeId]);
  return edges;
}

/**
 * React hook for using graph neighbors data reactively.
 */
export function useGraphNeighbors(nodeId: string, depth: number = 1): KBNode[] {
  const [nodes, setNodes] = useState<KBNode[]>([]);
  const kb = useKnowledgeBase();
  useEffect(() => {
    let mounted = true;
    kb.getGraphNeighbors(nodeId, depth)
      .then((result) => { if (mounted) setNodes(result); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [nodeId, depth, kb]);
  return nodes;
}
