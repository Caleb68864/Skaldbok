// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

/**
 * What is allowed to reset the backup reminder.
 *
 * @remarks
 * `StorageSafetyCard` tells the user, in danger red when it is stale,
 * "Exporting a campaign is the only copy that survives this device." It turns
 * green on `settings.lastBackupAt`, and `exportCampaign` is the only writer of
 * that value — correctly, since a campaign bundle is the only export that can
 * restore a campaign.
 *
 * What it wrote it on was the problem. `await deliverBundle(...)` bottomed out
 * in a `.click()` on an anchor that was never in the document, whose object URL
 * was revoked on the next synchronous line, in a function returning `void`. And
 * a share the user *cancelled* fell through to that same forced download, so
 * dismissing the share sheet reset the reminder too.
 *
 * These tests drive the hook with delivery outcomes it could not previously
 * produce.
 */

const showToast = vi.fn();
const updateSettings = vi.fn().mockResolvedValue(undefined);
const deliverBundle = vi.fn();

vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'camp-1', name: 'The Iron Circle', system: 'classic-fantasy' } }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../../context/AppStateContext', () => ({
  useAppState: () => ({ settings: {}, updateSettings, isLoading: false }),
}));
vi.mock('../../utils/export/collectors', () => ({
  collectCampaignBundle: vi.fn().mockResolvedValue({ success: true, contents: {} }),
  collectSessionBundle: vi.fn(),
  collectCharacterBundle: vi.fn(),
}));
vi.mock('../../utils/export/bundleSerializer', () => ({
  serializeBundle: vi.fn().mockResolvedValue('{}'),
  deliverBundle: (...args: unknown[]) => deliverBundle(...args),
}));

const { useExportActions } = await import('./useExportActions');

describe('lastBackupAt is only written when a file actually left the device', () => {
  beforeEach(() => {
    showToast.mockClear();
    updateSettings.mockClear();
    deliverBundle.mockReset();
  });

  afterEach(cleanup);

  it('records the backup when the bundle is delivered', async () => {
    deliverBundle.mockResolvedValue('downloaded');
    const { result } = renderHook(() => useExportActions());
    await act(async () => {
      await result.current.exportCampaign('camp-1');
    });
    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({ lastBackupAt: expect.any(String) }),
    );
    expect(showToast).toHaveBeenCalledWith('Campaign exported');
  });

  it('does not record a backup the user cancelled', async () => {
    deliverBundle.mockResolvedValue('cancelled');
    const { result } = renderHook(() => useExportActions());
    await act(async () => {
      await result.current.exportCampaign('camp-1');
    });
    expect(
      updateSettings,
      'dismissing the share sheet used to fall through to a forced download, so the '
      + 'safety card went green on an export the user had just declined.',
    ).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Export cancelled');
  });

  it('does not record a backup when delivery could not be started', async () => {
    deliverBundle.mockRejectedValue(new Error('Cannot download backup.json: no object URLs.'));
    const { result } = renderHook(() => useExportActions());
    await act(async () => {
      await result.current.exportCampaign('camp-1');
    });
    expect(updateSettings).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Export failed. Please try again.');
  });
});
