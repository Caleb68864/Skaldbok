// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

/**
 * A throwing migration left the storage-unavailable screen with only Reload,
 * which runs the same migration again. The screen now offers a raw copy of the
 * data first. Fails on the old screen, which had no such control.
 */

const dumpRawDatabase = vi.fn();
const shareFile = vi.fn();
vi.mock('../storage/db/rawDump', () => ({ dumpRawDatabase: () => dumpRawDatabase() }));
vi.mock('../utils/export/delivery', () => ({ shareFile: (...a: unknown[]) => shareFile(...a) }));

const { StorageUnavailable } = await import('./StorageUnavailable');

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('StorageUnavailable', () => {
  it('saves a raw copy of the data', async () => {
    dumpRawDatabase.mockResolvedValue({ database: 'skaldbok-db', version: 20, exportedAt: '2026-11-21T00:00:00.000Z', stores: { notes: [{}, {}] } });
    shareFile.mockResolvedValue('downloaded');
    render(<StorageUnavailable error="UpgradeError: boom" />);
    fireEvent.click(screen.getByRole('button', { name: /raw copy/i }));

    await waitFor(() => expect(shareFile).toHaveBeenCalled());
    expect(shareFile.mock.calls[0][1]).toBe('skaldbok-raw-copy-2026-11-21.json');
    expect((await screen.findByRole('status')).textContent).toContain('2 rows');
  });

  it('says so when even the raw read fails', async () => {
    dumpRawDatabase.mockRejectedValue(new Error('blocked'));
    render(<StorageUnavailable error="x" />);
    fireEvent.click(screen.getByRole('button', { name: /raw copy/i }));
    expect((await screen.findByRole('status')).textContent).toContain('blocked');
  });
});
