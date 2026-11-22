// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useRoute } from './useRoute';

const plans = vi.hoisted(() => ({ getOrCreateForCampaign: vi.fn(), update: vi.fn() }));
vi.mock('../../storage/repositories/routePlanRepository', () => plans);
const stopsRepo = vi.hoisted(() => ({ listByCampaign: vi.fn() }));
vi.mock('../../storage/repositories/routeRepository', () => stopsRepo);
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'c1', system: 'traveller' }, activeSession: null }),
}));
vi.mock('../systems/useSystemDefinition', () => ({ useSystemDefinition: () => ({ system: null, error: null }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useRoute.updatePlan', () => {
  it('rejects and shows what is stored when the write fails', async () => {
    stopsRepo.listByCampaign.mockResolvedValue([]);
    plans.getOrCreateForCampaign.mockResolvedValue({ id: 'p1', campaignId: 'c1', targetNote: 'stored' });
    plans.update.mockRejectedValue(new Error('disk full'));
    const { result } = renderHook(() => useRoute());
    await waitFor(() => expect(result.current.plan?.targetNote).toBe('stored'));

    await act(async () => {
      await expect(result.current.updatePlan({ targetNote: 'typed' })).rejects.toThrow('disk full');
    });

    expect(result.current.plan?.targetNote).toBe('stored');
  });
});

/**
 * A failed route read was `.catch(console.error)`: `stops` stayed `[]` and the
 * screen said "No stops yet". Fails on the old hook, which had no `loadError`.
 */
describe('useRoute when the route cannot be read', () => {
  it('reports the failure rather than an empty route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stopsRepo.listByCampaign.mockRejectedValue(new Error('IndexedDB read failed'));
    const { result } = renderHook(() => useRoute());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toContain('IndexedDB read failed');
  });

  it('has no error when the read succeeds', async () => {
    stopsRepo.listByCampaign.mockResolvedValue([]);
    plans.getOrCreateForCampaign.mockResolvedValue({ id: 'p1', campaignId: 'c1' });
    const { result } = renderHook(() => useRoute());

    await waitFor(() => expect(result.current.plan?.id).toBe('p1'));
    expect(result.current.loadError).toBeNull();
  });
});
