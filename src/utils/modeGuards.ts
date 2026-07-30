import { useAppState } from '../context/AppStateContext';

/**
 * Field paths that stay editable while the app is in play mode.
 *
 * @remarks
 * Play mode locks the sheet down so a tap during a session cannot rewrite a
 * character's build. A trailing `.` marks a wildcard prefix (any field beneath
 * it, plus the bare parent path). Edit mode ignores this list entirely.
 *
 * **This list only matters for paths something actually asks about.** It used to
 * carry six more entries — `resources.hp.current`, `resources.wp.current`,
 * `resources.deathRolls.current`, `resources.deathSuccesses.current`,
 * `conditions.` and `weapons.` — with no call site between them. They read as
 * policy while deciding nothing, and they hardcoded Dragonbane resource ids
 * against the engine rule. Removing them is behaviour-neutral by definition: an
 * entry nothing queries cannot change an outcome.
 *
 * The live surfaces (current HP, conditions, weapons) are not gated through this
 * guard at all — they are always editable, which is what play mode wants. If a
 * surface ever *should* be gated, add the path here **and** the
 * `useFieldEditable` call that asks about it; the entry alone does nothing.
 *
 * Known gap: `SheetScreen` guards every system's resource maxima with the
 * literal path `resources.hp.max`, so Traveller's str/dex/end damage tracks are
 * unrepresented. That is correct by accident — maxima are locked everywhere in
 * play mode — but it is a Dragonbane id standing in for a general rule.
 */
const PLAY_MODE_EDITABLE_PREFIXES = [
  'armor.equipped',
  'helmet.equipped',
];

/** Whether a dotted field path is one of the `PLAY_MODE_EDITABLE_PREFIXES` allowed during play. */
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
