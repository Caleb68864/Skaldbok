import { Navigate } from 'react-router-dom';
import { ShellLayout } from '../components/shell/ShellLayout';
import { SessionScreen } from '../screens/SessionScreen';
import { MoreScreen } from '../screens/MoreScreen';
import SheetScreen from '../screens/SheetScreen';
import SkillsScreen from '../screens/SkillsScreen';
import GearScreen from '../screens/GearScreen';
import MagicScreen from '../screens/MagicScreen';
import NoteEditorScreen from '../screens/NoteEditorScreen';
import ReferenceScreen from '../screens/ReferenceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterLibraryScreen from '../screens/CharacterLibraryScreen';
import PrintableSheetScreen from '../screens/PrintableSheetScreen';
import { BestiaryScreenRoute } from '../features/bestiary/BestiaryScreenRoute';
import type { RouteObject } from 'react-router-dom';

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
  { path: '/print', element: <PrintableSheetScreen /> },
  {
    element: <ShellLayout />,
    children: [
      { index: true, element: <Navigate to="/character/sheet" replace /> },
      { path: '/session', element: <SessionScreen /> },
      { path: '/notes', element: <Navigate to="/session?view=notes" replace /> },
      { path: '/note/new', element: <NoteEditorScreen /> },
      { path: '/note/:id/edit', element: <NoteEditorScreen /> },
      { path: '/more', element: <MoreScreen /> },
      {
        path: '/character',
        children: [
          { index: true, element: <Navigate to="/character/sheet" replace /> },
          { path: 'sheet', element: <SheetScreen /> },
          { path: 'skills', element: <SkillsScreen /> },
          { path: 'gear', element: <GearScreen /> },
          { path: 'magic', element: <MagicScreen /> },
        ],
      },
      // Legacy routes — redirect to new paths
      { path: '/sheet', element: <Navigate to="/character/sheet" replace /> },
      { path: '/skills', element: <Navigate to="/character/skills" replace /> },
      { path: '/gear', element: <Navigate to="/character/gear" replace /> },
      { path: '/magic', element: <Navigate to="/character/magic" replace /> },
      { path: '/combat', element: <Navigate to="/character/sheet" replace /> },
      { path: '/bestiary', element: <BestiaryScreenRoute /> },
      { path: '/reference', element: <ReferenceScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
      { path: '/library', element: <CharacterLibraryScreen /> },
      { path: '*', element: <Navigate to="/character/sheet" replace /> },
    ],
  },
];
