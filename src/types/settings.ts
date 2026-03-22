import type { Versioned } from './common';
import type { ID } from './common';

export type ModeName = 'play' | 'edit';

export interface AppSettings extends Versioned {
  id: string;
  activeCharacterId: ID | null;
  theme: 'dark' | 'parchment' | 'light';
  mode: ModeName;
  wakeLockEnabled: boolean;
}
