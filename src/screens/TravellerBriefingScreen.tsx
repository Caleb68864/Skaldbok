import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/primitives/Button';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getEngine } from '../features/systems/engine';
import { useBriefingPreferences } from '../features/travellerBriefing/useBriefingPreferences';
import { buildBriefing, decodeWorld } from '../features/travellerBriefing/briefing';
import * as TravellerRules from '../features/travellerBriefing/rules';
import { loadSectorBasic, enrichSector, loadWorld, loadNearbyWorlds, nearbyFromCatalog, rankWorlds, remoteSearch, jumpDistance, orderWorldCandidates, worldKey, type NearbyWorld, type WorldHit } from '../features/travellerBriefing/worldData';
import { loadWikiArticle, type WikiArticle } from '../features/travellerBriefing/wikiData';
import { DEFAULT_SYSTEM_ID } from '../systems/registry';
import * as routeRepository from '../storage/repositories/routeRepository';
import * as characterRepository from '../storage/repositories/characterRepository';
import * as inventoryContainerRepository from '../storage/repositories/inventoryContainerRepository';
import type { CharacterRecord } from '../types/character';
import type { InventoryContainer } from '../types/inventoryContainer';
import { DEFAULT_TRAVELLER_MILIEU } from '../config/defaults/travellerBriefing';

const inputClass = 'w-full min-h-11 p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text)]';
const zoneLabel = (zone: string) => zone === 'R' ? 'Red' : zone === 'A' ? 'Amber' : '';

function Highlight({ value, query }: { value: string; query: string }) {
  const q = query.toLowerCase().trim();
  const index = value.toLowerCase().indexOf(q);
  if (!q) return <>{value}</>;
  if (index >= 0) return <>{value.slice(0, index)}<mark className="bg-amber-300 text-black">{value.slice(index, index + q.length)}</mark>{value.slice(index + q.length)}</>;
  // A fuzzy hit may omit a letter (Regna → Regina). Mark the characters that
  // matched in order so the suggestion still explains why it appeared.
  let matched = 0;
  return <>{[...value].map((letter, i) => {
    if (letter.toLowerCase() === q[matched]) { matched++; return <mark key={i} className="bg-amber-300 text-black">{letter}</mark>; }
    return <span key={i}>{letter}</span>;
  })}</>;
}

export default function TravellerBriefingScreen() {
  const { activeCampaign, activeSession, activeParty } = useCampaignContext();
  const campaignId = activeCampaign?.id;
  const navigate = useNavigate();
  const { system, error: systemError } = useSystemDefinition(activeCampaign?.system ?? DEFAULT_SYSTEM_ID);
  const engine = system ? getEngine(system) : undefined;
  const capability = engine?.landingBriefing;
  const routeMap = engine?.routeMap;
  const preferences = useBriefingPreferences();
  const [catalog, setCatalog] = useState<WorldHit[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [remote, setRemote] = useState<WorldHit[]>([]);
  const [open, setOpen] = useState(false);
  const [suggestionPosition, setSuggestionPosition] = useState<{ left: number; top?: number; bottom?: number; width: number; maxHeight: number } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<WorldHit | null>(null);
  const [nearbyRemote, setNearbyRemote] = useState<NearbyWorld[] | null>(null);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [wikiBusy, setWikiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [session, setSession] = useState('');
  const [milieu, setMilieu] = useState(DEFAULT_TRAVELLER_MILIEU);
  const [alternatives, setAlternatives] = useState<WorldHit[]>([]);
  const [addingRoute, setAddingRoute] = useState(false);
  const [routeAddError, setRouteAddError] = useState('');
  const [routeAddedFor, setRouteAddedFor] = useState('');
  const [partyGear, setPartyGear] = useState<{ characters: CharacterRecord[]; containers: InventoryContainer[] }>({ characters: [], containers: [] });
  const [gearLoading, setGearLoading] = useState(false);
  const routeAddInFlight = useRef(false);
  const selectionToken = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDate(activeSession?.date ?? '');
    setSession(activeSession?.title ?? '');
  }, [activeSession?.id, activeSession?.date, activeSession?.title]);

  useEffect(() => {
    let cancelled = false;
    if (!campaignId || !engine?.gearRestrictions) { setPartyGear({ characters: [], containers: [] }); return; }
    setGearLoading(true);
    const memberIds = activeParty?.members.filter(member => !member.deletedAt && member.linkedCharacterId).map(member => member.linkedCharacterId!) ?? [];
    Promise.all([
      Promise.all(memberIds.map(id => characterRepository.getById(id))),
      inventoryContainerRepository.list(campaignId),
    ]).then(([characters, containers]) => {
      if (!cancelled) setPartyGear({ characters: characters.filter((value): value is CharacterRecord => Boolean(value)), containers });
    }).catch(() => {
      if (!cancelled) setPartyGear({ characters: [], containers: [] });
    }).finally(() => { if (!cancelled) setGearLoading(false); });
    return () => { cancelled = true; };
  }, [campaignId, activeParty, engine?.gearRestrictions]);

  const sectors = preferences.sectors;
  useEffect(() => {
    let cancelled = false;
    let remaining = sectors.length;
    const failed: string[] = [];
    setCatalog([]);
    setCatalogError('');
    setLoadingCatalog(remaining > 0);
    for (const sector of sectors) {
      loadSectorBasic(sector, milieu).then(worlds => {
        if (cancelled) return;
        // Make the sector searchable immediately. Metadata only improves labels
        // and cross-sector jump distances; it must not hold back autocomplete.
        setCatalog(previous => [...previous.filter(w => w.sector !== sector), ...worlds]);
        void enrichSector(worlds, sector, milieu).then(enriched => {
          if (!cancelled) setCatalog(previous => [...previous.filter(w => w.sector !== sector), ...enriched]);
        });
      }).catch(() => {
        if (!cancelled) failed.push(sector);
      }).finally(() => {
        if (cancelled) return;
        remaining--;
        setLoadingCatalog(remaining > 0);
        setCatalogError(failed.length ? `Unavailable sectors: ${failed.join(', ')}. Cached worlds remain searchable.` : '');
      });
    }
    return () => { cancelled = true; };
  }, [sectors, milieu]);
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200); return () => clearTimeout(timer); }, [query]);
  const local = useMemo(() => rankWorlds(catalog, debouncedQuery), [catalog, debouncedQuery]);
  useEffect(() => {
    if (!debouncedQuery || local.length) { setRemote([]); return; }
    let cancelled = false;
    remoteSearch(debouncedQuery, milieu).then(found => { if (!cancelled) setRemote(found); }).catch(() => { if (!cancelled) setRemote([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery, local.length, milieu]);
  const suggestions = query.trim()
    ? (debouncedQuery === query.trim() ? (local.length ? local : remote) : [])
    : preferences.recent;
  useEffect(() => {
    if (!open || suggestions.length === 0 || !searchInputRef.current) { setSuggestionPosition(null); return; }
    const updatePosition = () => {
      const rect = searchInputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const roomBelow = window.innerHeight - rect.bottom - 8;
      const roomAbove = rect.top - 8;
      if (roomBelow >= 180 || roomBelow >= roomAbove) {
        setSuggestionPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width, maxHeight: Math.max(120, Math.min(320, roomBelow)) });
      } else {
        setSuggestionPosition({ left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width, maxHeight: Math.max(120, Math.min(320, roomAbove)) });
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => { window.removeEventListener('resize', updatePosition); window.removeEventListener('scroll', updatePosition, true); };
  }, [open, suggestions.length, query]);
  const jumpRange = preferences.jumpRange;
  const localNearby = useMemo(() => selected ? nearbyFromCatalog(selected, catalog, jumpRange) : [], [selected, catalog, jumpRange]);
  const nearby = nearbyRemote ?? localNearby;
  const filteredNearby = nearby.filter(({ world }) => {
    const filters = preferences.filters;
    if (filters.starports.length && !filters.starports.includes(world.uwp[0]?.toUpperCase())) return false;
    if (filters.gasGiantOnly && !(Number(world.pbg[2]) > 0)) return false;
    if (filters.zone === 'noRed' && world.zone === 'R') return false;
    if (filters.zone === 'greenOnly' && (world.zone === 'R' || world.zone === 'A')) return false;
    return true;
  });
  useEffect(() => {
    if (!selected) { setNearbyRemote(null); setNearbyError(''); setNearbyBusy(false); return; }
    let cancelled = false;
    setNearbyRemote(null);
    setNearbyError('');
    setNearbyBusy(true);
    loadNearbyWorlds(selected, jumpRange, milieu).then(worlds => {
      if (!cancelled) setNearbyRemote(worlds);
    }).catch(error => {
      if (!cancelled) setNearbyError(error instanceof Error ? error.message : String(error));
    }).finally(() => { if (!cancelled) setNearbyBusy(false); });
    return () => { cancelled = true; };
  }, [selected, jumpRange, milieu]);
  const overrides = selected ? preferences.overrides[worldKey(selected)] : undefined;
  const gearFindings = useMemo(() => {
    if (!selected || !engine?.gearRestrictions || gearLoading) return null;
    try {
      const world = decodeWorld({ ...selected, ...overrides });
      return engine.gearRestrictions.review(partyGear.characters, partyGear.containers, world.law, world.gov);
    } catch { return null; }
  }, [selected, overrides, engine?.gearRestrictions, gearLoading, partyGear]);
  async function choose(hit: WorldHit, other: WorldHit[] = []) {
    const token = ++selectionToken.current;
    setOpen(false); setBusy(true); setSelected(null); setWikiBusy(false); setCatalogError('');
    setAlternatives(other); setQuery(hit.name);
    try {
      const world = await loadWorld(hit, milieu);
      if (token !== selectionToken.current) return;
      setSelected(world);
      const recent = [world, ...preferences.recent.filter(w => worldKey(w) !== worldKey(world))].slice(0, 8);
      void preferences.updateSettings({ recentBriefingWorlds: recent }).catch(() => {});
    } catch (error) { if (token === selectionToken.current) setCatalogError(error instanceof Error ? error.message : String(error)); }
    finally { if (token === selectionToken.current) setBusy(false); }
  }
  async function requestReport() {
    if (!selected || !activeCampaign || wikiBusy || gearLoading) return;
    const token = selectionToken.current;
    setCatalogError('');
    setWikiBusy(true);
    let article: WikiArticle | null = null;
    let wikiError = '';
    try {
      article = await loadWikiArticle(selected);
    } catch (error) {
      wikiError = error instanceof Error ? error.message : String(error);
    } finally {
      if (token === selectionToken.current) {
        setWikiBusy(false);
        try {
          const report = buildBriefing(selected, article, {
            milieu, date, session, homeDistance: jumpDistance(selected), alternatives, overrides,
            gearReview: gearFindings ?? undefined,
            gearReviewSources: partyGear.characters.length + partyGear.containers.length,
          });
          navigate('/weather-report', { state: {
            campaignId: activeCampaign.id, report, wiki: article, wikiError,
            gearFindings: gearFindings ?? [], gearReviewSources: partyGear.characters.length + partyGear.containers.length,
          } });
        } catch (error) {
          setCatalogError(error instanceof Error ? error.message : 'Could not build this weather report.');
        }
      }
    }
  }
  async function addWorldToRoute() {
    if (!selected || !activeCampaign || !routeMap || routeAddInFlight.current) return;
    const key = `${activeCampaign.id}/${worldKey(selected)}`;
    routeAddInFlight.current = true;
    setAddingRoute(true);
    setRouteAddError('');
    try {
      await routeRepository.create({ campaignId: activeCampaign.id, ...routeMap.worldToStop(selected) });
      setRouteAddedFor(key);
    } catch (error) {
      setRouteAddError(error instanceof Error ? error.message : 'Could not add the world to the route.');
    } finally {
      routeAddInFlight.current = false;
      setAddingRoute(false);
    }
  }
  async function chooseExact() {
    if (suggestions.length) { void choose(suggestions[Math.min(activeIndex, suggestions.length - 1)], suggestions.filter((_, i) => i !== activeIndex && suggestions[i].name.toLowerCase() === suggestions[activeIndex]?.name.toLowerCase())); return; }
    if (!query.trim()) return;
    setBusy(true);
    try {
      const matches = await remoteSearch(query.trim(), milieu, true);
      const exact = matches.filter(w => w.name.toLowerCase() === query.trim().toLowerCase());
      const candidates = exact.length ? exact : matches;
      if (!candidates.length) throw new Error(`No world found for “${query}”`);
      const ordered = orderWorldCandidates(candidates);
      void choose(ordered[0], ordered.slice(1));
    } catch (error) { setCatalogError(error instanceof Error ? error.message : String(error)); setBusy(false); }
  }
  function setOverride(field: 'uwp' | 'zone' | 'remarks' | 'note', value: string) {
    if (!selected) return;
    const key = worldKey(selected);
    void preferences.updateSettings({ briefingWorldOverrides: { ...preferences.overrides, [key]: { ...preferences.overrides[key], [field]: value } } });
  }
  if (!activeCampaign) return <NoCampaignPrompt />;
  if (!system && !systemError) return <div role="status">Loading rules…</div>;
  if (systemError) return <div role="alert">{systemError}</div>;
  if (!capability) return <Navigate to="/session" replace />;
  return <div className="w-full min-h-full max-w-none p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
    <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{capability.label}</h1><Button variant="secondary" onClick={() => navigate('/weather-reports')}>Previous weather reports</Button></div>
    <SectionPanel title={capability.label} subtitle="Search worlds, compare destinations, then build a report" collapsible defaultOpen>
      <div className="relative">
        <label htmlFor="world-search" className="block mb-1">World</label>
        <input ref={searchInputRef} id="world-search" role="combobox" aria-expanded={open && suggestions.length > 0} aria-controls="world-suggestions" aria-autocomplete="list"
          autoComplete="off" className={inputClass} value={query} placeholder="Name, hex, or UWP"
          onFocus={() => { setOpen(true); setActiveIndex(0); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') { e.preventDefault(); void chooseExact(); }
          }} />
      </div>
      {loadingCatalog && <p role="status">Loading sector catalog…</p>}
      {catalogError && <p role="alert" className="text-red-500">{catalogError}</p>}
      <label className="block mt-3 max-w-xs">Milieu <input className={inputClass} value={milieu} onChange={e => { selectionToken.current++; setSelected(null); setMilieu(e.target.value); }} /></label>
    </SectionPanel>
    {open && suggestions.length > 0 && suggestionPosition && createPortal(
      <ul id="world-suggestions" role="listbox" className="fixed z-[1000] overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
        style={{ left: suggestionPosition.left, top: suggestionPosition.top, bottom: suggestionPosition.bottom, width: suggestionPosition.width, maxHeight: suggestionPosition.maxHeight }}>
        {suggestions.slice(0, 20).map((w, i) => <li key={worldKey(w)} role="option" aria-selected={activeIndex === i}>
          <button type="button" className={`w-full text-left p-2 min-h-11 border-b border-[var(--color-border)] ${activeIndex === i ? 'bg-[var(--color-surface-alt)]' : ''}`}
            onMouseDown={e => e.preventDefault()} onClick={() => void choose(w, suggestions.filter(x => x.name === w.name && worldKey(x) !== worldKey(w)))}>
            <strong><Highlight value={w.name} query={query} /></strong> · {w.sector} <Highlight value={w.hex} query={query.split(/\s+/).slice(-1)[0] ?? query} /> {w.subsector && `· ${w.subsector}`}
            <span className="block text-sm text-[var(--color-text-muted)]"><Highlight value={w.uwp} query={query} /> {zoneLabel(w.zone) && `· ${zoneLabel(w.zone)} Zone`} {jumpDistance(w) != null && `· ${jumpDistance(w)} pc from Regina`}</span>
          </button>
        </li>)}
      </ul>, document.body,
    )}
    {busy && <p role="status">Loading world data…</p>}
    {selected && <>
      <SectionPanel title={`${selected.name} · ${selected.sector} ${selected.hex}`} subtitle={selected.uwp} collapsible defaultOpen>
        {selected.zone && <p className={`font-bold ${selected.zone === 'R' ? 'text-red-500' : 'text-amber-500'}`}>{zoneLabel(selected.zone)} Zone</p>}
        {(() => {
          try {
            const decoded = decodeWorld({ ...selected, ...overrides });
            const atmosphere = TravellerRules.ATMOS[String(decoded.atm) as keyof typeof TravellerRules.ATMOS];
            const size = TravellerRules.SIZE[String(decoded.siz) as keyof typeof TravellerRules.SIZE];
            const hydro = TravellerRules.HYDRO[String(decoded.hyd) as keyof typeof TravellerRules.HYDRO];
            const population = TravellerRules.POP[String(decoded.pop) as keyof typeof TravellerRules.POP];
            const government = TravellerRules.GOV[String(decoded.gov) as keyof typeof TravellerRules.GOV];
            const starport = TravellerRules.STARPORT[decoded.port as keyof typeof TravellerRules.STARPORT];
            return <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 my-3">
              <div><dt className="font-semibold">Starport</dt><dd>{decoded.port} · {starport?.quality ?? 'Unknown'}</dd></div>
              <div><dt className="font-semibold">Size</dt><dd>{decoded.siz} · {size?.[0] ?? 'Unknown'} · {size?.[1] ?? 'gravity unknown'} G</dd></div>
              <div><dt className="font-semibold">Atmosphere</dt><dd>{decoded.atm} · {atmosphere?.[0] ?? 'Unknown'}{atmosphere?.[2] ? ` · ${atmosphere[2]}` : ''}</dd></div>
              <div><dt className="font-semibold">Hydrographics</dt><dd>{decoded.hyd} · {hydro?.[0] ?? 'Unknown'} · {hydro?.[1] ?? ''}</dd></div>
              <div><dt className="font-semibold">Population</dt><dd>{decoded.pop} · {population ?? 'Unknown'} ({decoded.popExact.toLocaleString()})</dd></div>
              <div><dt className="font-semibold">Government</dt><dd>{decoded.gov} · {government?.[0] ?? 'Unknown'}</dd></div>
              <div><dt className="font-semibold">Law level</dt><dd>{decoded.law}</dd></div>
              <div><dt className="font-semibold">Tech level</dt><dd>{decoded.tl}</dd></div>
              <div><dt className="font-semibold">System</dt><dd>{selected.pbg || '—'} · {decoded.belts} planetoid belts · {decoded.gg} gas giants</dd></div>
              {selected.stellar && <div><dt className="font-semibold">Primary stars</dt><dd>{selected.stellar}</dd></div>}
            </dl>;
          } catch { return <p role="status" className="my-3">World profile details are unavailable for this UWP.</p>; }
        })()}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3">
          <div><dt className="font-semibold">Subsector</dt><dd>{selected.subsector || '—'}</dd></div>
          <div><dt className="font-semibold">Starport</dt><dd>{selected.uwp[0] || '—'}</dd></div>
          <div><dt className="font-semibold">Remarks</dt><dd>{selected.remarks || '—'}</dd></div>
          <div><dt className="font-semibold">Allegiance</dt><dd>{selected.allegianceName || selected.allegiance || '—'}</dd></div>
          <div><dt className="font-semibold">Bases</dt><dd>{selected.bases || '—'}</dd></div>
          <div><dt className="font-semibold">From Regina</dt><dd>{jumpDistance(selected) == null ? 'Unknown' : `${jumpDistance(selected)} parsecs`}</dd></div>
        </dl>
        <div className="flex gap-3 flex-wrap my-3">
          <label>Date <input className={inputClass} value={date} placeholder="YYYY-MM-DD or 097-1105" disabled={!activeSession} onChange={e => setDate(e.target.value)} /></label>
          <label>Session <input className={inputClass} value={session} disabled={!activeSession} onChange={e => setSession(e.target.value)} /></label>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button disabled={wikiBusy || gearLoading} onClick={() => void requestReport()}>{wikiBusy ? 'Building weather report…' : 'Build weather report'}</Button>
          {routeMap && <Button variant="secondary" disabled={addingRoute || routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}`} onClick={() => void addWorldToRoute()}>
            {addingRoute ? 'Adding…' : routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}` ? 'Added to Jump Route' : 'Add to Jump Route'}
          </Button>}
          {routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}` && <Link to="/route" className="underline">Plan route</Link>}
        </div>
        {routeAddError && <p role="alert" className="mt-2 text-red-500">{routeAddError}</p>}
        {wikiBusy && <p role="status" className="mt-2">Building the weather report…</p>}
      </SectionPanel>
      <SectionPanel title={`Nearby worlds · Jump-${jumpRange}`} subtitle="Choose a destination to inspect it" collapsible defaultOpen>
        <label className="block max-w-xs mb-3">Jump range
          <select className={inputClass} value={jumpRange} onChange={e => void preferences.updateSettings({ travellerExploreJumpRange: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(range => <option key={range} value={range}>Jump-{range}</option>)}
          </select>
        </label>
        <fieldset className="mb-3">
          <legend className="font-semibold mb-1">Filter nearby worlds</legend>
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm">Starports</span>
            {preferences.starportCodes.map(code => <label key={code} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={preferences.filters.starports.includes(code)} onChange={e => void preferences.updateSettings({ travellerWorldFilters: {
                ...preferences.filters,
                starports: e.target.checked ? [...preferences.filters.starports, code] : preferences.filters.starports.filter(value => value !== code),
              } })} />{code}
            </label>)}
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={preferences.filters.gasGiantOnly} onChange={e => void preferences.updateSettings({ travellerWorldFilters: { ...preferences.filters, gasGiantOnly: e.target.checked } })} />Gas giant</label>
          </div>
          <label className="block max-w-xs mt-2">Travel zones
            <select className={inputClass} value={preferences.filters.zone} onChange={e => void preferences.updateSettings({ travellerWorldFilters: { ...preferences.filters, zone: e.target.value as 'all' | 'noRed' | 'greenOnly' } })}>
              <option value="all">All zones</option><option value="noRed">Hide Red Zones</option><option value="greenOnly">Green only</option>
            </select>
          </label>
        </fieldset>
        {nearbyBusy && <p role="status">Checking nearby sectors…</p>}
        {nearbyError && <p role="alert">Nearby worlds could not be refreshed: {nearbyError}. Showing cached sectors where available.</p>}
        {!nearbyBusy && filteredNearby.length === 0 && <p>{nearby.length ? 'No nearby worlds match these filters.' : `No worlds found within Jump-${jumpRange}.`}</p>}
        {filteredNearby.length > 0 && <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredNearby.map(({ world, distance }) => <li key={worldKey(world)}>
            <button type="button" onClick={() => void choose(world)} className="w-full min-h-11 p-3 rounded border border-[var(--color-border)] text-left hover:bg-[var(--color-surface-alt)]">
              <strong>{world.name}</strong> · {world.sector} {world.hex}
              <span className="block text-sm text-[var(--color-text-muted)]">{world.uwp} · {distance == null ? `Within Jump-${jumpRange}` : `${distance} ${distance === 1 ? 'parsec' : 'parsecs'}`}{zoneLabel(world.zone) && ` · ${zoneLabel(world.zone)} Zone`}</span>
            </button>
          </li>)}</ul>}
      </SectionPanel>
      <SectionPanel title="GM corrections" subtitle="Your table’s version takes priority; saved for this sector and hex." collapsible defaultOpen={false}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label>UWP <input className={inputClass} value={overrides?.uwp ?? selected.uwp} onChange={e => setOverride('uwp', e.target.value)} /></label>
          <label>Travel zone <select className={inputClass} value={overrides?.zone ?? selected.zone} onChange={e => setOverride('zone', e.target.value)}><option value="">Green</option><option value="A">Amber</option><option value="R">Red</option></select></label>
          <label>Remarks <input className={inputClass} value={overrides?.remarks ?? selected.remarks} onChange={e => setOverride('remarks', e.target.value)} /></label>
        </div>
        <label className="block mt-3">GM note <textarea className={inputClass} value={overrides?.note ?? ''} placeholder="What is different from the survey?" onChange={e => setOverride('note', e.target.value)} /></label>
      </SectionPanel>
      {alternatives.length > 0 && <SectionPanel title="Other worlds with this name" collapsible defaultOpen><div className="flex flex-wrap gap-2">{alternatives.map(w => <Button key={worldKey(w)} variant="secondary" onClick={() => void choose(w, [selected, ...alternatives.filter(a => worldKey(a) !== worldKey(w))])}>{w.name} · {w.sector} {w.hex}</Button>)}</div></SectionPanel>}
    </>}
    {selected && <div className="text-sm text-[var(--color-text-muted)]">Build the report to open its own screen. Unsaved reports do not appear in campaign history.</div>}
  </div>;
}
