// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import type { BundleEnvelope } from '../../types/bundle';
import type { Campaign } from '../../types/campaign';

/**
 * Where the user lands after an import.
 *
 * @remarks
 * With no campaign open there is nothing to switch away from, so the hook opens
 * the campaign the rows went into: the bundle's own campaign, or — for a session
 * or notes bundle — the one the user chose (on a fresh install, typically one
 * just created from the import dialog). With a campaign already open it leaves
 * the user where they are. Roadmap `U1`/`U2`.
 */

const NOW = '2026-01-01T00:00:00.000Z';

let activeCampaign: Campaign | null = null;
const setActiveCampaign = vi.fn();
const showToast = vi.fn();
const getCampaignById = vi.fn();
let bundle: BundleEnvelope;

vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign, setActiveCampaign }),
}));
vi.mock('../../storage/repositories/campaignRepository', () => ({
  getCampaignById: (...args: unknown[]) => getCampaignById(...args),
}));
vi.mock('../../utils/import/readTextFile', () => ({ readTextFile: () => Promise.resolve('{}') }));
vi.mock('../../utils/import/bundleParser', () => ({
  parseBundle: () => ({ success: true, bundle, warnings: [] }),
  verifyContentHash: () => Promise.resolve(true),
}));
vi.mock('../../utils/import/mergeEngine', () => ({
  mergeBundle: () => Promise.resolve({ inserted: 1, updated: 0, skipped: 0, errors: [] }),
}));
vi.mock('../kb/linkSyncEngine', () => ({ bulkRebuildGraph: () => Promise.resolve() }));
vi.mock('../../storage/db/client', () => ({
  db: { table: () => ({ get: () => Promise.resolve(undefined) }) },
}));

const { useImportActions } = await import('./useImportActions');

const sessionRow = {
  id: 'sess-1', campaignId: 'camp-1', title: 'Session One', status: 'ended', date: '2026-01-01',
  startedAt: NOW, schemaVersion: 1, createdAt: NOW, updatedAt: NOW,
};

/** Makes the hidden file input "pick" a file as soon as it is clicked. */
function stubFilePicker() {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    const file = new File(['{}'], 'backup.skaldbok.json');
    Object.defineProperty(this, 'files', { value: [file], configurable: true });
    this.onchange?.({ target: this } as unknown as Event);
  });
}

async function importSessionInto(targetCampaignId: string) {
  const { result } = renderHook(() => useImportActions());
  await act(async () => { await result.current.startImport(); });
  await waitFor(() => expect(result.current.showPreview).toBe(true));
  await act(async () => {
    await result.current.executeImport({
      targetCampaignId,
      selectedEntityTypes: new Set(['sessions']) as never,
    });
  });
}

beforeEach(() => {
  activeCampaign = null;
  setActiveCampaign.mockReset();
  showToast.mockReset();
  getCampaignById.mockReset();
  getCampaignById.mockImplementation(async (id: string) => ({ id }));
  bundle = {
    version: 1, type: 'session', exportedAt: NOW, system: 'classic-fantasy',
    contents: { sessions: [sessionRow] },
  } as unknown as BundleEnvelope;
  stubFilePicker();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useImportActions landing campaign', () => {
  it('opens the chosen campaign when none was open', async () => {
    await importSessionInto('new-1');
    expect(setActiveCampaign).toHaveBeenCalledWith('new-1');
  });

  it('leaves an open campaign alone', async () => {
    activeCampaign = { id: 'other' } as Campaign;
    await importSessionInto('new-1');
    expect(setActiveCampaign).not.toHaveBeenCalled();
  });

  it('does not open a campaign that is not in the database', async () => {
    getCampaignById.mockResolvedValue(undefined);
    await importSessionInto('gone');
    expect(setActiveCampaign).not.toHaveBeenCalled();
  });
});
