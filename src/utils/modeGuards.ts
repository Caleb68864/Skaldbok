import { useAppState } from '../context/AppStateContext';

const PLAY_MODE_EDITABLE_PREFIXES = [
  'resources.hp.current',
  'resources.wp.current',
  'resources.deathRolls.current',
  'conditions.',
  'weapons.',
  'armor.equipped',
  'helmet.equipped',
];

export function isFieldEditableInPlayMode(fieldPath: string): boolean {
  return PLAY_MODE_EDITABLE_PREFIXES.some(prefix => {
    if (prefix.endsWith('.')) {
      // wildcard: match any field starting with this prefix
      return fieldPath.startsWith(prefix) || fieldPath === prefix.slice(0, -1);
    }
    return fieldPath === prefix || fieldPath.startsWith(prefix + '.');
  });
}

export function useFieldEditable(fieldPath: string): boolean {
  const { settings } = useAppState();
  if (settings.mode === 'edit') return true;
  return isFieldEditableInPlayMode(fieldPath);
}
