// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TravellerBriefingScreen from '../../screens/TravellerBriefingScreen';

const mocks = vi.hoisted(() => ({
  session: { id: 'session-1', campaignId: 'campaign-1', title: 'Arrival at Zila', date: '2026-09-26' } as { id: string; campaignId: string; title: string; date: string } | null,
  logToSession: vi.fn(),
  updateSettings: vi.fn(),
  loadWikiArticle: vi.fn(),
  createRouteStop: vi.fn(),
  getCharacter: vi.fn(),
  listContainers: vi.fn(),
  gearRules: { review: vi.fn() },
  party: null as { members: Array<{ linkedCharacterId: string }> } | null,
  gearEnabled: false,
  sectors: [] as string[],
  filters: { starports: [] as string[], gasGiantOnly: false, zone: 'all' as 'all' | 'noRed' | 'greenOnly' },
  world: {
    name: 'Zila', sector: 'Spinward Marches', hex: '2908', subsector: 'Aramis',
    uwp: 'E556727-7', zone: 'A', bases: '', remarks: 'Ag Pz', pbg: '701',
    allegiance: 'ImDd', stellar: 'K6 V M3 V', ix: '{-1}', ex: '(967-1)',
    cx: '[7655]', nobility: 'BC', worlds: '8',
  },
}));

vi.mock('../campaign/CampaignContext', () => ({
  useCampaignContext: () => ({ activeCampaign: { id: 'campaign-1', system: 'traveller' }, activeSession: mocks.session, activeParty: mocks.party }),
}));
vi.mock('../session/useSessionLog', () => ({ useSessionLog: () => ({ logToSession: mocks.logToSession }) }));
vi.mock('../systems/useSystemDefinition', () => ({ useSystemDefinition: () => ({ system: {} }) }));
vi.mock('../systems/engine', () => ({ getEngine: () => ({
  landingBriefing: { label: 'Worlds' },
  routeMap: { worldToStop: (world: typeof mocks.world) => ({ name: world.name, values: { sector: world.sector, hex: world.hex, uwp: world.uwp } }) },
  gearRestrictions: mocks.gearEnabled ? mocks.gearRules : undefined,
}) }));
vi.mock('./useBriefingPreferences', () => ({
  useBriefingPreferences: () => ({ sectors: mocks.sectors, jumpRange: 2, filters: mocks.filters, starportCodes: ['A', 'B', 'C', 'D', 'E', 'X'], recent: [mocks.world], overrides: {}, updateSettings: mocks.updateSettings }),
}));
vi.mock('./worldData', async importOriginal => ({
  ...await importOriginal<typeof import('./worldData')>(),
  loadSectorBasic: vi.fn(async () => []),
  loadWorld: vi.fn(async () => mocks.world),
  loadNearbyWorlds: vi.fn(async () => [{ world: { ...mocks.world, name: 'Pysadi', hex: '3008', uwp: 'C5766D8-5' }, distance: 1 }]),
}));
vi.mock('./wikiData', () => ({ loadWikiArticle: mocks.loadWikiArticle }));
vi.mock('../../storage/repositories/routeRepository', () => ({ create: mocks.createRouteStop }));
vi.mock('../../storage/repositories/characterRepository', () => ({ getById: mocks.getCharacter }));
vi.mock('../../storage/repositories/inventoryContainerRepository', () => ({ list: mocks.listContainers }));

function renderWorlds() { return render(<MemoryRouter><TravellerBriefingScreen /></MemoryRouter>); }

async function selectZila() {
  fireEvent.focus(screen.getByRole('combobox', { name: 'World' }));
  const option = await screen.findByRole('option', { name: /Zila/ });
  fireEvent.click(option.querySelector('button')!);
  await screen.findByRole('button', { name: 'Build weather report' });
}

async function buildReport(expectEnabled = true) {
  fireEvent.click(screen.getByRole('button', { name: 'Build weather report' }));
  await screen.findByRole('button', { name: 'Save to session log' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save to session log' }).hasAttribute('disabled')).toBe(!expectEnabled));
}

describe('Traveller briefing session log action', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mocks.session = { id: 'session-1', campaignId: 'campaign-1', title: 'Arrival at Zila', date: '2026-09-26' };
    mocks.logToSession.mockReset().mockResolvedValue('note-1');
    mocks.updateSettings.mockReset().mockResolvedValue(undefined);
    mocks.loadWikiArticle.mockReset().mockResolvedValue(null);
    mocks.createRouteStop.mockReset().mockResolvedValue({ id: 'route-stop-1' });
    mocks.getCharacter.mockReset().mockResolvedValue({ name: 'Milo', weapons: [], inventory: [] });
    mocks.listContainers.mockReset().mockResolvedValue([]);
    mocks.gearRules.review.mockReset().mockReturnValue([]);
    mocks.party = null;
    mocks.gearEnabled = false;
  });

  it('browses a world and nearby destinations before requesting Wiki data', async () => {
    renderWorlds();
    await selectZila();
    expect((screen.getByRole('textbox', { name: 'Date' }) as HTMLInputElement).value).toBe('2026-09-26');
    expect((screen.getByRole('textbox', { name: 'Session' }) as HTMLInputElement).value).toBe('Arrival at Zila');
    expect(mocks.loadWikiArticle).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save to session log' })).toBeNull();
    await screen.findByRole('button', { name: /Pysadi/ });
    await buildReport();
    expect(mocks.loadWikiArticle).toHaveBeenCalledTimes(1);
  });

  it('saves the complete report as a session-level log entry', async () => {
    renderWorlds();
    await selectZila();
    await buildReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved to session log' }).hasAttribute('disabled')).toBe(true));
    expect(mocks.logToSession).toHaveBeenCalledTimes(1);
    const [title, type, typeData, options] = mocks.logToSession.mock.calls[0];
    expect(title).toContain('Zila weather report');
    expect(type).toBe('log');
    expect(typeData).toMatchObject({ kind: 'traveller-weather-report', hex: '2908' });
    expect(options).toMatchObject({
      session: { id: 'session-1', campaignId: 'campaign-1' }, targetEncounterId: null,
    });
    expect(options.body).toContain('session_date: 2026-09-26');
    expect(options.body).toContain('session: Arrival at Zila');
    expect(options.body).toContain('# 2026-09-26 Zila');
    expect(options.body).toContain('## The weather report');
    expect(options.body).toContain('## Ask the GM');
  });

  it('explains why saving is unavailable without an active session', async () => {
    mocks.session = null;
    renderWorlds();
    await selectZila();
    expect(screen.getByRole('textbox', { name: 'Date' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Session' }).hasAttribute('disabled')).toBe(true);
    await buildReport(false);
    expect(screen.getByRole('button', { name: 'Save to session log' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('Start a session to save this report in its log.')).toBeTruthy();
    expect(mocks.logToSession).not.toHaveBeenCalled();
  });

  it('keeps the save action available after a failed write', async () => {
    mocks.logToSession.mockRejectedValueOnce(new Error('Storage is full'));
    renderWorlds();
    await selectZila();
    await buildReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));
    expect(await screen.findByText('Storage is full')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save to session log' }).hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));
    await waitFor(() => expect(mocks.logToSession).toHaveBeenCalledTimes(2));
  });

  it('adds the selected world with sector, hex, and UWP to the route', async () => {
    renderWorlds();
    await selectZila();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Jump Route' }));
    await screen.findByRole('link', { name: 'Plan route' });
    expect(mocks.createRouteStop).toHaveBeenCalledWith({
      campaignId: 'campaign-1', name: 'Zila', values: { sector: 'Spinward Marches', hex: '2908', uwp: 'E556727-7' },
    });
    expect(mocks.loadWikiArticle).not.toHaveBeenCalled();
  });

  it('includes the linked party gear review in the visible and saved report', async () => {
    mocks.gearEnabled = true;
    mocks.party = { members: [{ linkedCharacterId: 'milo-1' }] };
    mocks.gearRules.review.mockReturnValue([{ owner: 'Milo', item: 'Laser pistol', category: 'Laser or energy weapon', action: 'leave aboard', reason: 'Law 7 restricts laser or energy weapon' }]);
    renderWorlds();
    await selectZila();
    await buildReport();
    expect(mocks.getCharacter).toHaveBeenCalledWith('milo-1');
    expect(await screen.findByText(/Milo: Laser pistol/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));
    await waitFor(() => expect(mocks.logToSession).toHaveBeenCalledTimes(1));
    expect(mocks.logToSession.mock.calls[0][3].body).toContain('## Party gear before going ashore');
    expect(mocks.logToSession.mock.calls[0][3].body).toContain('**Leave aboard:** Milo — Laser pistol');
  });
});
