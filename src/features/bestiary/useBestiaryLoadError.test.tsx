// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

/**
 * A failed bestiary read rendered as "No creatures yet. Create your first!".
 * The hook had no error to give; this fails on the old hook.
 */

const listByCampaign = vi.hoisted(() => vi.fn());
vi.mock('../../storage/repositories/creatureTemplateRepository', () => ({
  listByCampaign: (...a: unknown[]) => listByCampaign(...a),
}));

const { useBestiary } = await import('./useBestiary');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useBestiary', () => {
  it('reports a failed read instead of an empty bestiary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    listByCampaign.mockRejectedValue(new Error('read failed'));
    const { result } = renderHook(() => useBestiary('c1'));
    await waitFor(() => expect(result.current.loadError).toContain('read failed'));
  });

  it('has no error when the read succeeds', async () => {
    listByCampaign.mockResolvedValue([]);
    const { result } = renderHook(() => useBestiary('c1'));
    await waitFor(() => expect(listByCampaign).toHaveBeenCalled());
    expect(result.current.loadError).toBeNull();
  });
});
