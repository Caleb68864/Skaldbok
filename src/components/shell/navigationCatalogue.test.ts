import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  NAV_DESTINATIONS,
  ROUTES_WITHOUT_A_NAV_SURFACE,
  destinationsFor,
  type NavSurface,
} from './navigationCatalogue';

/**
 * Every route must have a way in.
 *
 * @remarks
 * Navigation was five hand-maintained lists with no relationship to the route
 * table, and it failed in both directions. `/more` was reachable from nothing —
 * a whole screen, routed, rendered, and unreachable without typing the URL. And
 * the Knowledge Base was buried deep enough inside the Session tab that an
 * audit twice concluded it was unreachable and twice was wrong, which is its
 * own kind of expensive.
 *
 * This test is worth more than the catalogue it checks. It parses the real
 * `routes/index.tsx` — not a copy — and fails on any concrete route that
 * neither appears in the catalogue nor is written down as a deliberate
 * exception. Adding a screen without a way in now fails CI.
 */

const ROUTES_FILE = join(process.cwd(), 'src/routes/index.tsx');

/**
 * Every `path` declared in the route table, minus the redirects.
 *
 * @remarks
 * A `<Navigate>` element is not a destination — it is a forwarding address for
 * an old link — so those are excluded rather than needing a catalogue entry
 * each. Child paths under `/character` are declared relative, so they are
 * rejoined to their parent.
 */
function declaredRoutes(): string[] {
  const source = readFileSync(ROUTES_FILE, 'utf8');
  const routesStart = source.indexOf('export const routes');
  expect(routesStart, 'route table not found').toBeGreaterThan(-1);
  const body = source.slice(routesStart);

  const out: string[] = [];
  // `{ path: 'x', element: … }` — one per line in this file.
  for (const line of body.split('\n')) {
    const match = /path:\s*'([^']+)'/.exec(line);
    if (!match) continue;
    const path = match[1]!;
    if (path === '*') continue;
    // Redirects forward somewhere else; the target is what needs a surface.
    if (line.includes('<Navigate')) continue;
    out.push(path.startsWith('/') ? path : `/character/${path}`);
  }
  return out;
}

describe('navigation catalogue', () => {
  const routes = declaredRoutes();

  it('parses the real route table', () => {
    expect(routes.length).toBeGreaterThan(10);
    expect(routes).toContain('/session');
    expect(routes).toContain('/character/sheet');
  });

  it('gives every route either a nav surface or a written reason', () => {
    const catalogued = new Set(NAV_DESTINATIONS.map((d) => d.path));
    const excused = new Set(Object.keys(ROUTES_WITHOUT_A_NAV_SURFACE));

    const orphans = routes.filter((path) => !catalogued.has(path) && !excused.has(path));

    expect(
      orphans,
      `${orphans.join(', ')} is routed but nothing navigates to it. Either add it to ` +
      'NAV_DESTINATIONS with the surface that offers it, or to ROUTES_WITHOUT_A_NAV_SURFACE ' +
      'with the reason it needs none. This is how /more went dead.',
    ).toEqual([]);
  });

  it('has no catalogue entry pointing at a route that does not exist', () => {
    // The other direction: a renamed or deleted route leaving a nav entry
    // behind is a link to nowhere.
    const declared = new Set(routes);
    const dangling = NAV_DESTINATIONS.map((d) => d.path).filter((p) => !declared.has(p));
    expect(
      dangling,
      `${dangling.join(', ')} is offered by a nav surface but is not in the route table.`,
    ).toEqual([]);
  });

  it('has no excuse recorded for a route that no longer exists', () => {
    const declared = new Set(routes);
    const stale = Object.keys(ROUTES_WITHOUT_A_NAV_SURFACE).filter((p) => !declared.has(p));
    expect(stale, `${stale.join(', ')} is excused from needing a nav surface but is not routed.`)
      .toEqual([]);
  });

  it('gives every excuse a real reason', () => {
    for (const [path, reason] of Object.entries(ROUTES_WITHOUT_A_NAV_SURFACE)) {
      expect(reason.length, `${path} has no reason recorded`).toBeGreaterThan(20);
    }
  });

  it('gives every destination at least one surface and a label', () => {
    for (const destination of NAV_DESTINATIONS) {
      expect(destination.surfaces.length, `${destination.path} has no surface`).toBeGreaterThan(0);
      expect(destination.label.length, `${destination.path} has no label`).toBeGreaterThan(0);
    }
  });

  it('has no duplicate paths', () => {
    const paths = NAV_DESTINATIONS.map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps the bottom bar at three tabs', () => {
    // A fourth would not fit the layout; this is the constraint that made the
    // overflow sheet necessary in the first place.
    expect(destinationsFor('bottom').map((d) => d.path)).toEqual([
      '/character/sheet',
      '/session',
      '/reference',
    ]);
  });

  it('offers every surface at least one destination', () => {
    const surfaces: NavSurface[] = ['bottom', 'character', 'session', 'menu', 'in-screen'];
    for (const surface of surfaces) {
      expect(destinationsFor(surface).length, `nothing is offered on ${surface}`).toBeGreaterThan(0);
    }
  });
});

/**
 * The surfaces render from the catalogue rather than from their own copies.
 *
 * @remarks
 * Checked against the source rather than by rendering, because the two link
 * lists are plain `<Link>` markup with no behaviour worth mounting a DOM for,
 * and the point is that the list is no longer written out twice.
 */
describe('surfaces read the catalogue', () => {
  it.each([
    ['src/components/shell/BottomNav.tsx', 'bottom'],
    ['src/components/shell/CharacterSubNav.tsx', 'character'],
    ['src/components/shell/SessionSubNav.tsx', 'session'],
    ['src/components/shell/CampaignHeader.tsx', 'menu'],
  ])('%s builds its entries from the catalogue', (file, surface) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source, `${file} does not read the navigation catalogue`).toContain('navigationCatalogue');
    expect(source).toContain(`destinationsFor('${surface}')`);
  });

  it('no surface still hard-codes a path the catalogue owns', () => {
    // The specific regression: a path written into a nav component instead of
    // taken from the catalogue is how the five lists drifted apart.
    const menuPaths = destinationsFor('menu').map((d) => d.path);
    const header = readFileSync(join(process.cwd(), 'src/components/shell/CampaignHeader.tsx'), 'utf8');
    const hardcoded = menuPaths.filter((p) => header.includes(`to="${p}"`));
    expect(
      hardcoded,
      `CampaignHeader hard-codes ${hardcoded.join(', ')} instead of reading the catalogue.`,
    ).toEqual([]);
  });
});
