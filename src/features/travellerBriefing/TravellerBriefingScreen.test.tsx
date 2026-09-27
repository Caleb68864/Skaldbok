// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TravellerBriefingScreen from '../../screens/TravellerBriefingScreen';
import TravellerWeatherReportsScreen from '../../screens/TravellerWeatherReportsScreen';
import { reviewTravellerGear } from './gearRestrictions';
import { buildBriefing } from './briefing';
import { loadSectorBasic, remoteSearch } from './worldData';

const mocks = vi.hoisted(() => ({
  session: { id: 'session-1', campaignId: 'campaign-1', title: 'Arrival at Zila', date: '2026-09-26' } as { id: string; campaignId: string; title: string; date: string } | null,
  logToSession: vi.fn(),
  updateSettings: vi.fn(),
  loadWikiArticle: vi.fn(),
  createRouteStop: vi.fn(),
  getCharacter: vi.fn(),
  listContainers: vi.fn(),
  gearRules: { review: vi.fn() },
  getNotesByCampaign: vi.fn(),
  getNoteById: vi.fn(),
  savedWeatherNote: null as Record<string, unknown> | null,
  party: null as { members: Array<{ linkedCharacterId: string }> } | null,
  gearEnabled: false,
  sectors: [] as string[],
  overrides: {} as Record<string, { uwp?: string; zone?: string; remarks?: string }>,
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
  useBriefingPreferences: () => ({ sectors: mocks.sectors, jumpRange: 2, filters: mocks.filters, starportCodes: ['A', 'B', 'C', 'D', 'E', 'X'], recent: [{ ...mocks.world, name: 'Regina', hex: '1910' }], overrides: mocks.overrides, updateSettings: mocks.updateSettings }),
}));
vi.mock('./worldData', async importOriginal => ({
  ...await importOriginal<typeof import('./worldData')>(),
  loadSectorBasic: vi.fn(async () => []),
  loadWorld: vi.fn(async () => mocks.world),
  loadNearbyWorlds: vi.fn(async () => [{ world: { ...mocks.world, name: 'Pysadi', hex: '3008', uwp: 'C5766D8-5' }, distance: 1 }]),
  remoteSearch: vi.fn(async () => [mocks.world]),
}));
vi.mock('./wikiData', () => ({ loadWikiArticle: mocks.loadWikiArticle }));
vi.mock('../../storage/repositories/routeRepository', () => ({ create: mocks.createRouteStop }));
vi.mock('../../storage/repositories/characterRepository', () => ({ getById: mocks.getCharacter }));
vi.mock('../../storage/repositories/inventoryContainerRepository', () => ({ list: mocks.listContainers }));
vi.mock('../../storage/repositories/noteRepository', () => ({ getNotesByCampaign: mocks.getNotesByCampaign, getNoteById: mocks.getNoteById }));

function renderWorlds() { return render(<MemoryRouter initialEntries={['/worlds']}><Routes>
  <Route path="/worlds" element={<TravellerBriefingScreen />} />
  <Route path="/weather-report" element={<TravellerWeatherReportsScreen />} />
  <Route path="/weather-reports" element={<TravellerWeatherReportsScreen />} />
  <Route path="/weather-reports/:noteId" element={<TravellerWeatherReportsScreen />} />
</Routes></MemoryRouter>); }

async function selectZila() {
  fireEvent.change(screen.getByRole('combobox', { name: 'World' }), { target: { value: 'Zila' } });
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
    mocks.getNotesByCampaign.mockReset().mockResolvedValue([]);
    mocks.getNoteById.mockReset().mockResolvedValue(null);
    const savedReport = buildBriefing(mocks.world, null, { milieu: 'M1105' });
    mocks.savedWeatherNote = {
      id: 'note-1', campaignId: 'campaign-1', sessionId: 'session-1', title: 'Zila weather report · Spinward Marches 2908',
      body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: savedReport.markdown }] }] },
      type: 'log', typeData: { kind: 'traveller-weather-report', sector: 'Spinward Marches', hex: '2908', report: savedReport },
      status: 'active', pinned: false, schemaVersion: 1, createdAt: '2026-09-26T12:00:00Z', updatedAt: '2026-09-26T12:00:00Z',
    };
    mocks.party = null;
    mocks.gearEnabled = false;
    mocks.sectors = [];
    mocks.overrides = {};
    vi.mocked(loadSectorBasic).mockReset().mockResolvedValue([]);
    vi.mocked(remoteSearch).mockReset().mockResolvedValue([mocks.world]);
  });

  it('browses a world and nearby destinations before requesting Wiki data', async () => {
    renderWorlds();
    await selectZila();
    expect((screen.getByRole('textbox', { name: 'Date' }) as HTMLInputElement).value).toBe('2026-09-26');
    expect((screen.getByRole('textbox', { name: 'Session' }) as HTMLInputElement).value).toBe('Arrival at Zila');
    expect(mocks.loadWikiArticle).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save to session log' })).toBeNull();
    expect(screen.getByText(/Participating Democracy/)).toBeTruthy();
    expect(screen.getByText(/gas giants/)).toBeTruthy();
    expect(screen.queryByRole('option', { name: /Regina/ })).toBeNull();
    await screen.findByRole('button', { name: /Pysadi/ });
    await buildReport();
    expect(mocks.loadWikiArticle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Zila weather report' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous reports' }));
    expect(await screen.findByText('No weather reports have been saved to a session in this campaign.')).toBeTruthy();
  });

  it('keeps recent worlds in autocomplete until a new query is entered', async () => {
    renderWorlds();
    fireEvent.focus(screen.getByRole('combobox', { name: 'World' }));
    expect(await screen.findByRole('option', { name: /Regina/ })).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'World' }), { target: { value: 'Zila' } });
    expect(await screen.findByRole('option', { name: /Zila/ })).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await selectZila();
    expect(screen.getByRole('button', { name: /Nearby worlds · Jump-2/ })).toBeTruthy();
  });

  it('checks unloaded sectors when the local catalog has only a fuzzy match', async () => {
    mocks.sectors = ['Spinward Marches'];
    vi.mocked(loadSectorBasic).mockResolvedValue([{ ...mocks.world, name: 'Zilo' }]);
    vi.mocked(remoteSearch).mockResolvedValue([{ ...mocks.world, sector: 'Another Sector', hex: '1204' }]);
    renderWorlds();
    fireEvent.change(screen.getByRole('combobox', { name: 'World' }), { target: { value: 'Zila' } });
    expect(await screen.findByRole('option', { name: /Zila · Another Sector/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Zilo/ })).toBeTruthy();
  });

  it('shows same-name worlds in unloaded sectors alongside an exact local match', async () => {
    mocks.sectors = ['Spinward Marches'];
    vi.mocked(loadSectorBasic).mockResolvedValue([mocks.world]);
    vi.mocked(remoteSearch).mockResolvedValue([{ ...mocks.world, sector: 'Another Sector', hex: '1204' }]);
    renderWorlds();
    fireEvent.change(screen.getByRole('combobox', { name: 'World' }), { target: { value: 'Zila' } });
    expect(await screen.findByRole('option', { name: /Zila · Another Sector/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Zila · Spinward Marches/ })).toBeTruthy();
  });

  it('saves the complete report as a session-level log entry', async () => {
    mocks.getNoteById.mockResolvedValue(mocks.savedWeatherNote);
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
    expect(typeData.report).toMatchObject({ world: { name: 'Zila' }, law: 7 });
    mocks.getNoteById.mockResolvedValue(mocks.savedWeatherNote);
    mocks.getNotesByCampaign.mockResolvedValue([mocks.savedWeatherNote]);
    fireEvent.click(screen.getByRole('button', { name: 'Previous reports' }));
    expect(await screen.findByRole('link', { name: /Zila weather report/ })).toBeTruthy();
  });

  it('keeps Library data when reopening a saved report', async () => {
    const wiki = { title: 'Zila (world)', url: 'https://wiki.travellerrpg.com/Zila', sections: [['History', 'A saved history detail.']] as [string, string][] };
    const note = { ...mocks.savedWeatherNote!, typeData: { ...(mocks.savedWeatherNote!.typeData as object), wiki } };
    mocks.getNoteById.mockResolvedValue(note);
    render(<MemoryRouter initialEntries={['/weather-reports/note-1']}><Routes>
      <Route path="/weather-reports/:noteId" element={<TravellerWeatherReportsScreen />} />
    </Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Zila weather report' });
    fireEvent.click(screen.getByRole('button', { name: 'Library data' }));
    expect(await screen.findByText('A saved history detail.')).toBeTruthy();
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

  it('ignores rapid duplicate saves while the first write is pending', async () => {
    let finishSave!: (id: string) => void;
    mocks.logToSession.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; }));
    renderWorlds();
    await selectZila();
    await buildReport();
    const save = screen.getByRole('button', { name: 'Save to session log' });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(mocks.logToSession).toHaveBeenCalledTimes(1);
    finishSave('note-1');
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

  it('shows and routes with the GM-corrected world profile', async () => {
    mocks.overrides = { 'spinward marches/2908': { uwp: 'A556727-7', zone: '', remarks: 'Hi' } };
    renderWorlds();
    await selectZila();
    expect(screen.getByText('A556727-7')).toBeTruthy();
    expect(screen.getByText('Hi')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to Jump Route' }));
    await waitFor(() => expect(mocks.createRouteStop).toHaveBeenCalledWith(expect.objectContaining({ values: expect.objectContaining({ uwp: 'A556727-7' }) })));
  });

  it('includes the linked party gear review in the visible and saved report', async () => {
    mocks.gearEnabled = true;
    mocks.party = { members: [{ linkedCharacterId: 'milo-1' }] };
    mocks.getCharacter.mockResolvedValue({ name: 'Milo', weapons: [{ name: 'Laser pistol' }], inventory: [] });
    mocks.gearRules.review.mockImplementation(reviewTravellerGear);
    renderWorlds();
    await selectZila();
    await buildReport();
    expect(mocks.getCharacter).toHaveBeenCalledWith('milo-1');
    expect(await screen.findByText(/Milo: Laser pistol/)).toBeTruthy();
    expect(screen.getAllByText(/Laser or energy weapon/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));
    await waitFor(() => expect(mocks.logToSession).toHaveBeenCalledTimes(1));
    expect(mocks.logToSession.mock.calls[0][3].body).toContain('## Party gear before going ashore');
    expect(mocks.logToSession.mock.calls[0][3].body).toContain('**Leave aboard:** Milo — Laser pistol');
    expect(mocks.logToSession.mock.calls[0][2].gearFindings).toEqual(expect.arrayContaining([expect.objectContaining({ owner: 'Milo', item: 'Laser pistol', action: 'leave aboard' })]));
  });

  it('warns when party inventory cannot be loaded for the gear review', async () => {
    mocks.gearEnabled = true;
    mocks.party = { members: [{ linkedCharacterId: 'milo-1' }] };
    mocks.getCharacter.mockRejectedValue(new Error('IndexedDB read failed'));
    renderWorlds();
    await selectZila();
    await buildReport();
    expect((await screen.findAllByText(/Could not load all party inventory data/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Party gear check incomplete' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save to session log' }));
    await waitFor(() => expect(mocks.logToSession).toHaveBeenCalledTimes(1));
    expect(mocks.logToSession.mock.calls[0][3].body).toContain('**Gear check incomplete:**');
  });

  it('warns when a linked party character is missing', async () => {
    mocks.gearEnabled = true;
    mocks.party = { members: [{ linkedCharacterId: 'missing-1' }] };
    mocks.getCharacter.mockResolvedValue(undefined);
    renderWorlds();
    await selectZila();
    await buildReport();
    expect((await screen.findAllByText(/Some linked party characters are unavailable/)).length).toBeGreaterThan(0);
  });
});
