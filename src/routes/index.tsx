import { Navigate } from 'react-router-dom';
import { AppLayout } from '../app/AppLayout';
import CharacterLibraryScreen from '../screens/CharacterLibraryScreen';
import SheetScreen from '../screens/SheetScreen';
import SkillsScreen from '../screens/SkillsScreen';
import GearScreen from '../screens/GearScreen';
import MagicScreen from '../screens/MagicScreen';
import CombatScreen from '../screens/CombatScreen';
import ReferenceScreen from '../screens/ReferenceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PrintableSheetScreen from '../screens/PrintableSheetScreen';
import type { RouteObject } from 'react-router-dom';

export const routes: RouteObject[] = [
  { path: '/print', element: <PrintableSheetScreen /> },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/library" replace /> },
      { path: '/library', element: <CharacterLibraryScreen /> },
      { path: '/sheet', element: <SheetScreen /> },
      { path: '/skills', element: <SkillsScreen /> },
      { path: '/gear', element: <GearScreen /> },
      { path: '/magic', element: <MagicScreen /> },
      { path: '/combat', element: <CombatScreen /> },
      { path: '/reference', element: <ReferenceScreen /> },
      { path: '/settings', element: <SettingsScreen /> },
      { path: '/profile', element: <ProfileScreen /> },
      { path: '*', element: <Navigate to="/library" replace /> },
    ],
  },
];
