import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildBriefing, decodeWorld, lawBans } from './briefing';
import { hexDistance, jumpDistance, loadSector, parseSectorTab, rankWorlds, type WorldHit } from './worldData';
import type { WikiArticle } from './wikiData';
import { articleTitleForRow, wikiRowForWorld } from './wikiData';
import liveFixtures from './worldFixtures.json';

const zila: WorldHit = {
  name: 'Zila', sector: 'Spinward Marches', hex: '2908', subsector: 'Aramis',
  uwp: 'E556727-7', zone: 'A', bases: '', remarks: 'Ag Pz', pbg: '701',
  allegiance: 'ImDd', allegianceName: 'Third Imperium, Domain of Deneb',
  stellar: 'K6 V M3 V', ix: '{-1}', ex: '(967-1)', cx: '[7655]', nobility: 'BC', worlds: '8',
};
const wiki: WikiArticle = { title: 'Zila (world)', url: 'https://wiki.travellerrpg.com/Zila_%28world%29', sections: [
  ['Urbanization', 'In addition to Zila Startown, other major settlements on Zila include Suugadus, Dirniga, and Irkigaki.'],
] };

describe('Traveller landing briefing', () => {
  it('decodes Zila using the supplied Python tables and eHex digits', () => {
    expect(decodeWorld(zila)).toEqual({ port: 'E', siz: 5, atm: 5, hyd: 6, pop: 7, gov: 2, law: 7, tl: 7,
      popExact: 70_000_000, belts: 0, gg: 1, remarks: ['Ag', 'Pz'] });
    expect(decodeWorld({ ...zila, uwp: 'AABCDEF-G' }).siz).toBe(10);
  });
  it('keeps the prototype note byte for byte through the rules and survey sections', () => {
    const actual = buildBriefing(zila, wiki, { milieu: 'M1105', generated: '2026-09-26', homeDistance: 10 }).markdown;
    const sample = readFileSync(new URL('./zilaPrototype.md', import.meta.url), 'utf8');
    // The prompt transport stripped trailing spaces from empty YAML values;
    // the executable Python prototype leaves them in place.
    const normalizedSample = sample.replace(/^(imperial_date|session|bases):$/gm, '$1: ');
    expect(actual.split('## Library data')[0]).toBe(normalizedSample.split('## Library data')[0]);
  });
  it('matches the Python prototype for all five reference worlds, apart from the requested flavor seam', () => {
    for (const source of liveFixtures) {
      const world: WorldHit = {
        name: source.Name, sector: source.Sector, hex: source.Hex, subsector: source.SubsectorName,
        uwp: source.UWP, zone: source.Zone, bases: source.Bases, remarks: source.Remarks,
        pbg: source.PBG, allegiance: source.Allegiance, allegianceName: source.AllegianceName,
        stellar: source.Stellar, ix: source.Ix, ex: source.Ex, cx: source.Cx,
        nobility: source.Nobility, worlds: String(source.Worlds),
      };
      const rendered = buildBriefing(world, null, { milieu: 'M1105', generated: '2026-09-26', homeDistance: jumpDistance(world) });
      const withoutFlavor = rendered.markdown.replace(
        '## Milo’s Briefing\n\n*Local model flavor goes here; facts above come from the rules and world data.*\n\n## What to Expect\n\n*Local model flavor goes here.*\n\n', '',
      );
      const golden = readFileSync(new URL(`./golden/${source.Name}.md`, import.meta.url), 'utf8');
      expect(withoutFlavor, source.Name).toBe(golden);
    }
  });
  it('applies bans cumulatively and never permits Milo’s laser pistol at LL2 or above', () => {
    expect(lawBans(7).map(b => b.weapons)).toContain('Portable energy and laser weapons');
    expect(buildBriefing({ ...zila, uwp: 'E556720-7' }, null, { milieu: 'M1105' }).weaponsAshore).toBe(true);
    expect(buildBriefing({ ...zila, uwp: 'E556722-7' }, null, { milieu: 'M1105' }).weaponsAshore).toBe(false);
    expect(lawBans(12)).toHaveLength(10);
  });
  it('uses Traveller even-column geometry and ranks exact before prefix before fuzzy', () => {
    expect(hexDistance([19, 10], [29, 8])).toBe(10);
    expect(jumpDistance(zila)).toBe(10);
    expect(hexDistance([19, 10], [19, 10])).toBe(0);
    const worlds = ['Reginald', 'Regina', 'Reginante'].map((name, i) => ({ ...zila, name, hex: `19${10 + i}` }));
    expect(rankWorlds(worlds, 'Regina')[0].name).toBe('Regina');
    expect(rankWorlds(worlds, 'Regna')[0].name).toBe('Regina');
  });
  it('uses the canonical sector name when the bulk TSV supplies only its abbreviation', () => {
    const rows = parseSectorTab('Sector\tSS\tHex\tName\tUWP\nSpin\tD\t2908\tZila\tE556727-7\n', 'Spinward Marches');
    expect(rows[0]).toMatchObject({ sector: 'Spinward Marches', subsector: 'D', hex: '2908' });
  });
  it('resolves subsector names and sector coordinates from cached metadata', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(url.includes('/api/sec?')
      ? 'Sector\tSS\tHex\tName\tUWP\nSpin\tD\t2908\tZila\tE556727-7\n'
      : JSON.stringify({ X: -4, Y: -1, Tags: 'Official OTU', Subsectors: [{ Index: 'D', Name: 'Aramis' }] }))));
    try {
      const rows = await loadSector('Spinward Marches');
      expect(rows[0]).toMatchObject({ sector: 'Spinward Marches', subsector: 'Aramis', sectorX: -4, sectorY: -1 });
    } finally { vi.unstubAllGlobals(); }
  });
  it('resolves an ambiguous wiki name by sector and hex', () => {
    const rows = [
      { page: 'Aramis (other world)/data', world: 'Aramis (other world)', sector: 'Spinward Marches', hex: '2540' },
      { page: 'Aramis (world)/data', world: 'Aramis (world)', sector: 'Spinward Marches', hex: '3110' },
    ];
    const chosen = wikiRowForWorld(rows, { ...zila, name: 'Aramis', hex: '3110' });
    expect(chosen && articleTitleForRow(chosen)).toBe('Aramis (world)');
  });
});
