import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/primitives/Button';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useSystemDefinition } from '../features/systems/useSystemDefinition';
import { getEngine } from '../features/systems/engine';
import { useBriefingPreferences } from '../features/travellerBriefing/useBriefingPreferences';
import { buildBriefing } from '../features/travellerBriefing/briefing';
import { loadSectorBasic, enrichSector, loadWorld, rankWorlds, remoteSearch, jumpDistance, orderWorldCandidates, worldKey, type WorldHit } from '../features/travellerBriefing/worldData';
import { loadWikiArticle, type WikiArticle } from '../features/travellerBriefing/wikiData';
import { DEFAULT_SYSTEM_ID } from '../systems/registry';

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
  const { activeCampaign } = useCampaignContext();
  const { system, error: systemError } = useSystemDefinition(activeCampaign?.system ?? DEFAULT_SYSTEM_ID);
  const capability = system ? getEngine(system).landingBriefing : undefined;
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
  const [wiki, setWiki] = useState<WikiArticle | null>(null);
  const [wikiError, setWikiError] = useState('');
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState('');
  const [session, setSession] = useState('');
  const [milieu, setMilieu] = useState('M1105');
  const [alternatives, setAlternatives] = useState<WorldHit[]>([]);
  const [copied, setCopied] = useState(false);
  const selectionToken = useRef(0);

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
  const overrides = selected ? preferences.overrides[worldKey(selected)] : undefined;
  const briefing = useMemo(() => {
    if (!selected) return null;
    try { return buildBriefing(selected, wiki, { milieu, date, session, homeDistance: jumpDistance(selected), alternatives, overrides }); }
    catch { return null; }
  },
    [selected, wiki, milieu, date, session, alternatives, overrides]);

  async function choose(hit: WorldHit, other: WorldHit[] = []) {
    const token = ++selectionToken.current;
    setOpen(false); setBusy(true); setWiki(null); setWikiError(''); setCatalogError('');
    setAlternatives(other); setQuery(hit.name);
    try {
      const world = await loadWorld(hit, milieu);
      if (token !== selectionToken.current) return;
      setSelected(world);
      const recent = [world, ...preferences.recent.filter(w => worldKey(w) !== worldKey(world))].slice(0, 8);
      await preferences.updateSettings({ recentBriefingWorlds: recent });
      try { const article = await loadWikiArticle(world); if (token === selectionToken.current) setWiki(article); }
      catch (error) { if (token === selectionToken.current) setWikiError(error instanceof Error ? error.message : String(error)); }
    } catch (error) { if (token === selectionToken.current) setCatalogError(error instanceof Error ? error.message : String(error)); }
    finally { if (token === selectionToken.current) setBusy(false); }
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
  if (!activeCampaign) return <NoCampaignPrompt />;
  if (!system && !systemError) return <div role="status">Loading rules…</div>;
  if (systemError) return <div role="alert">{systemError}</div>;
  if (!capability) return <Navigate to="/session" replace />;
  return <div className="p-[var(--space-md)] flex flex-col gap-[var(--space-md)] max-w-5xl mx-auto">
    <SectionPanel title={capability.label} subtitle={`${milieu} Traveller worlds · landing briefing`}>
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
      <div className="flex gap-3 flex-wrap mt-3">
        <label>Imperial date <input className={inputClass} value={date} placeholder="097-1105" onChange={e => setDate(e.target.value)} /></label>
        <label>Session <input className={inputClass} value={session} onChange={e => setSession(e.target.value)} /></label>
        <label>Milieu <input className={inputClass} value={milieu} onChange={e => setMilieu(e.target.value)} /></label>
      </div>
    </SectionPanel>
    {busy && <p role="status">Loading world and wiki data. Wiki requests are spaced 30 seconds apart.</p>}
    {selected && !briefing && <p role="alert">The current UWP cannot be decoded. Check the GM correction before exporting.</p>}
    {briefing && <>
      <SectionPanel title={`${briefing.world.name} · ${briefing.world.sector} ${briefing.world.hex}`} subtitle={briefing.world.uwp}>
        {briefing.world.zone && <p className={`font-bold text-lg ${briefing.world.zone === 'R' ? 'text-red-500' : 'text-amber-500'}`}>{zoneLabel(briefing.world.zone)} Zone</p>}
        <div className="p-4 my-3 rounded border-2 border-[var(--color-primary)]">
          <h2 className="font-bold text-xl">Law {briefing.law} · weapons ashore</h2>
          <p>{briefing.points.law}</p>
        </div>
        <ul className="list-disc pl-6 space-y-1">
          <li>{briefing.points.starport}</li><li>{briefing.points.atmosphere}</li><li>{briefing.points.gravity}</li><li>{briefing.points.government}</li>
        </ul>
        <div className="flex gap-2 mt-4 flex-wrap"><Button onClick={() => void navigator.clipboard.writeText(briefing.markdown).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>{copied ? 'Copied' : 'Copy Markdown'}</Button><Button variant="secondary" onClick={download}>Download .md</Button></div>
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
      <SectionPanel title="GM corrections" subtitle="Your table’s version takes priority; saved for this sector and hex.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label>UWP <input className={inputClass} value={overrides?.uwp ?? selected?.uwp ?? ''} onChange={e => setOverride('uwp', e.target.value)} /></label>
          <label>Travel zone <select className={inputClass} value={overrides?.zone ?? selected?.zone ?? ''} onChange={e => setOverride('zone', e.target.value)}><option value="">Green</option><option value="A">Amber</option><option value="R">Red</option></select></label>
          <label>Remarks <input className={inputClass} value={overrides?.remarks ?? selected?.remarks ?? ''} onChange={e => setOverride('remarks', e.target.value)} /></label>
        </div>
        <label className="block mt-3">GM note <textarea className={inputClass} value={overrides?.note ?? ''} placeholder="What is different from the survey?" onChange={e => setOverride('note', e.target.value)} /></label>
      </SectionPanel>
      {alternatives.length > 0 && <SectionPanel title="Other worlds with this name"><div className="flex flex-wrap gap-2">{alternatives.map(w => <Button key={worldKey(w)} variant="secondary" onClick={() => void choose(w, [briefing.world, ...alternatives.filter(a => worldKey(a) !== worldKey(w))])}>{w.name} · {w.sector} {w.hex}</Button>)}</div></SectionPanel>}
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
