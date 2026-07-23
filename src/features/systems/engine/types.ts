import type { CharacterRecord } from '../../../types/character';
import type { SystemDefinition } from '../../../types/system';
import type { DerivedValues } from '../../../utils/derivedValues';

export type PanelKey =
  | 'attributes'
  | 'skills'
  | 'resources'
  | 'inventory'
  | 'magic'
  | 'combat'
  | 'rest'
  | 'death'
  | 'notes'
  | 'characteristics'
  | 'finances'
  | 'careers'
  | 'augments';

export type ResolutionMethod = 'd20-roll-under' | '2d6-plus';

export type CurrencyMode = 'coins' | 'abstract' | 'single';

export interface SkillEngineConfig {
  valueLabel: string;
  range: { min: number; max: number };
  defaultValue: number;
  display: (value: number) => string;
  supportsMarks: boolean;
  supportsBoonBane: boolean;
}

export interface SystemEngine {
  resolution: ResolutionMethod;
  hasMagic: boolean;
  attributeBadge: (attributeId: string, character: CharacterRecord) => string | null;
  attributeIds: string[];
  skill: SkillEngineConfig;
  derivedStats: (character: CharacterRecord, system?: SystemDefinition) => DerivedValues;
  resourceIds: string[];
  panels: PanelKey[];
  currency: CurrencyMode;
}
