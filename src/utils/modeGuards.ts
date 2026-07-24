import { useAppState } from '../context/AppStateContext';

/**
 * Field paths that stay editable while the app is in play mode.
 *
 * @remarks
 * Play mode locks the sheet down to the handful of fields that change at the
 * table — current HP/WP, the death-roll tracks, conditions, weapons, and armour
 * equip toggles — so a tap during a session cannot accidentally rewrite a
 * character's build. A trailing `.` marks a wildcard prefix (any field beneath
 * it, plus the bare parent path). Edit mode ignores this list entirely.
 */
const PLAY_MODE_EDITABLE_PREFIXES = [
  'resources.hp.current',
  'resources.wp.current',
  'resources.deathRolls.current',
  'resources.deathSuccesses.current',
  'conditions.',
  'weapons.',
  'armor.equipped',
  'helmet.equipped',
];

/** Whether a dotted field path is one of the {@link PLAY_MODE_EDITABLE_PREFIXES} allowed during play. */
export function isFieldEditableInPlayMode(fieldPath: string): boolean {
  return PLAY_MODE_EDITABLE_PREFIXES.some(prefix => {
    if (prefix.endsWith('.')) {
      // wildcard: match any field starting with this prefix
      return fieldPath.startsWith(prefix) || fieldPath === prefix.slice(0, -1);
    }
    return fieldPath === prefix || fieldPath.startsWith(prefix + '.');
  });
}

/**
 * Reactive guard for a single field: always editable in edit mode, otherwise
 * only when the path is play-mode editable.
 */
export function useFieldEditable(fieldPath: string): boolean {
  const { settings } = useAppState();
  if (settings.mode === 'edit') return true;
  return isFieldEditableInPlayMode(fieldPath);
}

/** True when the app is in edit mode rather than play mode. */
export function useIsEditMode(): boolean {
  const { settings } = useAppState();
  return settings.mode === 'edit';
}
