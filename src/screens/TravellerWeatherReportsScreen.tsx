import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/primitives/Button';
import { SectionPanel } from '../components/primitives/SectionPanel';
import { NoCampaignPrompt } from '../components/shell/NoCampaignPrompt';
import { useCampaignContext } from '../features/campaign/CampaignContext';
import { useSessionLog } from '../features/session/useSessionLog';
import type { Briefing } from '../features/travellerBriefing/briefing';
import type { WikiArticle } from '../features/travellerBriefing/wikiData';
import type { GearFinding } from '../features/travellerBriefing/gearRestrictions';
import * as noteRepository from '../storage/repositories/noteRepository';
import { docToText } from '../features/notes/textToDoc';
import type { Note } from '../types/note';

interface ReportRouteState {
  campaignId: string;
  report: Briefing;
  wiki: WikiArticle | null;
  wikiError?: string;
  gearFindings: GearFinding[];
  gearReviewSources: number;
  gearError?: string;
}

interface WeatherReportTypeData {
  kind?: string;
  report?: Briefing;
  gearFindings?: GearFinding[];
  gearReviewSources?: number;
  gearError?: string;
  wikiError?: string;
  wiki?: WikiArticle | null;
  sector?: string;
  hex?: string;
}

function isWeatherReport(note: Note): boolean {
  const data = note.typeData as WeatherReportTypeData | undefined;
  return note.type === 'log' && data?.kind === 'traveller-weather-report';
}

function getSavedReport(note: Note): Briefing | undefined {
  return (note.typeData as WeatherReportTypeData | undefined)?.report;
}

function ReportContent({
  report, wiki, wikiError, gearFindings, gearReviewSources, gearError, markdown,
  canSave, saving, saved, saveError, onSave,
}: {
  report?: Briefing;
  wiki?: WikiArticle | null;
  wikiError?: string;
  gearError?: string;
  gearFindings: GearFinding[];
  gearReviewSources: number;
  markdown: string;
  canSave: boolean;
  saving: boolean;
  saved: boolean;
  saveError: string;
  onSave: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  async function copyMarkdown() {
    setCopyError('');
    try { await navigator.clipboard.writeText(markdown); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setCopyError('Clipboard access is unavailable. Use Download .md to save the report.'); }
  }

  function download() {
    const filename = report?.filename ?? 'Traveller weather report.md';
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <>
    {report ? <>
      <SectionPanel title={`Weather report · ${report.world.name}`} subtitle={`${report.world.sector} ${report.world.hex} · ${report.world.uwp}`} collapsible defaultOpen>
        {report.world.zone && <p className={`font-bold text-lg ${report.world.zone === 'R' ? 'text-red-500' : 'text-amber-500'}`}>{report.world.zone === 'R' ? 'Red' : 'Amber'} Zone</p>}
        <div className="p-4 my-3 rounded border-2 border-[var(--color-primary)]">
          <h2 className="font-bold text-xl">Law {report.law} · weapons ashore</h2>
          <p>{report.points.law}</p>
        </div>
        <ul className="list-disc pl-6 space-y-1">
          <li>{report.points.starport}</li><li>{report.points.atmosphere}</li><li>{report.points.gravity}</li><li>{report.points.government}</li>
        </ul>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={() => void copyMarkdown()}>{copied ? 'Copied' : 'Copy Markdown'}</Button>
          <Button variant="secondary" onClick={download}>Download .md</Button>
          <Button disabled={!canSave || saving || saved} onClick={onSave}>{saving ? 'Saving…' : saved ? 'Saved to session log' : 'Save to session log'}</Button>
        </div>
        {!canSave && <p className="mt-2 text-sm text-[var(--color-text-muted)]">Start a session to save this report in its log.</p>}
        {saveError && <p role="alert" className="mt-2 text-sm text-red-500">{saveError}</p>}
        {copyError && <p role="alert" className="mt-2 text-sm text-red-500">{copyError}</p>}
      </SectionPanel>
      {gearError ? <SectionPanel title="Party gear check incomplete" collapsible defaultOpen><p role="alert">{gearError} The report does not confirm that the party's gear is clear.</p></SectionPanel> : gearFindings.length > 0 || gearReviewSources > 0 ? <SectionPanel title="Party gear before going ashore" subtitle="Based on recorded gear and the world's survey law; the GM decides local exceptions and permits." collapsible defaultOpen>
        {gearFindings.length ? <ul className="space-y-2">
          {gearFindings.map((finding, index) => <li key={`${finding.owner}/${finding.item}/${index}`} className="border-b border-[var(--color-border)] pb-2">
            <strong>{finding.action === 'leave aboard' ? 'Leave aboard' : 'Ask GM'}</strong> · {finding.owner}: {finding.item} ({finding.category})<br />
            <span className="text-sm text-[var(--color-text-muted)]">{finding.reason}</span>
          </li>)}
        </ul> : <p>No recorded gear is flagged by the general law table. Check local rules with the GM.</p>}
      </SectionPanel> : null}
      <SectionPanel title="The weather report" collapsible defaultOpen>
        <p>{report.points.zone}</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3">
          {([['Starport', report.points.starport], ['Atmosphere and gear', report.points.atmosphere], ['Gravity', report.points.gravity], ['Water', report.points.hydro], ['Population and tech', report.points.population], ['Fuel', report.points.fuel], ['Trade codes', report.points.trade], ['Bases', report.points.bases]] as const).map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <img src={report.jumpMapUrl} alt={`Jump-2 map around ${report.world.name}`} className="w-full max-w-xl border border-[var(--color-border)]" />
        <h3 className="font-semibold mt-3">Ask the GM</h3>
        <ul className="list-disc pl-6">{report.points.questions.map(question => <li key={question}>{question}</li>)}</ul>
      </SectionPanel>
      <SectionPanel title="Library data" collapsible defaultOpen={false}>
        {wikiError && <p role="alert">Wiki unavailable: {wikiError}</p>}
        {wiki?.warning && <p role="alert">{wiki.warning}</p>}
        {wiki?.sections.map(([heading, text]) => <div key={heading} className="mb-3"><h3 className="font-semibold">{heading}</h3><p className="whitespace-pre-line">{text}</p></div>)}
        {wiki && <a href={wiki.url} target="_blank" rel="noreferrer">{wiki.title} · Traveller Wiki (c. 1116)</a>}
        {(wiki?.wtn || wiki?.gwp) && <p>Economy (wiki): WTN {wiki.wtn || '—'} · GWP {wiki.gwp || '—'}</p>}
      </SectionPanel>
    </> : <SectionPanel title="Saved weather report" collapsible defaultOpen>
      <p>This report predates the detailed report view. Its saved session-log content is shown below.</p>
      <pre className="text-sm whitespace-pre-wrap break-words">{markdown}</pre>
    </SectionPanel>}
    <SectionPanel title="Markdown note" collapsible defaultOpen={false}><pre className="text-xs whitespace-pre-wrap break-words max-h-[35rem] overflow-y-auto">{markdown}</pre></SectionPanel>
    <p className="text-xs text-[var(--color-text-muted)]">World data © TravellerMap.com / Traveller Wiki contributors (wiki text CC BY-NC 3.0). Traveller is a trademark of Far Future Enterprises. Personal, non-commercial use.</p>
  </>;
}

export default function TravellerWeatherReportsScreen() {
  const { activeCampaign, activeSession } = useCampaignContext();
  const activeCampaignId = activeCampaign?.id;
  const { logToSession } = useSessionLog();
  const { noteId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ReportRouteState | null;
  const isDraftRoute = location.pathname === '/weather-report';
  const isHistoryRoute = location.pathname === '/weather-reports';
  const [reports, setReports] = useState<Note[]>([]);
  const [savedNote, setSavedNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveInFlight = useRef(false);
  const currentSavedNote = savedNote && savedNote.id === noteId && savedNote.campaignId === activeCampaignId ? savedNote : null;
  const savedState = useMemo(() => currentSavedNote ? (currentSavedNote.typeData as WeatherReportTypeData | undefined) : undefined, [currentSavedNote]);
  const draftIsCurrent = Boolean(state && activeCampaign && state.campaignId === activeCampaign.id);
  const report = isDraftRoute && draftIsCurrent ? state?.report : currentSavedNote ? getSavedReport(currentSavedNote) : undefined;
  const markdown = isDraftRoute && draftIsCurrent ? state?.report.markdown : currentSavedNote ? docToText(currentSavedNote.body) : '';
  const gearFindings = isDraftRoute && draftIsCurrent ? state?.gearFindings ?? [] : savedState?.gearFindings ?? [];
  const gearReviewSources = isDraftRoute && draftIsCurrent ? state?.gearReviewSources ?? 0 : savedState?.gearReviewSources ?? 0;
  const gearError = isDraftRoute ? state?.gearError : savedState?.gearError;

  useEffect(() => {
    let cancelled = false;
    if (!activeCampaignId || !isHistoryRoute) return;
    setLoading(true); setLoadError(''); setReports([]);
    noteRepository.getNotesByCampaign(activeCampaignId).then(notes => {
      if (!cancelled) setReports(notes.filter(isWeatherReport).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeCampaignId, isHistoryRoute]);

  useEffect(() => {
    let cancelled = false;
    if (!activeCampaignId || !noteId || isDraftRoute || isHistoryRoute) return;
    setLoading(true); setLoadError(''); setSavedNote(null);
    noteRepository.getNoteById(noteId).then(note => {
      if (cancelled) return;
      if (!note || note.campaignId !== activeCampaignId || !isWeatherReport(note)) {
        setLoadError('This saved weather report is unavailable in the active campaign.'); setSavedNote(null);
      } else setSavedNote(note);
    }).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeCampaignId, noteId, isDraftRoute, isHistoryRoute]);

  if (!activeCampaign) return <NoCampaignPrompt />;
  if (isDraftRoute && !draftIsCurrent) return <Navigate to="/weather-reports" replace />;
  if (!isHistoryRoute && !isDraftRoute && !noteId) return <Navigate to="/weather-reports" replace />;
  if (!isHistoryRoute && !isDraftRoute && !currentSavedNote && !loadError) return <div role="status" className="p-[var(--space-md)]">Loading weather report…</div>;
    if (!isHistoryRoute && !currentSavedNote && !draftIsCurrent && !loadError) return <Navigate to="/weather-reports" replace />;

  async function saveReport() {
    if (!report || !activeCampaign || !activeSession || saveInFlight.current || !isDraftRoute) return;
    saveInFlight.current = true;
    setSaving(true); setSaveError('');
    try {
      const noteId = await logToSession(
        `${report.world.name} weather report · ${report.world.sector} ${report.world.hex}`,
        'log',
        { kind: 'traveller-weather-report', sector: report.world.sector, hex: report.world.hex, report, wiki, wikiError, gearFindings, gearReviewSources, gearError },
        { body: report.markdown, session: { id: activeSession.id, campaignId: activeCampaign.id }, targetEncounterId: null },
      );
      if (!noteId) throw new Error('No active session is available.');
      navigate(`/weather-reports/${noteId}`, { replace: true });
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Could not save the report.'); }
    finally { saveInFlight.current = false; setSaving(false); }
  }

  const wiki = isDraftRoute ? state?.wiki : savedState?.wiki;
  const wikiError = isDraftRoute ? state?.wikiError : savedState?.wikiError;
  const isSaved = !isDraftRoute && Boolean(currentSavedNote);

  return <div className="w-full min-h-full max-w-none p-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
    <header className="flex items-center justify-between gap-3 flex-wrap">
      <div><h1 className="text-2xl font-bold">{isHistoryRoute ? 'Previous weather reports' : report ? `${report.world.name} weather report` : 'Weather report'}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{isHistoryRoute ? `${activeCampaign.name} · saved reports only` : 'Traveller world briefing'}</p></div>
      {isHistoryRoute ? <Link className="underline" to="/worlds">World search</Link> : <Button variant="secondary" onClick={() => navigate('/weather-reports')}>Previous reports</Button>}
    </header>
    {isHistoryRoute ? <SectionPanel title="Saved weather reports" collapsible defaultOpen>
      {loading ? <p role="status">Loading saved reports…</p> : loadError ? <p role="alert">{loadError}</p> : reports.length === 0 ? <p>No weather reports have been saved to a session in this campaign.</p> :
        <ul className="divide-y divide-[var(--color-border)]">{reports.map(note => {
          const data = note.typeData as WeatherReportTypeData | undefined;
          return <li key={note.id} className="py-3"><Link className="font-semibold underline" to={`/weather-reports/${note.id}`}>{note.title}</Link>
            <p className="text-sm text-[var(--color-text-muted)]">{data?.sector} {data?.hex} · saved {new Date(note.createdAt).toLocaleString()}</p></li>;
        })}</ul>}
    </SectionPanel> : loadError ? <p role="alert">{loadError}</p> : report && markdown ? <ReportContent
      report={report} wiki={wiki} wikiError={wikiError} gearFindings={gearFindings} gearReviewSources={gearReviewSources} gearError={gearError}
      markdown={markdown} canSave={isDraftRoute && Boolean(activeSession)} saving={saving} saved={isSaved}
      saveError={saveError} onSave={() => void saveReport()}
    /> : null}
  </div>;
}
