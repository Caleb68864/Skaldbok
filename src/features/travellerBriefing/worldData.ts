/** TravellerMap M1105 catalog and detail, with durable browser caches. */
export interface WorldHit {
  name: string;
  sector: string;
  hex: string;
  subsector: string;
  uwp: string;
  zone: string;
  bases: string;
  remarks: string;
  pbg: string;
  allegiance: string;
  stellar: string;
  ix: string;
  ex: string;
  cx: string;
  nobility: string;
  worlds: string;
  sectorX?: number;
  sectorY?: number;
  sectorTags?: string;
  worldX?: number;
  worldY?: number;
  allegianceName?: string;
}

const TM = 'https://travellermap.com';
const CACHE_NAME = 'skaldbok-traveller-briefing-v1';
const DAY = 86_400_000;
const REQUEST_TIMEOUT_MS = 15_000;
const memory = new Map<string, { at: number; data: string }>();

/** Bound both the connection and body read, including servers that never reply. */
export async function fetchTextWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.text();
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error(`Request timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function cachedText(url: string, days: number, fetcher: (url: string) => Promise<string> = fetchTextWithTimeout): Promise<string> {
  const now = Date.now();
  const inMemory = memory.get(url);
  if (inMemory && now - inMemory.at < days * DAY) return inMemory.data;
  const cache = typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null);
  let old = inMemory;
  if (!old && cache) {
    try {
      const stored = await cache.match(url);
      if (stored) {
        old = await stored.json() as { at: number; data: string };
        memory.set(url, old);
      }
    } catch { /* A damaged or unavailable cache must not block the network. */ }
  }
  if (old && now - old.at < days * DAY) return old.data;
  try {
    const item = { at: now, data: await fetcher(url) };
    memory.set(url, item);
    if (cache) {
      try { await cache.put(url, new Response(JSON.stringify(item))); }
      catch { /* The fetched world remains usable when storage is full. */ }
    }
    return item.data;
  } catch (error) {
    if (old) return old.data;
    throw error;
  }
}

const str = (value: unknown): string => value == null ? '' : String(value);
const field = (row: Record<string, string>, ...names: string[]) => names.map(name => row[name]).find(Boolean) ?? '';

export function parseSectorTab(text: string, sector: string): WorldHit[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const headerIndex = lines.findIndex(line => /\bHex\b/.test(line) && /\bUWP\b/.test(line));
  if (headerIndex < 0) throw new Error('TravellerMap sector data has no Hex/UWP header');
  const headers = lines[headerIndex].replace(/^#\s*/, '').split('\t').map(x => x.trim());
  return lines.slice(headerIndex + 1).filter(line => !line.startsWith('#')).map(line => {
    const cells = line.split('\t');
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    return {
      // The bulk file's Sector column is an abbreviation ("Spin"), while
      // detail and wiki APIs use the canonical name supplied in the request.
      name: field(row, 'Name'), sector,
      hex: field(row, 'Hex'), subsector: field(row, 'SS'), uwp: field(row, 'UWP'),
      zone: field(row, 'Zone'), bases: field(row, 'Bases'), remarks: field(row, 'Remarks'),
      pbg: field(row, 'PBG'), allegiance: field(row, 'Allegiance'), stellar: field(row, 'Stars'),
      ix: field(row, '{Ix}'), ex: field(row, '(Ex)'), cx: field(row, '[Cx]'),
      nobility: field(row, 'Nobility'), worlds: field(row, 'W'),
    };
  }).filter(w => /^\d{4}$/.test(w.hex) && w.name);
}

export async function loadSectorBasic(sector: string, milieu = 'M1105'): Promise<WorldHit[]> {
  const url = `${TM}/api/sec?${new URLSearchParams({ sector, type: 'TabDelimited', milieu })}`;
  return parseSectorTab(await cachedText(url, 30), sector);
}

/** Add readable subsector names without delaying the first search results. */
export async function enrichSector(worlds: WorldHit[], sector: string, milieu = 'M1105'): Promise<WorldHit[]> {
  const metadataUrl = `${TM}/api/metadata?${new URLSearchParams({ sector, milieu })}`;
  const metadata = await cachedText(metadataUrl, 30).then(text => JSON.parse(text) as {
      X?: number; Y?: number; Tags?: string;
      Subsectors?: { Index: string; Name: string }[];
      Allegiances?: { Code: string; Name: string }[];
    }).catch(() => null);
  const subsectors = new Map(metadata?.Subsectors?.map(s => [s.Index, s.Name]) ?? []);
  const allegiances = new Map(metadata?.Allegiances?.map(a => [a.Code, a.Name]) ?? []);
  return worlds.map(w => ({ ...w,
    subsector: subsectors.get(w.subsector) ?? w.subsector,
    allegianceName: allegiances.get(w.allegiance),
    sectorX: metadata?.X, sectorY: metadata?.Y, sectorTags: metadata?.Tags,
  }));
}

/** Convenience loader for callers that require metadata before displaying. */
export async function loadSector(sector: string, milieu = 'M1105'): Promise<WorldHit[]> {
  return enrichSector(await loadSectorBasic(sector, milieu), sector, milieu);
}

export function worldFromApi(w: Record<string, unknown>): WorldHit {
  const hex = str(w.Hex || `${String(w.HexX ?? '').padStart(2, '0')}${String(w.HexY ?? '').padStart(2, '0')}`);
  return {
    name: str(w.Name), sector: str(w.Sector), hex, subsector: str(w.SubsectorName ?? w.Subsector),
    uwp: str(w.Uwp ?? w.UWP), zone: str(w.Zone), bases: str(w.Bases), remarks: str(w.Remarks),
    pbg: str(w.PBG), allegiance: str(w.Allegiance), stellar: str(w.Stellar),
    ix: str(w.Ix), ex: str(w.Ex), cx: str(w.Cx), nobility: str(w.Nobility), worlds: str(w.Worlds),
    sectorX: Number.isFinite(Number(w.SectorX)) ? Number(w.SectorX) : undefined,
    sectorY: Number.isFinite(Number(w.SectorY)) ? Number(w.SectorY) : undefined,
    sectorTags: str(w.SectorTags),
    worldX: w.WorldX != null && Number.isFinite(Number(w.WorldX)) ? Number(w.WorldX) : undefined,
    worldY: w.WorldY != null && Number.isFinite(Number(w.WorldY)) ? Number(w.WorldY) : undefined,
    allegianceName: str(w.AllegianceName),
  };
}

export async function remoteSearch(query: string, milieu = 'M1105', exact = false): Promise<WorldHit[]> {
  const q = exact ? `exact:${query}` : `${query}*`;
  const url = `${TM}/api/search?${new URLSearchParams({ q, milieu })}`;
  const json = JSON.parse(await cachedText(url, 1)) as { Results?: { Items?: { World?: Record<string, unknown> }[] } };
  return (json.Results?.Items ?? []).flatMap(item => item.World ? [worldFromApi(item.World)] : []);
}

export async function loadWorld(hit: WorldHit, milieu = 'M1105'): Promise<WorldHit> {
  const url = `${TM}/data/${encodeURIComponent(hit.sector)}/${hit.hex}?${new URLSearchParams({ milieu })}`;
  const json = JSON.parse(await cachedText(url, 30)) as { Worlds?: Record<string, unknown>[] };
  const w = json.Worlds?.[0];
  if (!w) throw new Error(`No world at ${hit.sector} ${hit.hex}`);
  return {
    ...hit, name: str(w.Name) || hit.name, sector: str(w.Sector) || hit.sector,
    hex: str(w.Hex) || hit.hex, subsector: str(w.SubsectorName) || hit.subsector,
    uwp: str(w.UWP) || hit.uwp, zone: str(w.Zone), bases: str(w.Bases),
    remarks: str(w.Remarks), pbg: str(w.PBG), allegiance: str(w.Allegiance),
    allegianceName: str(w.AllegianceName), stellar: str(w.Stellar),
    ix: str(w.Ix), ex: str(w.Ex), cx: str(w.Cx), nobility: str(w.Nobility),
    worlds: str(w.Worlds), worldX: Number(w.WorldX), worldY: Number(w.WorldY),
  };
}

export interface NearbyWorld { world: WorldHit; distance: number | null; }

/** Distance between two selected worlds, including worlds in adjacent sectors. */
export function distanceBetweenWorlds(a: WorldHit, b: WorldHit): number | null {
  if (a.worldX !== undefined && a.worldY !== undefined && b.worldX !== undefined && b.worldY !== undefined)
    return hexDistance([a.worldX, a.worldY], [b.worldX, b.worldY]);
  if (!/^\d{4}$/.test(a.hex) || !/^\d{4}$/.test(b.hex)) return null;
  const x = (w: WorldHit) => Number(w.hex.slice(0, 2));
  const y = (w: WorldHit) => Number(w.hex.slice(2));
  if (a.sector.toLowerCase() === b.sector.toLowerCase()) return hexDistance([x(a), y(a)], [x(b), y(b)]);
  if (a.sectorX !== undefined && a.sectorY !== undefined && b.sectorX !== undefined && b.sectorY !== undefined)
    return hexDistance([a.sectorX * 32 + x(a), a.sectorY * 40 + y(a)], [b.sectorX * 32 + x(b), b.sectorY * 40 + y(b)]);
  return null;
}

/** Fast offline suggestions from sectors already loaded on this device. */
export function nearbyFromCatalog(origin: WorldHit, catalog: WorldHit[], jump: number): NearbyWorld[] {
  return catalog.flatMap(world => {
    if (worldKey(world) === worldKey(origin)) return [];
    const distance = distanceBetweenWorlds(origin, world);
    return distance !== null && distance <= jump ? [{ world, distance }] : [];
  }).sort(compareNearby);
}

function compareNearby(a: NearbyWorld, b: NearbyWorld): number {
  return (a.distance ?? Infinity) - (b.distance ?? Infinity)
    || a.world.name.localeCompare(b.world.name)
    || worldKey(a.world).localeCompare(worldKey(b.world));
}

/** Canonical nearby worlds, including neighbors over sector borders. */
export async function loadNearbyWorlds(origin: WorldHit, jump: number, milieu = 'M1105'): Promise<NearbyWorld[]> {
  if (!Number.isInteger(jump) || jump < 1 || jump > 12) throw new Error('Jump range must be between 1 and 12');
  const url = `${TM}/api/jumpworlds?${new URLSearchParams({ sector: origin.sector, hex: origin.hex, jump: String(jump), milieu })}`;
  const json = JSON.parse(await cachedText(url, 30)) as { Worlds?: Record<string, unknown>[] };
  if (!Array.isArray(json.Worlds)) throw new Error('TravellerMap nearby-world data is unavailable');
  return json.Worlds.map(worldFromApi).filter(world => world.name && /^\d{4}$/.test(world.hex) && worldKey(world) !== worldKey(origin))
    .map(world => ({ world, distance: distanceBetweenWorlds(origin, world) }))
    .sort(compareNearby);
}

export function hexDistance(a: readonly [number, number], b: readonly [number, number]): number {
  const cube = ([x, y]: readonly [number, number]) => [x, y - Math.floor((x + (x & 1)) / 2), -x - y + Math.floor((x + (x & 1)) / 2)];
  const ac = cube(a), bc = cube(b);
  return Math.max(...ac.map((n, i) => Math.abs(n - bc[i])));
}

export function jumpDistance(world: WorldHit, homeSector = 'Spinward Marches', homeHex = '1910'): number | null {
  if (!/^\d{4}$/.test(world.hex) || !/^\d{4}$/.test(homeHex)) return null;
  const homeX = Number(homeHex.slice(0, 2)), homeY = Number(homeHex.slice(2));
  const worldX = Number(world.hex.slice(0, 2)), worldY = Number(world.hex.slice(2));
  if (world.sector.toLowerCase() === homeSector.toLowerCase()) return hexDistance([homeX, homeY], [worldX, worldY]);
  if (homeSector === 'Spinward Marches' && world.sectorX !== undefined && world.sectorY !== undefined)
    return hexDistance([-4 * 32 + homeX, -1 * 40 + homeY], [world.sectorX * 32 + worldX, world.sectorY * 40 + worldY]);
  return null;
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}

export function rankWorlds(worlds: WorldHit[], query: string): WorldHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const [sectorToken, hexToken] = q.split(/\s+/);
  const score = (w: WorldHit): number => {
    const name = w.name.toLowerCase();
    if (name === q || w.hex === q || w.uwp.toLowerCase() === q) return 0;
    if ((hexToken && w.sector.toLowerCase().startsWith(sectorToken) && w.hex.startsWith(hexToken))) return 1;
    if (name.startsWith(q)) return 2;
    if (w.hex.startsWith(q) || w.uwp.toLowerCase().startsWith(q)) return 3;
    if (name.includes(q)) return 4;
    const distance = editDistance(name, q);
    return distance <= Math.max(1, Math.floor(q.length / 3)) ? 5 + distance : Infinity;
  };
  return worlds.map(w => ({ w, s: score(w) })).filter(x => Number.isFinite(x.s))
    .sort((a, b) => a.s - b.s || a.w.name.localeCompare(b.w.name) || compareCanonAndDistance(a.w, b.w))
    .map(x => x.w);
}

function compareCanonAndDistance(a: WorldHit, b: WorldHit): number {
  const official = (w: WorldHit) => /Official|OTU/i.test(w.sectorTags ?? '') ? 0 : 1;
  return official(a) - official(b) || (jumpDistance(a) ?? Infinity) - (jumpDistance(b) ?? Infinity);
}

/** Exact names are sorted by canon status, then proximity to Regina. */
export function orderWorldCandidates(worlds: WorldHit[]): WorldHit[] {
  return [...worlds].sort(compareCanonAndDistance);
}

export function worldKey(w: Pick<WorldHit, 'sector' | 'hex'>): string { return `${w.sector.toLowerCase()}/${w.hex}`; }
