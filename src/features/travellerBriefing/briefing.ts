import * as T from './rules';
import { hexDistance, type WorldHit } from './worldData';
import type { WikiArticle } from './wikiData';

export interface BriefingOptions {
  milieu: string;
  date?: string;
  session?: string;
  generated?: string;
  alternatives?: WorldHit[];
  note?: string;
  homeDistance?: number | null;
  overrides?: Partial<Pick<WorldHit, 'uwp' | 'zone' | 'bases' | 'remarks' | 'pbg' | 'stellar' | 'allegianceName'>> & { note?: string };
}
export interface BriefingPoints {
  law: string;
  starport: string;
  atmosphere: string;
  gravity: string;
  zone: string;
  government: string;
  hydro: string;
  population: string;
  fuel: string;
  trade: string;
  bases: string;
  questions: string[];
}
export interface Briefing { filename: string; markdown: string; points: BriefingPoints; jumpMapUrl: string; world: WorldHit; law: number; weaponsAshore: boolean; }
export interface DecodedWorld { port: string; siz: number; atm: number; hyd: number; pop: number; gov: number; law: number; tl: number; popExact: number; belts: number; gg: number; remarks: string[]; }
const index = <V>(record: unknown, key: string): V | undefined => (record as Record<string, V>)[key];
const ehex = (c: string): number => T.EHEX.indexOf(c.toUpperCase());

export function decodeWorld(w: WorldHit): DecodedWorld {
  if (!/^[A-EX][0-9A-HJ-NP-Z]{6}-[0-9A-HJ-NP-Z]$/i.test(w.uwp)) throw new Error(`Invalid UWP: ${w.uwp}`);
  const digits = [...w.uwp.slice(1, 7)].map(ehex);
  const pbg = w.pbg || '000';
  const multiplier = /^[1-9]$/.test(pbg[0]) ? Number(pbg[0]) : 1;
  return { port: w.uwp[0].toUpperCase(), siz: digits[0], atm: digits[1], hyd: digits[2], pop: digits[3], gov: digits[4], law: digits[5], tl: ehex(w.uwp[8]),
    popExact: digits[3] ? multiplier * 10 ** digits[3] : 0,
    belts: /^\d$/.test(pbg[1] ?? '') ? Number(pbg[1]) : 0,
    gg: /^\d$/.test(pbg[2] ?? '') ? Number(pbg[2]) : 0,
    remarks: w.remarks.split(/\s+/).filter(Boolean) };
}
export function lawBans(level: number): { level: number; weapons: string; armour: string | null }[] {
  return Array.from({ length: Math.min(Math.max(level, 0), 9) + 1 }, (_, i) => {
    const [weapons, armour] = index<readonly [string, string | null]>(T.LAW, String(i))!;
    return { level: i, weapons, armour };
  });
}
const chance = (target: number) => {
  let hits = 0; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b <= target) hits++;
  return `${Math.round(hits / 36 * 100)}%`;
};
const checkbox = (labels: string[], selected: boolean[]) => labels.map((label, i) => `> - [${selected[i] ? 'x' : ' '}] ${label}`).join('\n');
function fmtPop(n: number): string {
  if (!n) return '0';
  for (const [div, word] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']] as const) {
    if (n >= div) return `${Number((n / div).toPrecision(6))} ${word}`;
  }
  return String(n);
}
function tlBand(tl: number): string {
  if (tl <= 3) return '0–3 primitive'; if (tl <= 6) return '4–6 industrial';
  if (tl <= 9) return '7–9 pre-stellar'; if (tl <= 11) return '10–11 early stellar';
  if (tl <= 14) return '12–14 avg stellar'; if (tl <= 33) return '15 high stellar'; return '?';
}
function tlComms(tl: number): string {
  if (tl < 3) return 'No telecommunications at all beyond what the starport offers';
  if (tl <= 6) return 'Radio/telephone between major cities; no satellites';
  if (tl < 9) return 'Progressively more advanced comms grid (not global)';
  return 'Comms accessible from every point on the surface';
}
function yamlValue(value: string | number | boolean): string {
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string' && (/[:#]/.test(value) || value.includes('[') || value.includes(']') || /^\d+$/.test(value))) return JSON.stringify(value);
  return String(value);
}
function culture(cx: string): string | null {
  const s = cx.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (s.length !== 4) return null;
  const [h, a, st] = [...s].map(ehex);
  const acc = a <= 2 ? 'extremely xenophobic' : a <= 5 ? 'wary of outsiders' : a <= 8 ? 'neutral toward outsiders' : a <= 11 ? 'welcoming' : a <= 13 ? 'very welcoming' : 'extremely xenophilic';
  const het = h <= 3 ? 'monolithic culture' : h <= 9 ? 'mixed culture' : 'fragmented culture';
  const strange = st <= 2 ? 'very typical' : st <= 5 ? 'somewhat unusual' : st <= 8 ? 'strange' : 'near-incomprehensible';
  return `${het} (H${s[0]}), ${acc} (A${s[1]}), ${strange} to offworlders (S${s[2]})`;
}

/** Port of briefing.py's render; the supplied tables are kept verbatim in rules.ts. */
export function buildBriefing(canon: WorldHit, wiki: WikiArticle | null, options: BriefingOptions): Briefing {
  const w = { ...canon, ...options.overrides };
  const d = decodeWorld(w);
  const name = w.name, sector = w.sector, hex = w.hex;
  const zoneKey = w.zone || '';
  const [zoneWord, zoneLabel, zoneText] = index<readonly [string, string, string]>(T.ZONE, zoneKey) ?? T.ZONE[''];
  const sp = index<{ quality: string; berthing: string; fuel: string; facilities: string; highport: string; tpl: string }>(T.STARPORT, d.port);
  if (!sp) throw new Error(`Unknown starport: ${d.port}`);
  const lawIndex = Math.min(d.law, 9);
  const [govType, govDesc, contraband] = index<readonly [string, string, readonly string[]]>(T.GOV, String(d.gov)) ?? ['?', '', []];
  const [atmComp, atmPress, atmGear] = index<readonly [string, string, string | null]>(T.ATMOS, String(d.atm)) ?? ['?', '?', '?'];
  const [sizeDiam, sizeG, sizeExample] = index<readonly [string, string, string]>(T.SIZE, String(d.siz)) ?? ['?', '?', ''];
  const [hydPct, hydDesc] = index<readonly [string, string]>(T.HYDRO, String(d.hyd)) ?? ['?', '?'];
  const date = options.date || '';
  const title = date ? `${date} ${name}` : `${name} Briefing`;
  const dateMatch = date.match(/^(\d{3})-(\d{4})$/);
  const filename = dateMatch ? `${dateMatch[2]}-${dateMatch[1]} ${name}.md` : `${name} - Briefing.md`;
  const weaponsAshore = lawIndex < 2;
  const wikiUrl = wiki?.url ?? `https://wiki.travellerrpg.com/${encodeURIComponent(name.replace(/ /g, '_'))}_(world)`;
  const mapUrl = `https://travellermap.com/?sector=${encodeURIComponent(sector).replace(/%20/g, '+')}&hex=${hex}`;
  const jumpImage = `https://travellermap.com/api/jumpmap?sector=${encodeURIComponent(sector)}&hex=${hex}&jump=2&style=print&milieu=${options.milieu}`;
  const tradeMgt = d.remarks.filter(c => index(T.TRADE_MGT, c));
  const tradeT5 = d.remarks.filter(c => index(T.TRADE_T5, c) && !index(T.TRADE_MGT, c));
  const otherRemarks = d.remarks.filter(c => !index(T.TRADE_MGT, c) && !index(T.TRADE_T5, c));
  const bases = [...w.bases].map(c => index<readonly [string, string]>(T.BASES, c) ?? [c, 'unknown code']);
  const homeDistance = options.homeDistance;
  const lines: string[] = [];
  const fm: Record<string, string | number | boolean | string[]> = {
    title, aliases: [`${name} Landing Brief`], type: 'landing-brief', world: name, sector,
    subsector: w.subsector, hex, milieu: options.milieu, imperial_date: date, session: options.session || '',
    uwp: w.uwp, starport: d.port, law_level: d.law, tech_level: d.tl, government: d.gov,
    travel_zone: zoneWord, bases: w.bases, trade_codes: d.remarks,
    allegiance: w.allegianceName ?? w.allegiance, weapons_ashore: weaponsAshore,
    personas_used: [], source: 'travellermap.com + wiki.travellerrpg.com (canon; GM wins)',
    generated: options.generated ?? new Date().toISOString().slice(0, 10), cssclasses: ['ta-brief'],
    tags: ['traveller', 'campaign', 'field-log', 'landing-brief'], status: 'draft',
  };
  lines.push('---');
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) { lines.push(`${key}:${value.length ? '' : ' []'}`); value.forEach(x => lines.push(`  - ${x.includes(':') ? JSON.stringify(x) : x}`)); }
    else lines.push(`${key}: ${yamlValue(value)}`);
  }
  lines.push('---\n', `# ${title}\n`);
  const bits = [`**${w.uwp}**`, `${sector} ${hex}`, `${w.subsector} subsector`];
  if (d.remarks.includes('Cp')) bits.push('subsector capital');
  if (bases.length) bits.push(bases.map(b => b[0].toLowerCase()).join(' + '));
  if (homeDistance != null) bits.push(homeDistance === 0 ? 'campaign home port' : `${homeDistance} pc from home`);
  lines.push(`${bits.join(' · ')}\n`, `[TravellerMap](${mapUrl}) · [Traveller Wiki](${wikiUrl}) · milieu ${options.milieu}\n`);
  if (options.note || options.alternatives?.length) {
    lines.push(`> [!warning] Which ${name}?`);
    if (options.note) lines.push(`> ${options.note}`);
    for (const alt of (options.alternatives ?? []).slice(0, 6)) lines.push(`> - ${alt.name} — ${alt.sector} ${alt.hex} \`${alt.uwp}\``);
    lines.push('> Re-run with `--sector` / `--hex` if this is the wrong one.\n');
  }
  if (zoneKey === 'A' || zoneKey === 'R') {
    lines.push(`> [!${zoneKey === 'R' ? 'danger' : 'warning'}] ${zoneLabel} Zone\n> ${zoneText}`);
    const remZone = d.remarks.filter(c => ['Pz', 'Da', 'Fo'].includes(c));
    if (remZone.length) lines.push('> Survey remark: ' + remZone.map(c => `**${c}** ${index<string>(T.TRADE_T5, c)}`).join(', '));
    lines.push("> ⚠️ *The survey doesn't say why. Ask the GM.*\n");
  }
  if (options.overrides && Object.keys(options.overrides).length) lines.push(`> [!info] GM override\n> This briefing uses the edited world facts; the GM’s version takes priority.${options.overrides.note ? ` ${options.overrides.note.replace(/\s+/g, ' ').trim()}` : ''}\n`);
  lines.push('## Ask the GM\n', '> [!info] Pre-filled from the canon survey — **confirm each one out loud; the GM\'s world wins.**\n');
  lines.push('> [!form|law] Law Level');
  lines.push(checkbox(Array.from({ length: 10 }, (_, i) => i < 9 ? String(i) : '9+'), Array.from({ length: 10 }, (_, i) => i === lawIndex)), '');
  lines.push('> [!ladder] Banned here — cumulative');
  for (let level = 0; level <= 9; level++) {
    const [weapons, armour] = index<readonly [string, string | null]>(T.LAW, String(level))!;
    const mark = level <= lawIndex && level > 0 ? '**' : '';
    lines.push(`> - ${level === lawIndex ? '➤ ' : ''}**${level < 9 ? level : '9+'}** — ${mark}${weapons}${mark}${armour ? ` · *${armour}*` : ''}`);
  }
  lines.push('', '> [!form] Zone', checkbox(['🟢 Green', '🟡 Amber', '🔴 Red'], [zoneKey === '', zoneKey === 'A', zoneKey === 'R']), '');
  lines.push('> [!form] Port', checkbox([...('ABCDEX')].map(c => index<typeof sp>(T.STARPORT, c)!.tpl), [...'ABCDEX'].map(c => c === d.port)), '');
  lines.push('> [!form] Startown', checkbox(['Yes', 'No'], [false, false]));
  const wikiBlob = (wiki?.sections ?? []).map(([, text]) => text).join(' ');
  const startown = wikiBlob.match(/[^.]*\b(Star ?town|Startown)\b[^.]*\./i);
  lines.push(startown ? `> Wiki mentions one: *"${startown[0].trim()}"* ⚠️ *confirm*\n` : '> ⚠️ *Not in the survey data — ask.*\n');
  const tlBands = ['0–3 primitive', '4–6 industrial', '7–9 pre-stellar', '10–11 early stellar', '12–14 avg stellar', '15 high stellar'];
  lines.push('> [!form] Tech', checkbox(tlBands, tlBands.map(b => b === tlBand(d.tl))), '');
  const govBands = ['0·7 none', '2·4 democracy', '8·9 bureaucracy', '1·3·6 corp/captive', '10–15 dictator'];
  lines.push('> [!form] Gov', checkbox(govBands, [d.gov === 0 || d.gov === 7, d.gov === 2 || d.gov === 4, d.gov === 8 || d.gov === 9, [1, 3, 6].includes(d.gov), d.gov >= 10 && d.gov <= 15]), '');
  lines.push('## Read off\n', '> [!form] Ashore', checkbox(['Laser pistol', 'Armour', 'Blades', 'TL12 earpiece', 'Sensor kit', 'Comms'], [lawIndex < 2, false, lawIndex < 8, false, false, false]));
  lines.push('> *Ticked only where the Law Level table alone decides it. Armour depends on type (cloth LL4, mesh LL5, anything visible LL8); the gear rows are GM calls.*\n');
  const [weapons, armour] = index<readonly [string, string | null]>(T.LAW, String(lawIndex))!;
  let lawText = `**Law ${d.law}:** ${weapons}${armour ? `; armour: ${armour}` : ''}. Chance of a **Check** on first approach or each day on the streets: **${chance(d.law)}** (2D ≤ ${d.law}); acting suspiciously **${chance(d.law + 1)}**; breaking and entering → Investigate **${chance(d.law + 2)}**.`;
  if (d.law >= 2) lawText += ` A laser weapon found here is **DM+${d.law - 2}** on sentencing (LL − 2).`;
  lines.push(lawText, '');
  if (contraband.length) lines.push(`**Gov ${d.gov} — ${govType}.** ${govDesc}. Typical contraband: **${contraband.join(', ')}**.${contraband.includes('Travellers') ? ' **Travellers themselves are restricted** — expect to be confined to the port or watched.' : ''}\n`);
  else lines.push(`**Gov ${d.gov} — ${govType}.** ${govDesc}. No typical contraband listed.\n`);
  lines.push('**Inside the port fence:** Imperial law — roughly **LL1**, and **all psionics forbidden**. Locally illegal kit is fine as long as it never leaves the starport.\n');
  lines.push('## The weather report\n', '| Code | | Reading |', '|---|---|---|');
  lines.push(`| **Starport** | **${d.port}** | ${sp.quality} · berthing ${sp.berthing} · fuel: ${sp.fuel} · ${sp.facilities} · ${sp.highport} |`);
  const gravNote = d.siz && d.siz <= 6 ? ' · **low gravity**: DM-1 physical skills until acclimatised' : d.siz >= 10 ? ' · **high gravity**: DM-1 all skills until acclimatised' : '';
  lines.push(`| **Size** | ${d.siz} | ${sizeDiam}, **${sizeG} G**${sizeExample ? ` (${sizeExample})` : ''}${gravNote} |`);
  const gear = atmGear ? `**${atmGear}**` : 'nothing — breathable';
  lines.push(`| **Atmosphere** | ${d.atm} | ${atmComp} (${atmPress} atm) · wear: ${gear} |`);
  lines.push(`| **Hydrographics** | ${d.hyd} | ${hydPct} — ${hydDesc} |`);
  lines.push(`| **Population** | ${d.pop} | ~**${fmtPop(d.popExact)}** (${index<string>(T.POP, String(d.pop)) ?? '?'}) |`);
  lines.push(`| **Government** | ${d.gov} | ${govType} |`, `| **Law Level** | **${d.law}** | ${weapons} |`);
  lines.push(`| **Tech Level** | ${d.tl} | ${tlBand(d.tl)} · ${tlComms(d.tl)} |`, '');
  const atmNote = index<string>(T.ATMOS_NOTE, String(d.atm));
  if (atmNote) lines.push(`> [!danger] Atmosphere\n> ${atmNote}\n`);
  const minTl = index<number>(T.ATMOS_MIN_TL, String(d.atm));
  if (minTl && d.tl < minTl && d.pop > 0) lines.push(`> [!warning] Below its environmental limit\n> Atmosphere ${d.atm} needs TL${minTl} to maintain life support; the world is TL${d.tl}. Per the rules, *the population cannot maintain its life support and is likely doomed* — a story, not a statistic.\n`);
  const fuel: string[] = [];
  if ('AB'.includes(d.port)) fuel.push('refined fuel at the port'); else if ('CD'.includes(d.port)) fuel.push('unrefined only at the port');
  if (d.gg) fuel.push(`${d.gg} gas giant(s) to skim`); if (d.hyd) fuel.push('surface water to scoop');
  lines.push(`**Fuel:** ${fuel.length ? fuel.join('; ') : '**none** — bring it with you'}. **System:** ${w.stellar || '?'} · ${d.belts} belt(s) · ${d.gg} gas giant(s) · ${w.worlds || '?'} worlds.\n`);
  if (tradeMgt.length || tradeT5.length) {
    lines.push('**Trade codes**\n');
    tradeMgt.forEach(c => { const [label, desc] = index<readonly [string, string]>(T.TRADE_MGT, c)!; lines.push(`- **${c}** ${label} — ${desc}`); });
    tradeT5.forEach(c => lines.push(`- **${c}** ${index<string>(T.TRADE_T5, c)} *(T5 survey code)*`));
    otherRemarks.forEach(c => lines.push(`- \`${c}\` *(survey remark — sophont / ownership code)*`));
    lines.push('');
  }
  lines.push(bases.length ? '**Bases:** ' + bases.map(([label, why]) => `**${label}** — ${why}`).join(' · ') + '\n' : '**Bases:** none.\n');
  const extensions: string[] = [];
  if (w.ix) extensions.push(`Importance ${w.ix.replace(/^[{} ]+|[{} ]+$/g, '')} (−3 backwater … +5 major hub)`);
  const cxText = culture(w.cx); if (cxText) extensions.push(`Culture: ${cxText}`);
  if (w.ex) extensions.push(`Economy ${w.ex} (resources/labour/infrastructure/efficiency)`);
  const nobles = [...w.nobility].flatMap(c => { const noble = index<string>(T.NOBILITY, c); return noble ? [noble] : []; });
  if (nobles.length) extensions.push(`Nobility: ${nobles.join(', ')}`);
  extensions.push(`Allegiance: ${w.allegianceName ?? w.allegiance}`);
  lines.push(`> [!abstract]- Survey extensions (T5 Second Survey)\n${extensions.map(e => `> - ${e}`).join('\n')}\n`);
  const amber: string[] = [];
  if (d.atm >= 10) amber.push(`Atmosphere ${d.atm}`);
  if ([0, 7, 10].includes(d.gov)) amber.push(`Government ${d.gov}`);
  if (d.law === 0 || d.law >= 9) amber.push(`Law Level ${d.law}`);
  if (amber.length && !zoneKey) lines.push(`> [!note] Amber-ish\n> The rules suggest *considering* Amber for ${amber.join(', ')}. Canon rates it Green — the GM may not.\n`);
  lines.push(`![Jump-2 map](${jumpImage})\n`);
  lines.push('## Library data\n');
  if (wiki?.sections.length) {
    lines.push(`> [!quote]- From the Traveller Wiki — [${wiki.title}](${wiki.url}) (canon, raw; c. 1116)`);
    for (const [head, text] of wiki.sections) { lines.push(`> **${head}**`); text.split('\n').forEach(line => lines.push(`> ${line}`)); lines.push('>'); }
    lines.push('');
  } else lines.push(`*No wiki article text (${wiki?.warning ?? 'empty'}).*\n`);
  if (wiki?.wtn || wiki?.gwp) lines.push(`**Economy (wiki, c. 1116):** ${wiki.wtn ? `WTN ${wiki.wtn}` : ''}${wiki.wtn && wiki.gwp ? ' · ' : ''}${wiki.gwp ? `GWP ${wiki.gwp}` : ''} — [${wiki.title}](${wiki.url}).\n`);
  lines.push('## Milo’s Briefing\n\n*Local model flavor goes here; facts above come from the rules and world data.*\n');
  lines.push('## What to Expect\n\n*Local model flavor goes here.*\n');
  lines.push('## Who goes as whom\n', '| | Identity | Cover for action |\n|---|---|---|\n| **Milo** | | |\n| | | |\n');
  lines.push('- [ ] Checked [[Field Log]] — one place, one face\n- [ ] Pockets sterile\n');
  lines.push('## Out\n\n**Back by** ______ · **fallback** +24h · **duress** ______\n');
  lines.push('## After\n\n- [ ] Outings logged · [ ] anything warm? · [ ] contacts — which name?\n');
  lines.push('## Notes\n');
  const points: BriefingPoints = {
    law: `Law ${d.law}: ${weapons}. Laser pistol ${weaponsAshore ? 'allowed' : 'banned'} ashore.`,
    starport: `${sp.quality} class ${d.port} starport; ${sp.fuel}.`,
    atmosphere: `${atmComp} atmosphere; ${atmGear || 'no breathing gear'} needed.`,
    gravity: `${sizeG} G${gravNote ? '; acclimatisation penalty' : ''}.`,
    zone: `${zoneLabel}: ${zoneText}`,
    government: `${govType}; typical contraband: ${contraband.join(', ') || 'none listed'}.`,
    hydro: `${hydPct} water coverage; ${hydDesc}.`,
    population: `About ${fmtPop(d.popExact)} people; tech level ${d.tl}.`,
    fuel: fuel.length ? fuel.join('; ') : 'No known local fuel; bring it with you.',
    trade: [...tradeMgt, ...tradeT5].join(', ') || 'No trade codes listed.',
    bases: bases.map(([label]) => label).join(', ') || 'No bases listed.',
    questions: ['Confirm local law and travel zone', 'Ask whether there is a startown', 'Confirm gear permitted ashore'],
  };
  return { filename, markdown: lines.join('\n'), points, jumpMapUrl: jumpImage, world: w, law: d.law, weaponsAshore };
}

export function worldDistance(a: WorldHit, b: WorldHit): number | null {
  if (a.sector !== b.sector) return null;
  return hexDistance([Number(a.hex.slice(0, 2)), Number(a.hex.slice(2))], [Number(b.hex.slice(0, 2)), Number(b.hex.slice(2))]);
}
