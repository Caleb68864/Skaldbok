import { cachedText, worldFromApi, type WorldHit } from '../travellerBriefing/worldData';

export interface TravellerMapRouteOptions {
  jump: number;
  avoidRed: boolean;
  wildernessRefuel: boolean;
  milieu: string;
}

/** TravellerMap's route API returns the shortest path under its supported constraints. */
export async function planTravellerMapRoute(start: string, end: string, options: TravellerMapRouteOptions): Promise<WorldHit[]> {
  if (!Number.isInteger(options.jump) || options.jump < 1 || options.jump > 12)
    throw new Error('Jump range must be between 1 and 12');
  const params = new URLSearchParams({ start, end, jump: String(options.jump), milieu: options.milieu });
  if (options.avoidRed) params.set('nored', '1');
  if (options.wildernessRefuel) params.set('wild', '1');
  const url = `https://travellermap.com/api/route?${params}`;
  const data: unknown = JSON.parse(await cachedText(url, 7));
  if (!Array.isArray(data) || data.length < 2) throw new Error('TravellerMap returned no usable route');
  const worlds = data.map(row => worldFromApi(row as Record<string, unknown>));
  if (worlds.some(world => !world.name || !world.sector || !/^\d{4}$/.test(world.hex)))
    throw new Error('TravellerMap returned an incomplete route');
  return worlds;
}
