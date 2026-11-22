// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { CreatureTemplate } from '../../types/creatureTemplate';

/**
 * The picker's search was try/finally with no catch, and the add was the
 * same. A failed read showed "No matches"; a failed add left the dialog open
 * with nothing said. Both fail on the old picker.
 */

const listByCampaign = vi.hoisted(() => vi.fn());
vi.mock('../../storage/repositories/creatureTemplateRepository', () => ({
  listByCampaign: (...a: unknown[]) => listByCampaign(...a),
  create: vi.fn(),
}));
vi.mock('../../storage/repositories/characterRepository', () => ({ getById: vi.fn() }));
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'c1', system: 'classic-fantasy' }, activeParty: null }),
}));
vi.mock('../systems/useSystemDefinition', () => ({ useSystemDefinition: () => ({ system: null, error: null }) }));

const { EncounterParticipantPicker } = await import('./EncounterParticipantPicker');

const goblin = { id: 't1', campaignId: 'c1', name: 'Goblin', category: 'monster' } as unknown as CreatureTemplate;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EncounterParticipantPicker', () => {
  it('says the search failed rather than "No matches"', async () => {
    listByCampaign.mockRejectedValue(new Error('IndexedDB read failed'));
    render(<EncounterParticipantPicker campaignId="c1" onSelect={vi.fn()} />);

    expect((await screen.findByRole('alert')).textContent).toContain('IndexedDB read failed');
    expect(screen.queryByText('No matches')).toBeNull();
  });

  it('says so when adding the chosen creature fails, and stays open', async () => {
    listByCampaign.mockResolvedValue([goblin]);
    const onClose = vi.fn();
    const onSelect = vi.fn().mockRejectedValue(new Error('That encounter is no longer available'));
    render(<EncounterParticipantPicker campaignId="c1" onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(await screen.findByText('Goblin'));

    expect((await screen.findByRole('alert')).textContent).toContain('no longer available');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after a successful add', async () => {
    listByCampaign.mockResolvedValue([goblin]);
    const onClose = vi.fn();
    render(<EncounterParticipantPicker campaignId="c1" onSelect={vi.fn().mockResolvedValue(undefined)} onClose={onClose} />);
    fireEvent.click(await screen.findByText('Goblin'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
