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

/** One denomination in a system's currency. */
export interface CurrencyDenomination {
  id: string;
  label: string;
  /** Short suffix used in logs and dense UI, e.g. `g` or `Cr`. */
  abbr: string;
  /** Worth in the smallest denomination, used for change-making and totals. */
  value: number;
  /**
   * How much one press of a +/− control moves this denomination. Defaults to 1.
   *
   * @remarks
   * Scale is a per-system property, not a UI one. Dragonbane prices sit in
   * single coins, so 1 is right; Traveller prices run to thousands of credits,
   * where a step of 1 means ~800 presses to buy a vacc suit. Screens read this
   * rather than assuming a unit step.
   */
  step?: number;
}

/**
 * A system's money, including where it lives on the character record.
 *
 * @remarks
 * `read`/`write` keep storage an engine concern: Dragonbane persists to
 * `character.coins`, Traveller to its system-specific bag. Consumers deal only
 * in `{ denominationId: amount }`, so unifying the underlying fields later is a
 * change to two engines rather than to every screen that shows money.
 */
export interface CurrencyModel {
  mode: CurrencyMode;
  denominations: CurrencyDenomination[];
  /** Current amounts, keyed by denomination id. */
  read: (character: CharacterRecord) => Record<string, number>;
  /** Patch to apply for new amounts, keyed by denomination id. */
  write: (character: CharacterRecord, amounts: Record<string, number>) => Partial<CharacterRecord>;
}

/** A possible result of a resolution roll (crit/fumble vocabulary differs per system). */
export interface OutcomeOption {
  id: string;
  label: string;
  tone?: 'success' | 'failure' | 'critical' | 'fumble';
}

/** A modifier a player can flag on a roll, e.g. Boon/Bane/Pushed. */
export interface RollModifierOption {
  id: string;
  label: string;
}

/** A duration unit for temporary modifiers and travel/camp actions. */
export interface TimeUnit {
  id: string;
  label: string;
  /** Compact form for chips, e.g. `RND`. */
  abbrev: string;
}

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
  /**
   * Resolved advantage state for this skill, so the formatted string reflects
   * the odds the player actually faces.
   */
  boonBane?: 'boon' | 'none' | 'bane';
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
  /**
   * The value a skill takes when the character has no stored entry.
   *
   * @remarks
   * Replaces the roll-under `trained ? base * 2 : base` formula that screens
   * reimplemented three times over.
   */
  computeValue: (
    skill: { baseChance: number; linkedAttributeId?: string },
    character: CharacterRecord,
    trained: boolean,
  ) => number;
  /**
   * Whether toggling "trained" recomputes the skill's value.
   *
   * @remarks
   * True for roll-under systems, where training doubles the base chance. False
   * where the stored value is authored directly (Traveller levels) — there,
   * recomputing on toggle would discard the player's number.
   */
  trainedAffectsValue: boolean;
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
  /**
   * Label for a combat participant's health field — "Current HP" vs
   * "Current END". Traveller has no hit points, so a generic "HP" is wrong on
   * the encounter screen even though the field itself is system-neutral.
   */
  participantHealth: string;
  /** Placeholder listing example conditions, e.g. `poisoned, prone`. */
  conditionExamples: string;
  /** Placeholder listing example encounter tags, e.g. `ambush, forest, kobolds`. */
  encounterTagExamples: string;
  /** Placeholder for an example location name, e.g. `Riverside Clearing`. */
  locationExample: string;
  /**
   * Header for the armour features column on the printed sheet.
   * Dragonbane armour imposes a bane on some skills; Traveller's does not.
   */
  armorFeatures: string;
}

/**
 * How incoming damage flows across a system's health resources.
 *
 * @remarks
 * `null` on the engine means the system has no cascading track — damage lands
 * on one pool and stops, which is Dragonbane. Traveller applies damage to END
 * first and spills the remainder into a chosen physical characteristic, and a
 * character with enough depleted tracks is out of the fight. Encoding that here
 * keeps the rule in one testable place instead of in a damage widget.
 */
export interface DamageTrackModel {
  /** Resource ids that absorb damage, in the order they are filled. */
  order: string[];
  /**
   * Resource ids the remainder may spill into once `order` is exhausted, if
   * any. The player picks which, since the choice is theirs to make.
   */
  overflowTo: string[];
  /** How many fully-depleted resources leave the character out of the fight. */
  downAtDepleted: number;
  /** How many fully-depleted resources are fatal, or `null` if none are. */
  deadAtDepleted: number | null;
  /** Banner text when `downAtDepleted` is reached. */
  downLabel: string;
  /** Banner text when `deadAtDepleted` is reached. */
  deadLabel: string;
}

/** Outcome of applying damage through a {@link DamageTrackModel}. */
export interface DamageApplication {
  /** New `current` values, keyed by resource id. */
  resources: Record<string, number>;
  /** Per-resource damage actually dealt, for reporting back to the player. */
  dealt: Record<string, number>;
  /** Damage that could not be placed because every track was full. */
  unassigned: number;
  /** Resource ids now fully depleted. */
  depleted: string[];
  status: 'ok' | 'down' | 'dead';
}

/**
 * One entry in the encounter quick-log palette.
 *
 * @remarks
 * `id` is persisted on the logged event, so it must stay stable; only `label`
 * is shown. This is why the palette cannot simply be a list of display strings
 * — renaming "spell" to "power" must not orphan already-logged events.
 */
export interface LogAction {
  id: string;
  label: string;
}

/** One input the rest modal collects before applying a rest. */
export interface RestPromptField {
  id: string;
  label: string;
}

/** Modal prompt shown before a rest is applied; omit for rests that apply immediately. */
export interface RestPrompt {
  /** Explanatory copy at the top of the modal. */
  text: string;
  /** Die size the player rolls, e.g. `6` for d6. Drives input bounds and labels. */
  die: number;
  fields: RestPromptField[];
  /** Whether the rest may additionally clear one active condition. */
  clearOneCondition?: boolean;
}

/** What a rest did, in system-neutral terms. */
export interface RestOutcome {
  /** Resource id → new `current` value. */
  resources: Record<string, number>;
  /** Condition ids cleared by the rest. */
  conditionsCleared: string[];
  /** User-facing sentences describing what happened. */
  messages: string[];
  /**
   * True when the rest changed nothing (e.g. already at full).
   *
   * @remarks
   * Lets consumers show an informational toast and skip the write instead of
   * reporting success and bumping `updatedAt` for a no-op.
   */
  noop?: boolean;
}

/**
 * A rest/recovery action a system offers.
 *
 * @remarks
 * `id` doubles as the {@link TempModifier} duration key, so a modifier lasting
 * "until the next round rest" expires when the rest with `id: 'round'` runs.
 */
export interface RestDefinition {
  id: string;
  label: string;
  prompt?: RestPrompt;
  /**
   * Whether taking this rest resets the "rests used" tracker.
   *
   * @remarks
   * Dragonbane's shift rest ends the day, so it clears the round/stretch marks.
   * Declaring it here avoids consumers inferring it from list position.
   */
  clearsRestTracker?: boolean;
  apply: (
    character: CharacterRecord,
    rolls: Record<string, number>,
    conditionToClear?: string,
  ) => RestOutcome;
}

/** A death/dying track (e.g. Dragonbane's three failures and three successes). */
export interface DeathTrack {
  id: string;
  label: string;
  max: number;
  tone: 'danger' | 'success';
}

/** How a system models a downed/dying character. `null` when it has no such rules. */
export interface DeathModel {
  /** Resource whose depletion puts the character down. */
  triggerResourceId: string;
  /** Character is down when that resource is at or below this value. */
  triggerAtOrBelow: number;
  downLabel: string;
  deadLabel: string;
  stabilizedLabel: string;
  tracks: DeathTrack[];
}

/** End-of-session advancement rules. `null` when the system has no such procedure. */
export interface AdvancementModel {
  /** Checkboxes offered on the session checklist. */
  sessionEvents: Array<{ id: string; label: string }>;
  /** Whether advancement is driven by per-skill marks. */
  usesMarks: boolean;
  /** Ceiling an advancement roll may raise a skill to. */
  maxSkillValue: number;
  /** Copy describing the roll a player makes for a skill at `value`. */
  rollPrompt: (value: number) => string;
}

/** Success-chance maths for a system's resolution mechanic. */
export interface ProbabilityModel {
  /** Chance of success at `value` under the given boon/bane state, as 0–1. */
  chance: (value: number, state: 'boon' | 'none' | 'bane', context?: SkillDisplayContext) => number;
}

/** Where a derived stat is surfaced. Different screens show different subsets. */
export type DerivedSurface = 'sheet' | 'dashboard' | 'print';

/** A stat a temporary modifier can target, grouped for the picker. */
export interface ModifiableStat {
  /** Namespaced stat key, e.g. `attr:str` — see `utils/statKeys`. */
  id: string;
  label: string;
  /** Heading the option is listed under. */
  group: string;
}

/** A derived stat a system surfaces, and how to label it. */
export interface DerivedFieldDef {
  key: string;
  label: string;
  /** Short form for dense layouts like the play dashboard. */
  shortLabel?: string;
  /** Whether the user may manually override this value on the sheet. */
  overridable?: boolean;
  /**
   * Screens this field appears on. Omitted means "all".
   *
   * @remarks
   * The three surfaces genuinely differ — encumbrance belongs on the gear and
   * print sheets but not the character sheet's derived panel, and HP/WP maxima
   * are already shown by the dashboard's vitals module.
   */
  surfaces?: DerivedSurface[];
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
  currency: CurrencyModel;
  /** Possible results of a resolution roll. */
  outcomes: OutcomeOption[];
  /** Modifiers a player can flag on a roll. */
  rollModifiers: RollModifierOption[];
  /** Duration units for temporary modifiers and elapsed-time actions. */
  timeUnits: TimeUnit[];
  /** System vocabulary; see {@link SystemTerms}. */
  terms: SystemTerms;
  /** Panel/screen titles; see {@link SystemLabels}. */
  labels: SystemLabels;
  /**
   * Quick-log actions offered during an encounter.
   *
   * @remarks
   * Dragonbane logs spells; Traveller has none and logs psionics instead. A
   * hardcoded palette leaks one system's vocabulary into every other.
   */
  logActions: LogAction[];
  /**
   * How damage cascades across health resources, or `null` when it does not.
   * See {@link DamageTrackModel}.
   */
  damageTrack: DamageTrackModel | null;
  /**
   * Resource that generic damage/healing applies to, or `null` when the system
   * has no single health pool (consumers must then defer to the system's own UI).
   */
  primaryHealthResourceId: string | null;
  /** Rest/recovery actions, or `null` when the system has none. */
  rest: RestDefinition[] | null;
  /** Downed/dying rules, or `null` when the system has none. */
  death: DeathModel | null;
  /** End-of-session advancement, or `null` when the system has none. */
  advancement: AdvancementModel | null;
  /** Success-chance maths for this system's resolution mechanic. */
  probability: ProbabilityModel;
  /** Derived stats this system surfaces, with their labels. */
  derivedFields: DerivedFieldDef[];
  /**
   * Stats a temporary modifier may target, for the "add modifier" picker.
   *
   * @remarks
   * Takes the system definition so labels can come from its own attribute and
   * resource names rather than being restated in the engine.
   */
  modifiableStats: (system?: SystemDefinition) => ModifiableStat[];
}
