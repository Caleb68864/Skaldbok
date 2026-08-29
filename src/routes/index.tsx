import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { ShellLayout } from '../components/shell/ShellLayout';
import type { RouteObject } from 'react-router-dom';

/**
 * Lazily imports a screen so it becomes its own chunk.
 *
 * The first paint then downloads only the shell plus the route the user landed
 * on, instead of the whole app. The PWA precache still lists every chunk (see
 * `workbox.globPatterns`), so a route visited for the first time while offline
 * still resolves.
 *
 * Created once at module scope — a `lazy()` call inside a render function
 * would mint a new component type every render and remount the screen.
 * `pick` adapts named exports; `lazy()` itself only understands `default`.
 */
function lazyScreen<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return lazy(() => load().then((m) => ({ default: pick(m) })));
}

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center min-h-[50dvh] text-text-muted"
    >
      Loading…
    </div>
  );
}

/** Renders a lazy screen inside the Suspense boundary that shows while its chunk loads. */
function screen(Screen: ComponentType): ReactNode {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Screen />
    </Suspense>
  );
}

const SessionScreen = lazyScreen(() => import('../screens/SessionScreen'), (m) => m.SessionScreen);
const MoreScreen = lazyScreen(() => import('../screens/MoreScreen'), (m) => m.MoreScreen);
const SheetScreen = lazyScreen(() => import('../screens/SheetScreen'), (m) => m.default);
const SkillsScreen = lazyScreen(() => import('../screens/SkillsScreen'), (m) => m.default);
const GearScreen = lazyScreen(() => import('../screens/GearScreen'), (m) => m.default);
const MagicScreen = lazyScreen(() => import('../screens/MagicScreen'), (m) => m.default);
const PlayDashboardScreen = lazyScreen(() => import('../screens/PlayDashboardScreen'), (m) => m.default);
const NoteEditorScreen = lazyScreen(() => import('../screens/NoteEditorScreen'), (m) => m.default);
const ReferenceScreen = lazyScreen(() => import('../screens/ReferenceScreen'), (m) => m.default);
const SettingsScreen = lazyScreen(() => import('../screens/SettingsScreen'), (m) => m.default);
const ProfileScreen = lazyScreen(() => import('../screens/ProfileScreen'), (m) => m.default);
const CharacterLibraryScreen = lazyScreen(() => import('../screens/CharacterLibraryScreen'), (m) => m.default);
const ShipsScreen = lazyScreen(() => import('../screens/ShipsScreen'), (m) => m.default);
const LedgerScreen = lazyScreen(() => import('../screens/LedgerScreen'), (m) => m.default);
const RouteScreen = lazyScreen(() => import('../screens/RouteScreen'), (m) => m.default);
const PrintableSheetScreen = lazyScreen(() => import('../screens/PrintableSheetScreen'), (m) => m.default);
const BestiaryScreenRoute = lazyScreen(() => import('../features/bestiary/BestiaryScreenRoute'), (m) => m.BestiaryScreenRoute);
const TrashScreen = lazyScreen(() => import('../screens/TrashScreen'), (m) => m.default);
const KnowledgeBaseScreen = lazyScreen(() => import('../screens/KnowledgeBaseScreen'), (m) => m.default);
const SessionLog = lazyScreen(() => import('../features/session/sessionLog/SessionLog'), (m) => m.SessionLog);

/**
 * Application route configuration consumed by `createBrowserRouter` /
 * `RouterProvider` at the entry point.
 *
 * @remarks
 * The tree is structured in two layers:
 *
 * 1. **Shell-less routes** — rendered without the bottom navigation shell
 *    (currently only `/print`).
 * 2. **Shell routes** — wrapped in {@link ShellLayout} which provides the
 *    persistent navigation bar and campaign context.
 *
 * Legacy top-level paths (`/sheet`, `/skills`, `/gear`, `/magic`, `/combat`)
 * are retained as permanent redirects so that any bookmarked URLs continue to
 * work after the restructure to `/character/*`.
 *
 * The catch-all `'*'` path redirects unknown URLs to the character sheet to
 * prevent a blank screen.
 *
 * @example
 * ```tsx
 * import { createBrowserRouter, RouterProvider } from 'react-router-dom';
 * import { routes } from './routes';
 *
 * const router = createBrowserRouter(routes);
 * <RouterProvider router={router} />
 * ```
 */
export const routes: RouteObject[] = [
  { path: '/print', element: screen(PrintableSheetScreen) },
  {
    element: <ShellLayout />,
    children: [
      { index: true, element: <Navigate to="/character/sheet" replace /> },
      { path: '/session', element: screen(SessionScreen) },
      { path: '/session/log', element: screen(SessionLog) },
      { path: '/notes', element: <Navigate to="/session?view=notes" replace /> },
      { path: '/note/new', element: screen(NoteEditorScreen) },
      { path: '/note/:id/edit', element: screen(NoteEditorScreen) },
      { path: '/more', element: screen(MoreScreen) },
      {
        path: '/character',
        children: [
          { index: true, element: <Navigate to="/character/sheet" replace /> },
          { path: 'play', element: screen(PlayDashboardScreen) },
          { path: 'sheet', element: screen(SheetScreen) },
          { path: 'skills', element: screen(SkillsScreen) },
          { path: 'gear', element: screen(GearScreen) },
          { path: 'magic', element: screen(MagicScreen) },
        ],
      },
      // Legacy routes — redirect to new paths
      { path: '/sheet', element: <Navigate to="/character/sheet" replace /> },
      { path: '/skills', element: <Navigate to="/character/skills" replace /> },
      { path: '/gear', element: <Navigate to="/character/gear" replace /> },
      { path: '/magic', element: <Navigate to="/character/magic" replace /> },
      { path: '/combat', element: <Navigate to="/character/sheet" replace /> },
      { path: '/kb', element: screen(KnowledgeBaseScreen) },
      { path: '/kb/:nodeId', element: screen(KnowledgeBaseScreen) },
      { path: '/bestiary', element: screen(BestiaryScreenRoute) },
      { path: '/bestiary/trash', element: screen(TrashScreen) },
      { path: '/reference', element: screen(ReferenceScreen) },
      { path: '/settings', element: screen(SettingsScreen) },
      { path: '/profile', element: screen(ProfileScreen) },
      { path: '/library', element: screen(CharacterLibraryScreen) },
      { path: '/ships', element: screen(ShipsScreen) },
      { path: '/ledger', element: screen(LedgerScreen) },
      { path: '/route', element: screen(RouteScreen) },
      { path: '*', element: <Navigate to="/character/sheet" replace /> },
    ],
  },
];
