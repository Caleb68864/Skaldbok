// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useSessionLog } from './useSessionLog';

const createSessionLogNote = vi.hoisted(() => vi.fn());
vi.mock('../../storage/noteCreationService', () => ({ createSessionLogNote }));
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({
    activeSession: { id: 's1', campaignId: 'c1' },
    activeCampaign: { id: 'c1', system: 'classic-fantasy' },
  }),
}));
vi.mock('../systems/useSystemDefinition', () => ({
  useSystemDefinition: () => ({ system: null, error: null }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  createSessionLogNote.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useSessionLog resource buffer', () => {
  it('keeps a change logged while the previous batch is being written', async () => {
    let finishFirstWrite = (_: unknown) => {};
    createSessionLogNote.mockImplementationOnce(() => new Promise(resolve => { finishFirstWrite = resolve; }));
    createSessionLogNote.mockResolvedValue({ id: 'n2' });
    const { result } = renderHook(() => useSessionLog());

    await act(async () => { await result.current.logHPChange('Eira', 10, 9, 10); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(createSessionLogNote).toHaveBeenCalledTimes(1);

    // The first write is still in flight. The buffer was only reset after it, so
    // this delta landed in the old batch and was then wiped with it.
    await act(async () => { await result.current.logHPChange('Eira', 9, 8, 10); });
    await act(async () => { finishFirstWrite({ id: 'n1' }); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    expect(createSessionLogNote).toHaveBeenCalledTimes(2);
    expect(createSessionLogNote.mock.calls[1][0].title).toMatch(/Took 1 .*8\/10/);
  });
});
