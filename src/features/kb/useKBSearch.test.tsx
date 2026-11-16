// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, waitFor } from '@testing-library/react';
import type { KBNode } from '../../types/knowledgeBase';

/**
 * `useKBSearch` builds its index asynchronously. Two ways a search went blank:
 * a query that arrived before the build finished was never re-run (the effect
 * only listened to `query`), and a node written while the vault stayed mounted
 * never reached the index (it listened to `campaignId` only, while the list
 * beside it reloads on `refreshToken`).
 */

const store: { campaign: KBNode[]; gate: Promise<void> } = {
  campaign: [],
  gate: Promise.resolve(),
};

vi.mock('../../storage/repositories/kbNodeRepository', () => ({
  getNodesByCampaign: async () => {
    await store.gate;
    return [...store.campaign];
  },
  getSharedNodes: async () => [],
}));

const { useKBSearch } = await import('./useKBSearch');

function node(id: string, label: string): KBNode {
  return {
    id,
    type: 'note',
    label,
    scope: 'campaign',
    campaignId: 'c1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  store.campaign = [node('n1', 'Harbour master')];
  store.gate = Promise.resolve();
});

afterEach(() => {
  cleanup();
});

describe('useKBSearch', () => {
  it('answers a query that arrived before the index was built', async () => {
    let open!: () => void;
    store.gate = new Promise<void>((resolve) => { open = resolve; });

    const { result } = renderHook(() => useKBSearch('harbour', 'c1'));
    expect(result.current).toEqual([]);

    open();
    await waitFor(() => expect(result.current.map((n) => n.id)).toEqual(['n1']));
  });

  it('finds a node written after mount once the refresh token moves', async () => {
    const { result, rerender } = renderHook(
      ({ query, token }) => useKBSearch(query, 'c1', token),
      { initialProps: { query: '', token: 0 } },
    );
    // Let the first build finish before searching, so this case is only
    // about the rebuild and not about the race above.
    await new Promise((resolve) => setTimeout(resolve, 20));
    rerender({ query: 'harbour', token: 0 });
    await waitFor(() => expect(result.current.map((n) => n.id)).toEqual(['n1']));

    store.campaign = [...store.campaign, node('n2', 'Customs broker')];
    rerender({ query: 'customs', token: 1 });

    await waitFor(() => expect(result.current.map((n) => n.id)).toEqual(['n2']));
  });

  it('returns nothing for a blank query', async () => {
    const { result } = renderHook(() => useKBSearch('   ', 'c1'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toEqual([]);
  });
});
