import { Navigate } from 'react-router-dom';
import { ShellLayout } from '../components/shell/ShellLayout';
import { SessionScreen } from '../screens/SessionScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { MoreScreen } from '../screens/MoreScreen';
import SheetScreen from '../screens/SheetScreen';
import SkillsScreen from '../screens/SkillsScreen';
import GearScreen from '../screens/GearScreen';
import MagicScreen from '../screens/MagicScreen';
import CombatScreen from '../screens/CombatScreen';
import ReferenceScreen from '../screens/ReferenceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CharacterLibraryScreen from '../screens/CharacterLibraryScreen';
import PrintableSheetScreen from '../screens/PrintableSheetScreen';
import type { RouteObject } from 'react-router-dom';

export const routes: RouteObject[] = [
  { path: '/print', element: <PrintableSheetScreen /> },
  {
    element: <ShellLayout />,
    children: [
      { index: true, element: <Navigate to="/character/sheet" replace /> },
      { path: '/session', element: <SessionScreen /> },
      { path: '/notes', element: <NotesScreen /> },
      { path: '/more', element: <MoreScreen /> },
      {
        path: '/character',
        children: [
          { index: true, element: <Navigate to="/character/sheet" replace /> },
          { path: 'sheet', element: <SheetScreen /> },
          { path: 'skills', element: <SkillsScreen /> },
          { path: 'gear', element: <GearScreen /> },
          { path: 'magic', element: <MagicScreen /> },
          { path: 'combat', element: <CombatScreen /> },
        ],
      },
      // Legacy routes — redirect to new paths
      { path: '/sheet', element: <Navigate to="/character/sheet" replace /> },
      { path: '/skills', element: <Navigate to="/character/skills" replace /> },
      { path: '/gear', element: <Navigate to="/character/gear" replace /> },
      { path: '/magic', element: <Navigate to="/character/magic" replace /> },
      // Keep these under "more" accessible screens directly
      { path: '/combat', element: <Navigate to="/character/combat" replace /> },
      { path: '/reference', element: <ReferenceScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
      { path: '/library', element: <CharacterLibraryScreen /> },
      { path: '*', element: <Navigate to="/character/sheet" replace /> },
    ],
  },
];
