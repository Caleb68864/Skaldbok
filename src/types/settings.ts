import type { TagPresetGroup } from '../config/defaults/tagPresets';
import type { InventoryContainerKindConfig } from '../config/defaults/inventoryContainerKinds';
import type { Versioned } from './common';
import type { ID } from './common';
import type { ThemeName } from '../theme/themes';

/**
 * The application interaction mode.
 *
 * - `'play'`  — fields are locked for play; only resource trackers and dice are interactive.
 * - `'edit'`  — all character fields are editable.
 */
export type ModeName = 'play' | 'edit';

/**
 * The global or per-skill boon/bane modifier state.
 *
 * - `'boon'` — roll two dice and take the lower result.
 * - `'none'` — roll one die normally.
 * - `'bane'` — roll two dice and take the higher result.
 */
export type BoonBaneState = 'boon' | 'none' | 'bane';

/**
 * Transient per-session state for the dice roller and skill overrides.
 *
 * @remarks
 * This state is held in memory only and is not persisted to IndexedDB.
 * It resets when the app is closed or refreshed.
 */
export interface SessionState {
  /** The global boon/bane modifier applied to all skill rolls unless overridden. */
  globalBoonBane: BoonBaneState;
  /**
   * Per-skill boon/bane overrides that take precedence over {@link globalBoonBane}.
   * Keyed by skill ID; `undefined` means "inherit from global".
   */
  skillOverrides: Record<string, 'boon' | 'bane' | undefined>;
  /**
   * Per-skill characteristic swaps for the situation at hand. Keyed by skill
   * ID; `undefined` means "use the skill's declared linked attribute".
   *
   * @remarks
   * Each skill declares one linked attribute, but the rules routinely allow a
   * different one for the circumstance — Persuade with INT rather than SOC when
   * you are reasoning rather than charming, Athletics with STR, DEX or END
   * depending on the feat. Without this the displayed DM and odds are simply
   * wrong for those rolls.
   *
   * Session-scoped, exactly like {@link skillOverrides}, because it describes
   * one moment at the table and not a fact about the character. Persisting it
   * would quietly change every future roll of that skill.
   */
  skillAttributeOverrides: Record<string, string | undefined>;
  /**
   * The task target every displayed probability is computed against.
   * `undefined` = the system's own default.
   *
   * @remarks
   * Session-scoped, like the boon/bane state: the GM calls a difficulty for
   * *this* task, not for the character. Every skill's odds move together, which
   * is the point — "what are my chances if this is Difficult?" is a question
   * about the whole sheet at once.
   */
  rollTarget: number | undefined;
}

/**
 * Persisted application-wide settings stored in IndexedDB.
 *
 * @remarks
 * There is a single settings record in the database (id `"app"`).
 * All optional fields were added in later schema versions and may be absent
 * in records created by older app versions.
 */
export interface AppSettings extends Versioned {
  /** Settings record ID; always `"app"`. */
  id: string;
  /** ID of the currently active character, or `null` if none is selected. */
  activeCharacterId: ID | null;
  /** Active UI colour theme. */
  theme: ThemeName;
  /** Current interaction mode controlling field editability. */
  mode: ModeName;
  /** If `true`, the Screen Wake Lock API is requested to keep the display on during play. */
  wakeLockEnabled: boolean;
  /** Visibility map for bottom nav tabs; keyed by lowercase label (e.g. `"sheet"`, `"profile"`). */
  bottomNavTabs?: Record<string, boolean>;
  /** Panel display order for the Sheet page; array of panel ID strings. */
  sheetPanelOrder?: string[];
  /** Per-campaign preference for showing notes from other sessions in Notes Grid. Keyed by `campaignId`. */
  showOtherSessionNotes?: Record<string, boolean>;
  /** Per-campaign custom tags created by the user. Keyed by `campaignId`; value is an array of tag strings. */
  customTags?: Record<string, string[]>;
  /**
   * Preset tag palette shown by the tag picker, overriding
   * `DEFAULT_TAG_PRESETS`. Read via `useTagPresets()`, never imported directly
   * by a component — see CLAUDE.md's Configuration Over Hardcoding rule.
   */
  tagPresets?: TagPresetGroup[];
  /**
   * Carrier kinds offered for party inventory containers, overriding
   * `DEFAULT_INVENTORY_CONTAINER_KINDS`. Read via
   * `useInventoryContainerKinds()`.
   */
  inventoryContainerKinds?: InventoryContainerKindConfig[];
  /**
   * If `true`, the `Abilities / Magic` character screen shows both Spells and
   * Heroic Abilities. If `false` (or absent), only Heroic Abilities render —
   * Spells stay hidden. Defaults to `false` so non-caster characters see a
   * focused screen. Users toggle it per-app via the checkbox on that screen.
   */
  showCharacterMagic?: boolean;
  /**
   * If `true` (default), the floating session-log button is shown in the app
   * shell. Set to `false` to hide it for a cleaner character-sheet-only
   * experience; the log stays reachable from More → Session Log, so turning
   * this off never strands the user.
   */
  showGlobalFAB?: boolean;
  /**
   * Per-campaign dismissed link-suggestion keys (see
   * the `key` field of {@link features/notes/linkScanner!LinkScanSuggestion | LinkScanSuggestion}).
   * Keyed by `campaignId`; value is an array of dismissed suggestion keys.
   *
   * @remarks
   * Older records may still carry this field as a flat `string[]` (dismissals
   * were global before per-campaign scoping was added). Readers must handle
   * that legacy shape defensively rather than assume the `Record` shape.
   */
  dismissedLinkSuggestions?: Record<string, string[]> | string[];
  /**
   * ISO timestamp of the last completed **campaign** export.
   *
   * @remarks
   * Deliberately only campaign exports. A note or session export is sharing, not
   * redundancy — recording one here would report the campaign as backed up when
   * nothing that could restore it exists, which is worse than tracking nothing.
   */
  lastBackupAt?: string;
  /**
   * Days a campaign may go un-exported before the app warns. Overrides
   * `DEFAULT_BACKUP_REMINDER_DAYS`; read via `useBackupReminderDays()`.
   */
  backupReminderDays?: number;
}
