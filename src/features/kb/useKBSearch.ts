/**
 * MiniSearch-based fuzzy search hook over all KB nodes for the current campaign.
 *
 * @remarks
 * The index is built asynchronously on mount using `addAllAsync` with
 * `chunkSize: 200` to avoid blocking the main thread.
 */

import { useState, useEffect, useRef } from 'react';
import MiniSearch from 'minisearch';
import type { KBNode } from '../../storage/db/client';
import {
  getNodesByCampaign,
  getSharedNodes,
} from '../../storage/repositories/kbNodeRepository';

/**
 * Fuzzy-searches KB nodes by label. Returns matching nodes for the given query.
 *
 * @param query - Search string (partial, fuzzy matching supported).
 * @param campaignId - Campaign to scope the search to.
 * @returns Array of matching {@link KBNode} objects.
 */
export function useKBSearch(query: string, campaignId: string): KBNode[] {
  const [results, setResults] = useState<KBNode[]>([]);
  const indexRef = useRef<MiniSearch<KBNode> | null>(null);
  const nodesRef = useRef<KBNode[]>([]);
  const indexReadyRef = useRef(false);

  // Build index on mount / campaignId change
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

      nodesRef.current = allNodes;
      // Non-blocking chunked indexing
      await miniSearch.addAllAsync(allNodes, { chunkSize: 200 });

      if (!mounted) return;

      indexRef.current = miniSearch;
      indexReadyRef.current = true;
    }

    buildIndex().catch((err) => {
      if (import.meta.env.DEV)
        console.warn('[useKBSearch] Index build failed', err);
    });

    return () => {
      mounted = false;
    };
  }, [campaignId]);

  // Search whenever query changes
  useEffect(() => {
    if (!indexReadyRef.current || !indexRef.current || !query.trim()) {
      setResults([]);
      return;
    }

    const hits = indexRef.current.search(query);
    // Map search results back to full KBNode objects
    const nodes = hits
      .map((hit) => nodesRef.current.find((n) => n.id === hit.id))
      .filter((n): n is KBNode => n !== undefined);
    setResults(nodes);
  }, [query]);

  return results;
}
