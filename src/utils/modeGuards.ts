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
 * Every path the app asks about is declared in {@link FIELD_PATHS}. Ask with one
 * of those rather than an ad-hoc string, so the set of questions this guard can
 * be asked stays enumerable.
 */
const PLAY_MODE_EDITABLE_PREFIXES = [
  'armor.equipped',
  'helmet.equipped',
  // The end-of-session checklist records what *happened* — it earns marks, it
  // does not spend them. Ticking "participated in combat" is bookkeeping of the
  // session you are in, so it stays available without leaving play mode. The
  // advancement rolls themselves raise skills and are guarded by
  // `FIELD_PATHS.skills` like any other build change.
  'advancementChecks',
];

/**
 * The field paths the app actually guards.
 *
 * @remarks
 * These are *categories of field*, not individual fields. They used to be
 * written inline as `'attributes.str'` and `'resources.hp.max'` — strings that
 * look specific but mean "any attribute score" and "any resource's maximum".
 * Both named Dragonbane ids in shared, system-neutral code: STR is not an
 * attribute in Savage Worlds, and Traveller's damage tracks are str/dex/end,
 * so the guard read as though it were about one ruleset's fields when it is
 * about a whole category in every ruleset.
 *
 * Behaviour is unchanged — none of these were ever in
 * `PLAY_MODE_EDITABLE_PREFIXES`, so all of them lock in play mode, which is
 * what play mode is for. What changes is that the strings now say what they
 * mean, and `armorEquipped`/`helmetEquipped` are pinned to the exact literals
 * the allowlist matches instead of being retyped at each call site.
 */
export const FIELD_PATHS = {
  /** Name, kin/species, profession — the identity panel. */
  identity: 'identity',
  /** Any attribute or characteristic score. */
  attributes: 'attributes',
  /** Any resource's maximum. Current values are not gated here at all. */
  resourceMax: 'resources.max',
  /** Manual overrides of engine-derived stats. */
  derivedOverrides: 'derivedOverrides',
  /** Any skill's value or trained flag. */
  skills: 'skills',
  /** Equipping/unequipping body armour — editable during play. */
  armorEquipped: 'armor.equipped',
  /** Equipping/unequipping a helmet — editable during play. */
  helmetEquipped: 'helmet.equipped',
  /** The end-of-session advancement checklist — editable during play. */
  advancementChecks: 'advancementChecks',
} as const;

/** Every declared field path, for tests and exhaustiveness checks. */
export type FieldPath = (typeof FIELD_PATHS)[keyof typeof FIELD_PATHS];

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
