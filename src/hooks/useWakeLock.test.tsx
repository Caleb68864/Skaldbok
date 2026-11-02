// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useWakeLock } from './useWakeLock';

const appState = vi.hoisted(() => ({
  settings: { wakeLockEnabled: false },
  updateSettings: vi.fn(),
}));
vi.mock('../context/AppStateContext', () => ({ useAppState: () => appState }));

const request = vi.fn();

beforeEach(() => {
  appState.settings = { wakeLockEnabled: false };
  request.mockReset();
  request.mockResolvedValue({ addEventListener: vi.fn(), release: vi.fn().mockResolvedValue(undefined) });
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
});

afterEach(() => {
  cleanup();
});

describe('useWakeLock', () => {
  it('acquires once settings load with the preference on', async () => {
    // Settings arrive after first render. The mount effect ran on [] and only
    // ever saw the default, so a saved preference was ignored at startup.
    const { rerender } = renderHook(() => useWakeLock());
    expect(request).not.toHaveBeenCalled();

    appState.settings = { wakeLockEnabled: true };
    rerender();

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
  });

  it('does not acquire when the preference is off', async () => {
    const { rerender } = renderHook(() => useWakeLock());
    rerender();
    await Promise.resolve();
    expect(request).not.toHaveBeenCalled();
  });
});
