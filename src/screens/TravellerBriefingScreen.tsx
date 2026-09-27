import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '../components/primitives/Button';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useSessionLog } from '../features/session/useSessionLog';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getEngine } from '../features/systems/engine';
import { useBriefingPreferences } from '../features/travellerBriefing/useBriefingPreferences';
import { buildBriefing } from '../features/travellerBriefing/briefing';
import { loadSectorBasic, enrichSector, loadWorld, loadNearbyWorlds, nearbyFromCatalog, rankWorlds, remoteSearch, jumpDistance, orderWorldCandidates, worldKey, type NearbyWorld, type WorldHit } from '../features/travellerBriefing/worldData';
import { loadWikiArticle, type WikiArticle } from '../features/travellerBriefing/wikiData';
import { DEFAULT_SYSTEM_ID } from '../systems/registry';
import * as routeRepository from '../storage/repositories/routeRepository';
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
  const { activeCampaign, activeSession } = useCampaignContext();
  const { logToSession } = useSessionLog();
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<WorldHit | null>(null);
  const [nearbyRemote, setNearbyRemote] = useState<NearbyWorld[] | null>(null);
  const [nearbyBusy, setNearbyBusy] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [wiki, setWiki] = useState<WikiArticle | null>(null);
  const [wikiError, setWikiError] = useState('');
  const [wikiBusy, setWikiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [session, setSession] = useState('');
  const [milieu, setMilieu] = useState(DEFAULT_TRAVELLER_MILIEU);
  const [alternatives, setAlternatives] = useState<WorldHit[]>([]);
  const [copied, setCopied] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedReport, setSavedReport] = useState<{ sessionId: string; markdown: string } | null>(null);
  const [addingRoute, setAddingRoute] = useState(false);
  const [routeAddError, setRouteAddError] = useState('');
  const [routeAddedFor, setRouteAddedFor] = useState('');
  const saveInFlight = useRef(false);
  const routeAddInFlight = useRef(false);
  const selectionToken = useRef(0);

  useEffect(() => {
    setDate(activeSession?.date ?? '');
    setSession(activeSession?.title ?? '');
  }, [activeSession?.id, activeSession?.date, activeSession?.title]);

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
  const suggestions = debouncedQuery ? (local.length ? local : remote) : preferences.recent;
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
  const selectedKey = selected ? `${milieu}/${worldKey(selected)}` : null;
  const reportVisible = selectedKey !== null && reportFor === selectedKey;
  const overrides = selected ? preferences.overrides[worldKey(selected)] : undefined;
  const briefing = useMemo(() => {
    if (!selected || !reportVisible) return null;
    try { return buildBriefing(selected, wiki, { milieu, date, session, homeDistance: jumpDistance(selected), alternatives, overrides }); }
    catch { return null; }
  },
    [selected, reportVisible, wiki, milieu, date, session, alternatives, overrides]);
  const reportSaved = Boolean(activeSession && briefing && savedReport?.sessionId === activeSession.id && savedReport.markdown === briefing.markdown);

  async function choose(hit: WorldHit, other: WorldHit[] = []) {
    const token = ++selectionToken.current;
    setOpen(false); setBusy(true); setSelected(null); setReportFor(null); setWiki(null); setWikiBusy(false); setWikiError(''); setCatalogError('');
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
    if (!selected || !selectedKey || wikiBusy) return;
    const token = selectionToken.current;
    setReportFor(selectedKey);
    setWiki(null);
    setWikiError('');
    setWikiBusy(true);
    try {
      const article = await loadWikiArticle(selected);
      if (token === selectionToken.current) setWiki(article);
    } catch (error) {
      if (token === selectionToken.current) setWikiError(error instanceof Error ? error.message : String(error));
    } finally {
      if (token === selectionToken.current) setWikiBusy(false);
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
  function download() {
    if (!briefing) return;
    const url = URL.createObjectURL(new Blob([briefing.markdown], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = briefing.filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveToSessionLog() {
    if (!briefing || !activeSession || saveInFlight.current) return;
    const report = briefing;
    const session = { id: activeSession.id, campaignId: activeSession.campaignId };
    saveInFlight.current = true;
    setSavingReport(true);
    setSaveError('');
    try {
      const noteId = await logToSession(
        `${report.world.name} weather report · ${report.world.sector} ${report.world.hex}`,
        'log',
        { kind: 'traveller-weather-report', sector: report.world.sector, hex: report.world.hex },
        { body: report.markdown, session, targetEncounterId: null },
      );
      if (!noteId) throw new Error('No active session is available.');
      setSavedReport({ sessionId: session.id, markdown: report.markdown });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the report.');
    } finally {
      saveInFlight.current = false;
      setSavingReport(false);
    }
  }
  if (!activeCampaign) return <NoCampaignPrompt />;
  if (!system && !systemError) return <div role="status">Loading rules…</div>;
  if (systemError) return <div role="alert">{systemError}</div>;
  if (!capability) return <Navigate to="/session" replace />;
  return <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)] max-w-5xl mx-auto">
    <SectionPanel title={capability.label} subtitle="Search worlds, compare destinations, then build a report">
      <div className="relative">
        <label htmlFor="world-search" className="block mb-1">World</label>
        <input id="world-search" role="combobox" aria-expanded={open} aria-controls="world-suggestions" aria-autocomplete="list"
          autoComplete="off" className={inputClass} value={query} placeholder="Name, hex, or UWP"
          onFocus={() => { setOpen(true); setActiveIndex(0); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIndex(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter') { e.preventDefault(); void chooseExact(); }
          }} />
        {open && suggestions.length > 0 && <ul id="world-suggestions" role="listbox" className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl">
          {suggestions.slice(0, 20).map((w, i) => <li key={worldKey(w)} role="option" aria-selected={activeIndex === i}>
            <button type="button" className={`w-full text-left p-2 min-h-11 border-b border-[var(--color-border)] ${activeIndex === i ? 'bg-[var(--color-surface-alt)]' : ''}`}
              onMouseDown={e => e.preventDefault()} onClick={() => void choose(w, suggestions.filter(x => x.name === w.name && worldKey(x) !== worldKey(w)))}>
              <strong><Highlight value={w.name} query={query} /></strong> · {w.sector} <Highlight value={w.hex} query={query.split(/\s+/).slice(-1)[0] ?? query} /> {w.subsector && `· ${w.subsector}`}
              <span className="block text-sm text-[var(--color-text-muted)]"><Highlight value={w.uwp} query={query} /> {zoneLabel(w.zone) && `· ${zoneLabel(w.zone)} Zone`} {jumpDistance(w) != null && `· ${jumpDistance(w)} pc from Regina`}</span>
            </button>
          </li>)}</ul>}
      </div>
      {loadingCatalog && <p role="status">Loading sector catalog…</p>}
      {catalogError && <p role="alert" className="text-red-500">{catalogError}</p>}
      <label className="block mt-3 max-w-xs">Milieu <input className={inputClass} value={milieu} onChange={e => { selectionToken.current++; setSelected(null); setReportFor(null); setMilieu(e.target.value); }} /></label>
    </SectionPanel>
    {busy && <p role="status">Loading world data…</p>}
    {selected && <>
      <SectionPanel title={`${selected.name} · ${selected.sector} ${selected.hex}`} subtitle={selected.uwp}>
        {selected.zone && <p className={`font-bold ${selected.zone === 'R' ? 'text-red-500' : 'text-amber-500'}`}>{zoneLabel(selected.zone)} Zone</p>}
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
          <Button disabled={wikiBusy} onClick={() => void requestReport()}>{wikiBusy ? 'Adding Wiki details…' : reportVisible ? 'Rebuild weather report' : 'Build weather report'}</Button>
          {routeMap && <Button variant="secondary" disabled={addingRoute || routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}`} onClick={() => void addWorldToRoute()}>
            {addingRoute ? 'Adding…' : routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}` ? 'Added to Jump Route' : 'Add to Jump Route'}
          </Button>}
          {routeAddedFor === `${activeCampaign.id}/${worldKey(selected)}` && <Link to="/route" className="underline">Plan route</Link>}
        </div>
        {routeAddError && <p role="alert" className="mt-2 text-red-500">{routeAddError}</p>}
        {wikiBusy && <p role="status" className="mt-2">The report is shown below while Traveller Wiki details load. Exports become available when that finishes.</p>}
      </SectionPanel>
      <SectionPanel title={`Nearby worlds · Jump-${jumpRange}`} subtitle="Choose a destination to inspect it">
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
      <SectionPanel title="GM corrections" subtitle="Your table’s version takes priority; saved for this sector and hex.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label>UWP <input className={inputClass} value={overrides?.uwp ?? selected.uwp} onChange={e => setOverride('uwp', e.target.value)} /></label>
          <label>Travel zone <select className={inputClass} value={overrides?.zone ?? selected.zone} onChange={e => setOverride('zone', e.target.value)}><option value="">Green</option><option value="A">Amber</option><option value="R">Red</option></select></label>
          <label>Remarks <input className={inputClass} value={overrides?.remarks ?? selected.remarks} onChange={e => setOverride('remarks', e.target.value)} /></label>
        </div>
        <label className="block mt-3">GM note <textarea className={inputClass} value={overrides?.note ?? ''} placeholder="What is different from the survey?" onChange={e => setOverride('note', e.target.value)} /></label>
      </SectionPanel>
      {alternatives.length > 0 && <SectionPanel title="Other worlds with this name"><div className="flex flex-wrap gap-2">{alternatives.map(w => <Button key={worldKey(w)} variant="secondary" onClick={() => void choose(w, [selected, ...alternatives.filter(a => worldKey(a) !== worldKey(w))])}>{w.name} · {w.sector} {w.hex}</Button>)}</div></SectionPanel>}
    </>}
    {selected && reportVisible && !briefing && <p role="alert">The current UWP cannot be decoded. Check the GM correction before exporting.</p>}
    {briefing && <>
      <SectionPanel title={`Weather report · ${briefing.world.name}`} subtitle={`${briefing.world.sector} ${briefing.world.hex} · ${briefing.world.uwp}`}>
        {briefing.world.zone && <p className={`font-bold text-lg ${briefing.world.zone === 'R' ? 'text-red-500' : 'text-amber-500'}`}>{zoneLabel(briefing.world.zone)} Zone</p>}
        <div className="p-4 my-3 rounded border-2 border-[var(--color-primary)]">
          <h2 className="font-bold text-xl">Law {briefing.law} · weapons ashore</h2>
          <p>{briefing.points.law}</p>
        </div>
        <ul className="list-disc pl-6 space-y-1">
          <li>{briefing.points.starport}</li><li>{briefing.points.atmosphere}</li><li>{briefing.points.gravity}</li><li>{briefing.points.government}</li>
        </ul>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button disabled={wikiBusy} onClick={() => void navigator.clipboard.writeText(briefing.markdown).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied' : 'Copy Markdown'}</Button>
          <Button variant="secondary" disabled={wikiBusy} onClick={download}>Download .md</Button>
          <Button disabled={!activeSession || wikiBusy || savingReport || reportSaved} onClick={() => void saveToSessionLog()}>
            {savingReport ? 'Saving…' : reportSaved ? 'Saved to session log' : 'Save to session log'}
          </Button>
        </div>
        {!activeSession && <p className="mt-2 text-sm text-[var(--color-text-muted)]">Start a session to save this report in its log.</p>}
        {saveError && <p role="alert" className="mt-2 text-sm text-red-500">{saveError}</p>}
      </SectionPanel>
      <SectionPanel title="The weather report">
        <p>{briefing.points.zone}</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
          {([['Starport', briefing.points.starport], ['Atmosphere and gear', briefing.points.atmosphere], ['Gravity', briefing.points.gravity], ['Water', briefing.points.hydro], ['Population and tech', briefing.points.population], ['Fuel', briefing.points.fuel], ['Trade codes', briefing.points.trade], ['Bases', briefing.points.bases]] as const).map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <img src={briefing.jumpMapUrl} alt={`Jump-2 map around ${briefing.world.name}`} className="w-full max-w-xl border border-[var(--color-border)]" />
        <h3 className="font-semibold mt-3">Ask the GM</h3>
        <ul className="list-disc pl-6">{briefing.points.questions.map(question => <li key={question}>{question}</li>)}</ul>
      </SectionPanel>
      <SectionPanel title="Library data">
        {wikiError && <p role="alert">Wiki unavailable: {wikiError}</p>}
        {wiki?.warning && <p role="alert">{wiki.warning}</p>}
        {wiki?.sections.map(([heading, text]) => <div key={heading} className="mb-3"><h3 className="font-semibold">{heading}</h3><p className="whitespace-pre-line">{text}</p></div>)}
        {wiki && <a href={wiki.url} target="_blank" rel="noreferrer">{wiki.title} · Traveller Wiki (c. 1116)</a>}
        {(wiki?.wtn || wiki?.gwp) && <p>Economy (wiki): WTN {wiki.wtn || '—'} · GWP {wiki.gwp || '—'}</p>}
      </SectionPanel>
      <SectionPanel title="Markdown note" collapsible defaultOpen={false}><pre className="text-xs whitespace-pre-wrap break-words max-h-[35rem] overflow-y-auto">{briefing.markdown}</pre></SectionPanel>
    </>}
    <p className="text-xs text-[var(--color-text-muted)]">World data © TravellerMap.com / Traveller Wiki contributors (wiki text CC BY-NC 3.0). Traveller is a trademark of Far Future Enterprises. Personal, non-commercial use.</p>
  </div>;
}
