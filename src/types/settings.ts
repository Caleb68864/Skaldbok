import type { Versioned } from './common';
import type { ID } from './common';

export type ModeName = 'play' | 'edit';

export type BoonBaneState = 'boon' | 'none' | 'bane';

export interface SessionState {
  globalBoonBane: BoonBaneState;
  skillOverrides: Record<string, 'boon' | 'bane' | undefined>;
}

export interface AppSettings extends Versioned {
  id: string;
  activeCharacterId: ID | null;
  theme: 'dark' | 'parchment' | 'light';
  mode: ModeName;
  wakeLockEnabled: boolean;
  /** Visibility map for bottom nav tabs; keyed by lowercase label (e.g. "sheet", "profile"). */
  bottomNavTabs?: Record<string, boolean>;
}
