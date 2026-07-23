import type { CharacterRecord, CharacterSkill } from '../../../types/character';
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
  /** Clamp applied to the skill's editable value input. */
  range: { min: number; max: number };
  /**
   * Ceiling an end-of-session advancement roll may raise a skill to.
   *
   * @remarks
   * Distinct from {@link range}: Dragonbane accepts values up to 20 on the
   * sheet but advancement stops at 18, so reusing `range.max` here would
   * silently raise the ceiling.
   */
  advancementMax: number;
  defaultValue: number;
  /**
   * Renders a skill's user-facing value string. `context` is optional so
   * engines that need no character state (classic-fantasy) can ignore it.
   */
  display: (value: number, context?: SkillDisplayContext) => string;
  supportsMarks: boolean;
  supportsBoonBane: boolean;
  /**
   * Whether a skill counts as "relevant" for the filtered skill view.
   *
   * @remarks
   * Replaces the hardcoded `value > 0 || trained` predicate, which encodes the
   * roll-under assumption that 0 means untrained.
   */
  isRelevant: (skill: CharacterSkill | undefined) => boolean;
}

/**
 * System-specific vocabulary. Every user-facing noun that differs between
 * rulesets lives here rather than as a string literal in a shared component.
 *
 * @remarks
 * Overridable per-system from `SystemDefinition.terms` so a user-authored
 * system can rename these without a code change.
 */
export interface SystemTerms {
  /** Collective noun for special abilities — "Heroic Abilities", "Talents", "Feats". */
  abilities: string;
  /** Collective noun for the spell list — "Spells", "Psionic Powers", "Disciplines". */
  spells: string;
  /** Resource spent to cast/activate — "WP", "PSI", "Mana". */
  magicResource: string;
  /** Primary health resource shown to the user — "HP", "END". */
  healthResource: string;
  /** Fallback shown when a character has no profession/role set. */
  roleFallback: string;
}

/**
 * System-specific panel and screen titles.
 *
 * @remarks
 * A `null` value means "this system has no such screen" — consumers hide the
 * corresponding tab/route rather than rendering a dead end. Overridable from
 * `SystemDefinition.labels`.
 */
export interface SystemLabels {
  /** Sub-nav tab + screen title for the abilities/magic screen; `null` hides it. */
  abilitiesScreen: string | null;
  /** Title of the resources panel — "Resources" vs "Damage Track". */
  resourcesPanel: string;
  /** Title of the attributes panel — "Attributes" vs "Characteristics". */
  attributesPanel: string;
  /** Title of the encumbrance panel. */
  encumbrance: string;
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
  /** System vocabulary; see {@link SystemTerms}. */
  terms: SystemTerms;
  /** Panel/screen titles; see {@link SystemLabels}. */
  labels: SystemLabels;
  /**
   * Resource that generic damage/healing applies to, or `null` when the system
   * has no single health pool (consumers must then defer to the system's own UI).
   */
  primaryHealthResourceId: string | null;
}
