// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { Encounter } from '../../types/encounter';

/**
 * The combat view's writes were awaited with no `catch`, from `onClick`. A
 * failed write was an unhandled rejection and nothing changed on screen: Next
 * Round did nothing, an added event vanished along with its description, and
 * an encounter deleted elsewhere was ignored. The failure cases fail on the
 * old view.
 */

const repo = vi.hoisted(() => ({
  update: vi.fn(),
  getById: vi.fn(),
  updateParticipant: vi.fn(),
  addRepresentedParticipants: vi.fn(),
}));
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../storage/repositories/encounterRepository', () => repo);
vi.mock('../../storage/repositories/creatureTemplateRepository', () => ({
  getById: vi.fn(async () => undefined),
  listByCampaign: vi.fn(async () => []),
  create: vi.fn(),
}));
vi.mock('../../storage/repositories/entityLinkRepository', () => ({ getLinksFrom: vi.fn(async () => []) }));
vi.mock('./ParticipantDrawer', () => ({ ParticipantDrawer: () => null }));
vi.mock('./QuickCreateParticipantFlow', () => ({ QuickCreateParticipantFlow: () => null }));
vi.mock('../persistence/autosaveFlush', () => ({ registerFlush: () => ({ id: 'x', unregister: () => {} }) }));
vi.mock('../systems/engine', () => ({
  useSystemEngineFor: () => ({ logActions: [{ id: 'attack', label: 'Attack' }] }),
}));
vi.mock('../systems/useSystemDefinition', () => ({ useSystemDefinition: () => ({ system: null, error: null }) }));
vi.mock('../session/useSessionLog', () => ({ useSessionLog: () => ({ logToSession: vi.fn() }) }));
vi.mock('../session/SessionRefreshContext', () => ({ useSessionRefreshSafe: () => null }));
vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeParty: null, activeCampaign: { id: 'c1', system: 'classic-fantasy' } }),
}));
vi.mock('../../context/ToastContext', () => ({ useToast: () => ({ showToast }) }));
vi.mock('./addPartyCharactersToEncounter', () => ({ addPartyCharactersToEncounter: vi.fn() }));

const { CombatEncounterView } = await import('./CombatEncounterView');

const encounter = {
  id: 'e1', campaignId: 'c1', sessionId: 's1', title: 'Ambush', type: 'combat', status: 'active',
  participants: [], combatData: { currentRound: 1, events: [] },
  schemaVersion: 1, createdAt: 'x', updatedAt: 'x',
} as unknown as Encounter;

beforeEach(() => {
  vi.clearAllMocks();
  repo.getById.mockResolvedValue(encounter);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CombatEncounterView writes', () => {
  it('says so when the next round could not be saved', async () => {
    repo.update.mockRejectedValue(new Error('disk full'));
    render(<CombatEncounterView encounter={encounter} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next round/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(String(showToast.mock.calls[0][0])).toContain('disk full');
    expect(showToast.mock.calls[0][1]).toBe('error');
  });

  it('says so when the encounter is gone', async () => {
    repo.update.mockResolvedValue(undefined);
    render(<CombatEncounterView encounter={encounter} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /next round/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('That encounter is no longer available', 'error'));
  });

  it('keeps an event description that could not be saved', async () => {
    repo.update.mockRejectedValue(new Error('disk full'));
    render(<CombatEncounterView encounter={encounter} onClose={vi.fn()} />);
    const input = screen.getByLabelText('Event description') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Goblin flees' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(input.value).toBe('Goblin flees');
  });

  it('clears the description once the event is saved', async () => {
    repo.update.mockResolvedValue(encounter);
    render(<CombatEncounterView encounter={encounter} onClose={vi.fn()} />);
    const input = screen.getByLabelText('Event description') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Goblin flees' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(input.value).toBe(''));
    expect(showToast).not.toHaveBeenCalled();
  });
});
