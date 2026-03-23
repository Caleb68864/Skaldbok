import type { ID, Timestamped, Versioned } from './common';

export interface CharacterMetadata {
  kin: string;
  profession: string;
  age: string;
  weakness: string;
  appearance: string;
  notes: string;
}

export interface CharacterSkill {
  value: number;
  trained: boolean;
  dragonMarked?: boolean;
}

export interface Weapon {
  id: ID;
  name: string;
  grip: 'one-handed' | 'two-handed';
  range: string;
  damage: string;
  durability: number;
  features: string;
  equipped: boolean;
  metal?: boolean;
}

export interface ArmorPiece {
  id: ID;
  name: string;
  rating: number;
  features: string;
  equipped: boolean;
  weight?: number;          // contributes to encumbrance
  bodyPart?: string;        // coverage area e.g. "Torso", "Full Body"
  movementPenalty?: number; // movement reduction
  metal?: boolean;
}

export interface InventoryItem {
  id: ID;
  name: string;
  weight: number;
  quantity: number;
  description: string;
}

export interface Spell {
  id: ID;
  name: string;
  school: string;
  powerLevel: number;
  wpCost: number;
  range: string;
  duration: string;
  summary: string;
  prepared?: boolean;
  rank?: number;
  requirements?: string[];
  castingTime?: 'action' | 'reaction' | 'ritual';
}

export interface HeroicAbility {
  id: ID;
  name: string;
  summary: string;
}

export type DerivedOverrides = Record<string, number | null>;

export interface CustomCard {
  id: string;
  title: string;
  body: string;
}

export interface CharacterUiState {
  expandedSections: string[];
  pinnedSkills?: string[];
  sheetCardOrder?: string[];
  sheetCustomCards?: CustomCard[];
  sheetPanelVisibility?: Record<string, boolean>;
}

export interface CharacterResource {
  current: number;
  max: number;
}

export interface CharacterRecord extends Versioned, Timestamped {
  id: ID;
  systemId: string;
  name: string;
  metadata: CharacterMetadata;
  attributes: Record<string, number>;
  conditions: Record<string, boolean>;
  resources: Record<string, CharacterResource>;
  skills: Record<string, CharacterSkill>;
  weapons: Weapon[];
  armor: ArmorPiece | null;
  helmet: ArmorPiece | null;
  inventory: InventoryItem[];
  tinyItems: string[];
  memento: string;
  coins: {
    gold: number;
    silver: number;
    copper: number;
  };
  spells: Spell[];
  heroicAbilities: HeroicAbility[];
  derivedOverrides: DerivedOverrides;
  uiState: CharacterUiState;
  portraitUri?: string;
  advancementChecks?: {
    combat?: boolean;
    explore?: boolean;
    weakness?: boolean;
    heroic?: boolean;
  };
}
