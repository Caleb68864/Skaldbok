// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { useAppSettings } from './useAppSettings';

/**
 * A settings write that failed was recorded as `error` and read by nothing,
 * while the UI kept the new value. It looked saved until a reload brought the
 * old one back. The first two cases fail on the old hook; the third on the
 * old shell, which had no reader for the error.
 */

const repo = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock('../../storage/repositories/settingsRepository', () => repo);

const appState = vi.hoisted(() => ({ settingsError: null as string | null, settingsErrorCount: 0 }));
const showToast = vi.hoisted(() => vi.fn());
vi.mock('../../context/AppStateContext', () => ({ useAppState: () => appState }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  repo.get.mockReset();
  repo.save.mockReset();
  showToast.mockReset();
});

async function loadedHook() {
  repo.get.mockResolvedValue({ theme: 'light' });
  repo.save.mockResolvedValue(undefined);
  const hook = renderHook(() => useAppSettings());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('useAppSettings when a save fails', () => {
  it('puts the old value back and reports the failure', async () => {
    const { result } = await loadedHook();
    repo.save.mockRejectedValueOnce(new Error('QuotaExceededError'));

    await act(async () => { await result.current.updateSettings({ theme: 'dark' as never }); });

    expect(result.current.settings.theme).toBe('light');
    expect(result.current.error).toContain('QuotaExceededError');
  });

  it('counts a second identical failure as a new one', async () => {
    // The toast keys on this. The message alone does not change on a repeat.
    const { result } = await loadedHook();
    repo.save.mockRejectedValue(new Error('disk full'));

    await act(async () => { await result.current.updateSettings({ theme: 'dark' as never }); });
    await act(async () => { await result.current.updateSettings({ theme: 'dark' as never }); });

    expect(result.current.errorCount).toBe(2);
  });

  it('keeps the new value when the save lands', async () => {
    const { result } = await loadedHook();
    await act(async () => { await result.current.updateSettings({ theme: 'dark' as never }); });
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.error).toBeNull();
  });
});

describe('SettingsSaveErrorToast', () => {
  it('shows a failed save as an error toast', async () => {
    const { SettingsSaveErrorToast } = await import('../../components/shell/SettingsSaveErrorToast');
    appState.settingsError = 'Failed to save settings: disk full';
    appState.settingsErrorCount = 1;
    const { rerender } = render(<SettingsSaveErrorToast />);
    expect(showToast).toHaveBeenCalledWith('Failed to save settings: disk full', 'error');
    appState.settingsErrorCount = 2;
    rerender(<SettingsSaveErrorToast />);
    expect(showToast).toHaveBeenCalledTimes(2);
    appState.settingsError = null;
    appState.settingsErrorCount = 0;
  });
});
