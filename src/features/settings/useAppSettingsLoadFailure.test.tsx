// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useAppSettings } from './useAppSettings';

const repo = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../storage/repositories/settingsRepository', () => repo);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAppSettings after a failed load', () => {
  it('does not overwrite stored settings with defaults', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    repo.get.mockRejectedValue(new Error('read failed'));
    repo.save.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAppSettings());
    await waitFor(() => expect(result.current.storageError).toBeTruthy());

    await act(async () => { await result.current.updateSettings({ theme: 'dark' as never }); });

    expect(repo.save).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });
});
