import { cachedText, fetchTextWithTimeout, type WorldHit } from './worldData';
import { reserveRateLimitSlot } from '../../storage/repositories/metadataRepository';

export interface WikiArticle {
  title: string;
  url: string;
  sections: [string, string][];
  wtn?: string;
  gwp?: string;
  warning?: string;
}

const WIKI = 'https://wiki.travellerrpg.com';
const WIKI_RATE_KEY = 'travellerWikiNextRequestAt';
/** Allow time between the reservation and the actual network start. */
export const WIKI_REQUEST_INTERVAL_MS = 30_500;

/** The metadata transaction reserves slots atomically across tabs and reloads. */
async function politeText(url: string): Promise<string> {
  const slot = await reserveRateLimitSlot(WIKI_RATE_KEY, WIKI_REQUEST_INTERVAL_MS);
  const delay = Math.max(0, slot - Date.now());
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
  // The wiki is substantially slower than TravellerMap in live checks; give
  // it enough time to answer while still ending a hung request visibly.
  return fetchTextWithTimeout(url, 25_000);
}

async function wikiJson(url: string, days: number): Promise<unknown> {
  return JSON.parse(await cachedText(url, days, politeText));
}

export interface CargoRow { page?: string; world?: string; sector?: string; hex?: string; era?: string; wtn?: string; gwp?: string; }

/** Match the chosen location, never an ambiguous world name. */
export function wikiRowForWorld(rows: CargoRow[], world: WorldHit): CargoRow | undefined {
  return rows.find(r => r.hex === world.hex && r.sector?.toLowerCase() === world.sector.toLowerCase());
}

export function articleTitleForRow(row: CargoRow): string | undefined {
  return row.world || row.page?.replace(/\/data$/, '');
}

export async function loadWikiIndex(sector: string): Promise<CargoRow[]> {
  const params = new URLSearchParams({
    action: 'cargoquery', tables: 'StellarData',
    fields: '_pageName=page,world,sector,hex,era,uwp,codes,bases,zone,allegiance,wtn,gwp',
    where: `sector='${sector.replace(/'/g, "''")}' AND era='Milieu 1116'`,
    limit: '500', format: 'json', origin: '*',
  });
  const data = await wikiJson(`${WIKI}/api.php?${params}`, 30) as { cargoquery?: { title: CargoRow }[] };
  return (data.cargoquery ?? []).map(row => row.title);
}

function plainWiki(text: string): string {
  return text
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi, '')
    .replace(/\{\|[\s\S]*?\|\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''?/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const KEEP = /mainworld data|geography|native|history|starport|demograph|government|legal|military|culture|social|economy|urbani|intro/i;
export function parseWikiSections(raw: string): [string, string][] {
  const sections: [string, string][] = [];
  let heading = 'Intro';
  let lines: string[] = [];
  const flush = () => {
    const clean = lines.map(plainWiki).filter(line => line && !/^(It is part of|This world is|Sources?:|Behind the Claw)/i.test(line)).slice(0, 6);
    const text = clean.join('\n');
    if (KEEP.test(heading) && text) sections.push([heading, text.length > 1200 ? `${text.slice(0, 1199).replace(/\s+\S*$/, '')} …` : text]);
  };
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^={2,4}\s*(.*?)\s*={2,4}\s*$/);
    if (match) { flush(); heading = plainWiki(match[1]); lines = []; }
    else if (line.trim() && !/^\s*[{|!]/.test(line)) lines.push(line);
  }
  flush();
  return sections;
}

export async function loadWikiArticle(world: WorldHit): Promise<WikiArticle | null> {
  const rows = await loadWikiIndex(world.sector);
  const row = wikiRowForWorld(rows, world);
  if (!row) return null;
  // Cargo's _pageName points to the structured "/data" subpage. Its `world`
  // field is the article readers should see (for example Zila (world)).
  const title = articleTitleForRow(row);
  if (!title) return null;
  const params = new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', formatversion: '2', format: 'json', origin: '*' });
  const data = await wikiJson(`${WIKI}/api.php?${params}`, 7) as { parse?: { title?: string; wikitext?: string }; error?: { info?: string } };
  if (data.error || !data.parse) return null;
  const parsedTitle = data.parse.title || title;
  const warning = parsedTitle !== title ? 'Wiki article may be for a different world.' : undefined;
  return {
    title: parsedTitle, url: `${WIKI}/${encodeURIComponent(parsedTitle.replace(/ /g, '_')).replace(/\(/g, '%28').replace(/\)/g, '%29')}`,
    sections: warning ? [] : parseWikiSections(data.parse.wikitext ?? ''),
    wtn: row.wtn, gwp: row.gwp, warning,
  };
}
