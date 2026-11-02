// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useRoute } from './useRoute';

const plans = vi.hoisted(() => ({ getOrCreateForCampaign: vi.fn(), update: vi.fn() }));
vi.mock('../../storage/repositories/routePlanRepository', () => plans);
vi.mock('../../storage/repositories/routeRepository', () => ({ listByCampaign: vi.fn().mockResolvedValue([]) }));
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'c1', system: 'traveller' }, activeSession: null }),
}));
vi.mock('../systems/useSystemDefinition', () => ({ useSystemDefinition: () => ({ system: null, error: null }) }));

afterEach(cleanup);

describe('useRoute.updatePlan', () => {
  it('rejects and shows what is stored when the write fails', async () => {
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
