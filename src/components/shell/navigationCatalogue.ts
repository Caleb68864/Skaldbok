/**
 * Every navigable destination in the app, and which surface offers it.
 *
 * @remarks
 * Navigation used to be five hand-maintained lists — `BottomNav`,
 * `CharacterSubNav`, `SessionSubNav`, the campaign header's overflow sheet and
 * `MoreScreen` — with no relationship between them and no relationship to
 * `routes/index.tsx`. Two things went wrong as a direct result: `/more` was
 * reachable from nothing at all, and the Knowledge Base was buried well enough
 * that an audit twice concluded it was unreachable and twice was wrong.
 *
 * This is the manifest. `navigationCatalogue.test.ts` walks the route table and
 * fails on any concrete route that neither appears here nor is listed as a
 * deliberate exception with a reason — so a screen added without a way in is a
 * failing test rather than a discovery months later.
 *
 * It is a manifest rather than a renderer. The three tab rows have genuinely
 * different behaviour — engine-driven labels, conditional tabs, longest-prefix
 * active matching — and collapsing them into one component would trade a real
 * bug for a worse abstraction. What they share is *the list of destinations*,
 * and that is what lives here.
 */

/** Where a destination is offered to the user. */
export type NavSurface =
  /** The persistent three-tab bottom bar. */
  | 'bottom'
  /** The character tab row, shown under `/character/*`. */
  | 'character'
  /** The session tab row, shown under the campaign section. */
  | 'session'
  /** The campaign header's overflow sheet. */
  | 'menu'
  /** Linked from inside a screen rather than from any nav chrome. */
  | 'in-screen';

export interface NavDestination {
  /** The route path exactly as `routes/index.tsx` declares it. */
  path: string;
  /** Default user-facing label. A surface may override it — see `dynamicLabel`. */
  label: string;
  /** Every surface that offers this destination. Never empty. */
  surfaces: NavSurface[];
  /**
   * Set when the destination only appears for some rulesets, with the engine or
   * system field that decides. Documented rather than enforced: the deciding
   * code lives in the tab row that renders it.
   */
  conditional?: string;
  /** Set when the label comes from the ruleset rather than from this file. */
  dynamicLabel?: boolean;
  /** Why this destination exists where it does, when that is not obvious. */
  note?: string;
}

export const NAV_DESTINATIONS: NavDestination[] = [
  // --- Character section -------------------------------------------------
  { path: '/character/play', label: 'Play', surfaces: ['character'] },
  {
    path: '/character/sheet',
    label: 'Sheet',
    surfaces: ['bottom', 'character'],
    note: 'The bottom bar’s "Characters" tab lands here.',
  },
  { path: '/character/skills', label: 'Skills', surfaces: ['character'] },
  { path: '/character/gear', label: 'Gear', surfaces: ['character'] },
  {
    path: '/character/magic',
    label: 'Abilities / Magic',
    surfaces: ['character'],
    conditional: 'engine.labels.abilitiesScreen',
    dynamicLabel: true,
    note: 'Absent for a ruleset with no abilities screen, rather than leading to a dead end.',
  },

  // --- Session / campaign section ----------------------------------------
  { path: '/session', label: 'Session', surfaces: ['bottom', 'session'] },
  { path: '/session/log', label: 'Log', surfaces: ['session', 'in-screen'], note: 'Also the global FAB.' },
  { path: '/ledger', label: 'Ledger', surfaces: ['session'] },
  {
    path: '/route',
    label: 'Route',
    surfaces: ['session'],
    conditional: 'system.routePlanner',
    dynamicLabel: true,
    note: 'Each ruleset names its own travel concept; this file names none of them.',
  },

  // --- Library and tools --------------------------------------------------
  { path: '/reference', label: 'Reference', surfaces: ['bottom', 'menu'] },
  { path: '/library', label: 'Character Library', surfaces: ['menu'] },
  { path: '/trash', label: 'Trash', surfaces: ['menu'] },
  { path: '/settings', label: 'Settings', surfaces: ['menu'] },
  { path: '/profile', label: 'Profile', surfaces: ['menu'] },
  {
    path: '/kb',
    label: 'Knowledge Base',
    surfaces: ['in-screen'],
    note:
      'Reached through VaultBrowser on the Session tab (SessionScreen). Audited twice as ' +
      '"unreachable" and wrong both times — hence this entry.',
  },
  {
    path: '/bestiary',
    label: 'Bestiary',
    surfaces: ['in-screen'],
    note: 'Buttons on the Session screen.',
  },
  {
    path: '/ships',
    label: 'Ships & Vehicles',
    surfaces: ['in-screen'],
    note:
      'Reached from the vehicles panel on the character sheet, which only renders for a ' +
      'ruleset that declares vehicles. Found by this catalogue’s own test, which flagged it ' +
      'as having no recorded way in.',
  },
];

/** Destinations a given surface offers, in catalogue order. */
export function destinationsFor(surface: NavSurface): NavDestination[] {
  return NAV_DESTINATIONS.filter((d) => d.surfaces.includes(surface));
}

/**
 * Routes that are deliberately not in the catalogue, and why.
 *
 * @remarks
 * Every entry is a claim that the route needs no nav surface. The catalogue
 * test reads this list, so adding a route here is a visible decision rather
 * than an omission.
 */
export const ROUTES_WITHOUT_A_NAV_SURFACE: Record<string, string> = {
  '/character':
    'Structural parent with no element of its own; its index child redirects to ' +
    '/character/sheet, which is catalogued.',
  '/print':
    'Shell-less print view, opened from Settings and from a character sheet with an explicit ' +
    'characterId. Nav chrome does not render on it at all.',
  '/note/new': 'Contextual: reached by composing a note, never by navigating to a blank one.',
  '/note/:id/edit': 'Parameterised — meaningless without a note id.',
  '/kb/:nodeId': 'Parameterised — the node is chosen inside the Knowledge Base.',
  '/bestiary/trash':
    'Alias kept for links made before the trash held anything but creatures; /trash is the ' +
    'catalogued destination.',
};
