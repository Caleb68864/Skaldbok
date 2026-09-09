// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { ImportPreview } from './ImportPreview';
import type { BundleEnvelope } from '../../types/bundle';
import type { Campaign } from '../../types/campaign';

/**
 * The import dialog's campaign requirement.
 *
 * @remarks
 * The dialog used to decide from `bundle.type` alone: `character` and `session`
 * bundles were given a mandatory "Import into campaign" selector and the Import
 * button stayed disabled until one was chosen. On a fresh install the selector
 * had nothing in it, so a character could not be restored at all — and the
 * demand was never right anyway, because `CharacterRecord` carries no
 * `campaignId`.
 *
 * These render the real dialog because the regression is a disabled button, not
 * a wrong return value.
 */

let campaigns: Campaign[] = [];

vi.mock('../../storage/repositories/campaignRepository', () => ({
  getAllCampaigns: () => Promise.resolve(campaigns),
}));

const NOW = '2026-01-01T00:00:00.000Z';

function envelope(partial: Partial<BundleEnvelope>): BundleEnvelope {
  return {
    version: 1,
    type: 'campaign',
    exportedAt: NOW,
    system: 'classic-fantasy',
    contents: {},
    ...partial,
  } as BundleEnvelope;
}

const noteRow = {
  id: 'note-1',
  campaignId: 'camp-1',
  title: 'A note',
  type: 'generic',
  status: 'active' as const,
  scope: 'shared' as const,
  pinned: false,
  content: '',
  schemaVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

function renderPreview(bundle: BundleEnvelope, onImport = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ImportPreview
      bundle={bundle}
      warnings={[]}
      conflicts={[]}
      onImport={onImport}
      onCancel={vi.fn()}
    />,
  );
  return onImport;
}

/** The dialog's commit button, whatever count it currently shows. */
function importButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Import \d+ items$/ }) as HTMLButtonElement;
}

beforeEach(() => {
  campaigns = [];
});

// Testing Library only auto-cleans when Vitest globals are on, and they are not.
afterEach(cleanup);

describe('ImportPreview on a device with no campaigns', () => {
  it('lets a character bundle import with no campaign chosen', async () => {
    const onImport = renderPreview(
      envelope({ type: 'character', contents: { characters: [{ id: 'char-1', name: 'Astrid' }] } }),
    );

    await waitFor(() => expect(importButton().disabled).toBe(false));
    expect(screen.queryByText('Import into campaign')).toBeNull();

    fireEvent.click(importButton());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].targetCampaignId).toBeUndefined();
  });

  it('restores a campaign bundle under its own campaign without a selector', async () => {
    const onImport = renderPreview(
      envelope({
        type: 'campaign',
        contents: {
          campaign: {
            id: 'camp-1',
            name: 'The Iron Circle',
            system: 'classic-fantasy',
            status: 'active',
            schemaVersion: 1,
            createdAt: NOW,
            updatedAt: NOW,
          },
          notes: [noteRow],
        },
      }),
    );

    await waitFor(() => expect(importButton().disabled).toBe(false));
    expect(screen.getByTestId('import-restores-campaign').textContent).toContain('The Iron Circle');
    expect(screen.queryByText('Import into campaign')).toBeNull();

    fireEvent.click(importButton());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    // Parented onto the campaign it arrived with, not one the user invented.
    expect(onImport.mock.calls[0][0].targetCampaignId).toBe('camp-1');
  });

  it('says so plainly when campaign-scoped rows have nowhere to go', async () => {
    renderPreview(
      envelope({
        type: 'character',
        contents: { characters: [{ id: 'char-1', name: 'Astrid' }], notes: [noteRow] },
      }),
    );

    await waitFor(() => expect(screen.getByTestId('import-no-campaigns')).toBeTruthy());
    expect(screen.getByTestId('import-no-campaigns').textContent).toContain('Notes');
    // Blocked while the notes are still ticked — importing them would write rows
    // pointing at a campaign that is not there.
    expect(importButton().disabled).toBe(true);
  });

  it('unblocks the character once its homeless notes are unticked', async () => {
    renderPreview(
      envelope({
        type: 'character',
        contents: { characters: [{ id: 'char-1', name: 'Astrid' }], notes: [noteRow] },
      }),
    );

    await waitFor(() => expect(importButton().disabled).toBe(true));

    const notesCheckbox = screen
      .getByText('Notes')
      .closest('div')!
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(notesCheckbox);

    await waitFor(() => expect(importButton().disabled).toBe(false));
    expect(screen.queryByTestId('import-no-campaigns')).toBeNull();
  });
});

describe('ImportPreview on a device that already has campaigns', () => {
  beforeEach(() => {
    campaigns = [
      {
        id: 'local-1',
        name: 'Local Campaign',
        system: 'classic-fantasy',
        status: 'active',
        schemaVersion: 1,
        createdAt: NOW,
        updatedAt: NOW,
      } as Campaign,
    ];
  });

  it('still asks where a session bundle should land', async () => {
    renderPreview(
      envelope({
        type: 'session',
        contents: {
          sessions: [
            {
              id: 'sess-1',
              campaignId: 'camp-1',
              title: 'Session One',
              status: 'ended',
              date: '2026-01-01',
              startedAt: NOW,
              schemaVersion: 1,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        },
      }),
    );

    await waitFor(() => expect(screen.getByText('Import into campaign')).toBeTruthy());
    expect(importButton().disabled).toBe(true);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'local-1' } });
    await waitFor(() => expect(importButton().disabled).toBe(false));
  });
});
