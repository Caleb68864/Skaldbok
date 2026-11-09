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

const createCampaignWithParty = vi.fn();
const softDeleteCampaign = vi.fn();

vi.mock('../../storage/repositories/campaignRepository', () => ({
  getAllCampaigns: () => Promise.resolve(campaigns),
  createCampaignWithParty: (...args: unknown[]) => createCampaignWithParty(...args),
  softDelete: (...args: unknown[]) => softDeleteCampaign(...args),
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

function renderPreview(
  bundle: BundleEnvelope,
  onImport = vi.fn().mockResolvedValue(undefined),
  onCancel = vi.fn(),
) {
  render(
    <ImportPreview
      bundle={bundle}
      warnings={[]}
      conflicts={[]}
      onImport={onImport}
      onCancel={onCancel}
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
  createCampaignWithParty.mockReset();
  softDeleteCampaign.mockReset();
  softDeleteCampaign.mockResolvedValue(undefined);
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

const sessionRow = {
  id: 'sess-1',
  campaignId: 'camp-1',
  title: 'Session One',
  status: 'ended' as const,
  date: '2026-01-01',
  startedAt: NOW,
  schemaVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

/**
 * Decision 5 asked that import "create its own campaign or ask the user to
 * create one". A session bundle has no campaign of its own, so on a fresh
 * install the dialog used to send the user away to the campaign menu — losing
 * the picked file — rather than asking. It now asks in place.
 */
describe('ImportPreview creating a campaign to import into', () => {
  it('asks for a campaign on a fresh install and imports into the one created', async () => {
    createCampaignWithParty.mockImplementation(async (data: { name: string; system: string }) => ({
      id: 'new-1',
      name: data.name,
      system: data.system,
      status: 'active',
      activePartyId: 'party-1',
      schemaVersion: 1,
      createdAt: NOW,
      updatedAt: NOW,
    }));
    const onImport = renderPreview(
      envelope({ type: 'session', system: 'traveller', contents: { sessions: [sessionRow] } }),
    );

    await waitFor(() => expect(screen.getByTestId('import-create-campaign')).toBeTruthy());
    expect(importButton().disabled).toBe(true);

    const createButton = screen.getByRole('button', { name: 'Create campaign' }) as HTMLButtonElement;
    // No name, no campaign: nothing is invented on the user's behalf.
    expect(createButton.disabled).toBe(true);

    // The exported ruleset is the default, since this build ships it.
    expect((screen.getByLabelText('New campaign game system') as HTMLSelectElement).value).toBe('traveller');

    fireEvent.change(screen.getByLabelText('New campaign name'), { target: { value: '  Spinward  ' } });
    fireEvent.click(createButton);

    await waitFor(() => expect(createCampaignWithParty).toHaveBeenCalledTimes(1));
    expect(createCampaignWithParty.mock.calls[0][0]).toEqual({
      name: 'Spinward',
      system: 'traveller',
      status: 'active',
    });
    await waitFor(() => expect(importButton().disabled).toBe(false));
    // Creating is not importing: the commit is still the user's click.
    expect(onImport).not.toHaveBeenCalled();

    fireEvent.click(importButton());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].targetCampaignId).toBe('new-1');
  });

  it('falls back to the default system when the exported one is not shipped', async () => {
    renderPreview(envelope({ type: 'session', system: 'homebrew-x', contents: { sessions: [sessionRow] } }));
    await waitFor(() => expect(screen.getByTestId('import-create-campaign')).toBeTruthy());
    expect((screen.getByLabelText('New campaign game system') as HTMLSelectElement).value).toBe('classic-fantasy');
  });

  it('reports a failed create and leaves the import blocked', async () => {
    createCampaignWithParty.mockRejectedValue(new Error('QuotaExceededError'));
    const onImport = renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }));

    await waitFor(() => expect(screen.getByTestId('import-create-campaign')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('New campaign name'), { target: { value: 'Spinward' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be created'));
    expect(importButton().disabled).toBe(true);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('offers to create one beside an existing list too', async () => {
    campaigns = [
      { id: 'local-1', name: 'Local Campaign', system: 'classic-fantasy', status: 'active', schemaVersion: 1, createdAt: NOW, updatedAt: NOW } as Campaign,
    ];
    renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }));

    await waitFor(() => expect(screen.getByText('Or create a new campaign')).toBeTruthy());
    expect(screen.queryByTestId('import-create-campaign')).toBeNull();
    fireEvent.click(screen.getByText('Or create a new campaign'));
    expect(screen.getByTestId('import-create-campaign')).toBeTruthy();
    fireEvent.click(screen.getByText('Pick an existing one'));
    expect(screen.queryByTestId('import-create-campaign')).toBeNull();
  });
});

/**
 * Creating a campaign commits before the import does, so a campaign the import
 * did not use is soft-deleted on the way out rather than left behind empty.
 */
describe('ImportPreview discarding a campaign it created but did not use', () => {
  beforeEach(() => {
    createCampaignWithParty.mockImplementation(async (data: { name: string; system: string }) => ({
      id: 'new-1', name: data.name, system: data.system, status: 'active',
      activePartyId: 'party-1', schemaVersion: 1, createdAt: NOW, updatedAt: NOW,
    }));
  });

  async function createOne() {
    await waitFor(() => expect(screen.getByTestId('import-create-campaign')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('New campaign name'), { target: { value: 'Spinward' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create campaign' }));
    await waitFor(() => expect(importButton().disabled).toBe(false));
  }

  it('soft-deletes it when the dialog is cancelled', async () => {
    const onCancel = vi.fn();
    renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }), undefined, onCancel);
    await createOne();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
    expect(softDeleteCampaign).toHaveBeenCalledWith('new-1');
  });

  it('still closes when the discard fails', async () => {
    softDeleteCampaign.mockRejectedValue(new Error('boom'));
    const onCancel = vi.fn();
    renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }), undefined, onCancel);
    await createOne();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it('keeps it when the import goes into it', async () => {
    const onImport = renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }));
    await createOne();

    fireEvent.click(importButton());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(softDeleteCampaign).not.toHaveBeenCalled();
  });

  it('discards it when the user then imports into an existing campaign instead', async () => {
    campaigns = [
      { id: 'local-1', name: 'Local Campaign', system: 'classic-fantasy', status: 'active', schemaVersion: 1, createdAt: NOW, updatedAt: NOW } as Campaign,
    ];
    const onImport = renderPreview(envelope({ type: 'session', contents: { sessions: [sessionRow] } }));
    await waitFor(() => expect(screen.getByText('Or create a new campaign')).toBeTruthy());
    fireEvent.click(screen.getByText('Or create a new campaign'));
    await createOne();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'local-1' } });
    fireEvent.click(importButton());
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0][0].targetCampaignId).toBe('local-1');
    await waitFor(() => expect(softDeleteCampaign).toHaveBeenCalledWith('new-1'));
  });
});
