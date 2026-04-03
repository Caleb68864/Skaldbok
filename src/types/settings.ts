import type { Versioned } from './common';
import type { ID } from './common';

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
  theme: 'dark' | 'parchment' | 'light';
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
}
