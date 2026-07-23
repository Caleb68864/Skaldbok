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

/**
 * Context passed to {@link SkillEngineConfig.display} so the engine can apply
 * system-specific modifiers without the shared screens knowing the rules.
 *
 * Traveller uses it to resolve the skill's linked-characteristic DM; the
 * classic-fantasy adapter ignores it entirely.
 */
export interface SkillDisplayContext {
  character: CharacterRecord;
  /** Attribute the skill is linked to, if any (e.g. `'end'` for Traveller). */
  linkedAttributeId?: string;
}

export interface SkillEngineConfig {
  valueLabel: string;
  range: { min: number; max: number };
  defaultValue: number;
  /**
   * Renders a skill's user-facing value string. `context` is optional so
   * engines that need no character state (classic-fantasy) can ignore it.
   */
  display: (value: number, context?: SkillDisplayContext) => string;
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
