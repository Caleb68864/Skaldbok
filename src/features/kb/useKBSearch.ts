/**
 * MiniSearch-based fuzzy search hook over all KB nodes for the current campaign.
 *
 * @remarks
 * The index is built asynchronously on mount using `addAllAsync` with
 * `chunkSize: 200` to avoid blocking the main thread.
 */

import { useState, useEffect } from 'react';
import MiniSearch from 'minisearch';
import type { KBNode } from '../../storage/db/client';
import {
  getNodesByCampaign,
  getSharedNodes,
} from '../../storage/repositories/kbNodeRepository';

/** A built index and the nodes it was built from. */
interface BuiltIndex {
  search: MiniSearch<KBNode>;
  nodes: KBNode[];
}

/**
 * Fuzzy-searches KB nodes by label. Returns matching nodes for the given query.
 *
 * @remarks
 * The built index is held in state, not a ref, so the search re-runs when a
 * build finishes. With a ref, a query that arrived first (a search box
 * restored with text in it, or a large vault still indexing) stayed blank
 * until the next keystroke.
 *
 * @param query - Search string (partial, fuzzy matching supported).
 * @param campaignId - Campaign to scope the search to.
 * @param refreshToken - Rebuilds the index when it changes. Pass the same token
 *   that reloads the node list beside the search, or a node written while the
 *   list is mounted shows in the list and cannot be searched for.
 * @returns Array of matching {@link KBNode} objects.
 */
export function useKBSearch(query: string, campaignId: string, refreshToken = 0): KBNode[] {
  const [built, setBuilt] = useState<BuiltIndex | null>(null);

  // Build index on mount / campaignId / refreshToken change
  useEffect(() => {
    let mounted = true;

    const miniSearch = new MiniSearch<KBNode>({
      fields: ['label'],
      storeFields: [
        'id',
        'type',
        'label',
        'scope',
        'campaignId',
        'sourceId',
        'createdAt',
        'updatedAt',
      ],
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

      if (!mounted) return;

      // Non-blocking chunked indexing
      await miniSearch.addAllAsync(allNodes, { chunkSize: 200 });

      if (!mounted) return;

      setBuilt({ search: miniSearch, nodes: allNodes });
    }

    buildIndex().catch((err) => {
      if (import.meta.env.DEV)
        console.warn('[useKBSearch] Index build failed', err);
    });

    return () => {
      mounted = false;
    };
  }, [campaignId, refreshToken]);

  // Search whenever the query changes or a build finishes
  const [results, setResults] = useState<KBNode[]>([]);
  useEffect(() => {
    if (!built || !query.trim()) {
      setResults([]);
      return;
    }

    const hits = built.search.search(query);
    // Map search results back to full KBNode objects
    const nodes = hits
      .map((hit) => built.nodes.find((n) => n.id === hit.id))
      .filter((n): n is KBNode => n !== undefined);
    setResults(nodes);
  }, [built, query]);

  return results;
}
