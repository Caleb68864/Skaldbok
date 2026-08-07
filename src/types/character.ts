import type { ID, Timestamped, Versioned } from './common';

/**
 * Biographical and flavour metadata for a character.
 *
 * @remarks
 * All fields are plain strings so they can be freely edited in the identity
 * panel without imposing validation constraints on the user.
 */
export type CharacterMetadata = Record<string, string>;

/**
 * Identity field ids the bundled systems use.
 *
 * @remarks
 * `metadata` is an open string map so each ruleset can declare its own identity
 * fields via `SystemDefinition.identityFields` — Dragonbane wants Kin and
 * Weakness, a sci-fi setting wants Species and Homeworld. These constants exist
 * only so code that genuinely depends on a specific field (Dragonbane's
 * weakness advancement track) can refer to it without a bare string literal.
 */
export const METADATA_KEYS = {
  kin: 'kin',
  profession: 'profession',
  age: 'age',
  weakness: 'weakness',
  appearance: 'appearance',
  notes: 'notes',
} as const;

/**
 * A single skill entry on the character sheet.
 *
 * @remarks
 * `value` stores the current roll-under target (1–20 for standard skills).
 * Dragon and demon marks are toggled during play to track advancement and
 * corruption respectively.
 */
export interface CharacterSkill {
  /** Current roll-under target value for the skill (0–20). */
  value: number;
  /** Whether the character has trained this skill (doubles base chance / links to attribute). */
  trained: boolean;
  /** If `true`, the skill has been dragon-marked after a successful roll this session. */
  dragonMarked?: boolean;
  /** If `true`, the skill has been demon-marked (corruption/advancement variant). */
  demonMarked?: boolean;
}

/**
 * A weapon carried by the character.
 */
export interface Weapon {
  /** Unique identifier for the weapon entry. */
  id: ID;
  /** Display name of the weapon. */
  name: string;
  /** Whether the weapon requires one or two hands to wield. */
  grip: 'one-handed' | 'two-handed';
  /** Effective range string, e.g. "Arm's Reach", "Short", "Long". */
  range: string;
  /** Damage dice expression, e.g. "2D6", "D8". */
  damage: string;
  /** Durability rating; reaching 0 means the weapon breaks. */
  durability: number;
  /** Special features or traits text, e.g. "Edged, Parrying". */
  features: string;
  /** Whether the weapon is currently equipped / ready to use. */
  equipped: boolean;
  /** If `true`, the weapon is made of metal (relevant for some magic interactions). */
  metal?: boolean;
  /** Damage type used for armour penetration or special condition rules. */
  damageType?: 'bludgeoning' | 'slashing' | 'piercing' | null;
  /** Minimum STR attribute required to wield without penalty, if any. */
  strRequirement?: number | null;
  /** If `true`, the weapon has been damaged and must be repaired before use. */
  damaged?: boolean;
  /** If `true`, this entry represents a shield rather than an offensive weapon. */
  isShield?: boolean;
  /**
   * Values for the extra fields the active system declares in
   * `SystemDefinition.itemFields.weapon`, keyed by field id.
   */
  systemFields?: Record<string, unknown>;
}

/**
 * A piece of armour or a helmet worn by the character.
 *
 * @remarks
 * Both `armor` and `helmet` on {@link CharacterRecord} use this type.
 */
export interface ArmorPiece {
  /** Unique identifier for the armour entry. */
  id: ID;
  /** Display name of the armour piece. */
  name: string;
  /** Protection / armour rating; subtracted from incoming damage. */
  rating: number;
  /** Special features or traits text. */
  features: string;
  /** Whether the armour is currently equipped. */
  equipped: boolean;
  /** Weight that contributes toward the encumbrance limit. */
  weight?: number;
  /** Body area covered, e.g. "Torso", "Full Body". */
  bodyPart?: string;
  /** Movement speed reduction imposed while wearing this piece. */
  movementPenalty?: number;
  /** If `true`, the armour is made of metal. */
  metal?: boolean;
  /**
   * Values for the extra fields the active system declares in
   * `SystemDefinition.itemFields.armor`, keyed by field id.
   */
  systemFields?: Record<string, unknown>;
}

/**
 * An item in the character's general inventory.
 *
 * @remarks
 * Weight is counted toward encumbrance.
 */
export interface InventoryItem {
  /** Unique identifier for the inventory entry. */
  id: ID;
  /** Display name of the item. */
  name: string;
  /** Weight units that count toward encumbrance. */
  weight: number;
  /** Number of this item carried. */
  quantity: number;
  /** Free-text description or notes about the item. */
  description: string;
  /**
   * If `true`, the item is a "tiny" item — its weight is ignored for
   * encumbrance regardless of the stored {@link weight} value.
   */
  tiny?: boolean;
  /**
   * If `true`, the item is consumable — the inventory list shows inline
   * quantity +/- controls in play mode so rations, torches, arrows, etc.
   * can be adjusted without entering edit mode.
   */
  consumable?: boolean;
  /**
   * Extra weight units this item adds to the carrier's encumbrance limit
   * while carried (e.g. a backpack adding +5). Multiplied by quantity, so
   * two backpacks grant double the bonus.
   */
  capacityBonus?: number;
}

/**
 * A special capability a character has: a spell, a heroic ability, a talent, a
 * psionic power — whatever the active ruleset calls them.
 *
 * @remarks
 * This is the canonical storage shape. Only the genuinely shared fields are
 * first-class; everything ruleset-specific (a spell's school and power level, a
 * heroic ability's skill prerequisite) lives in `systemFields`, described by
 * `SystemDefinition.abilityTypes`.
 *
 * Dragonbane screens do not read this directly — they go through the typed
 * projections in `utils/abilities`, which present the familiar {@link Spell}
 * and {@link HeroicAbility} views over it.
 */
export interface Ability {
  id: ID;
  /** Which of the system's ability types this is, e.g. `spell` or `heroic`. */
  type: string;
  name: string;
  summary: string;
  /**
   * Cost to use, keyed by resource id — `{ wp: 2 }` rather than a `wpCost`
   * field that names one system's resource.
   */
  cost?: Record<string, number>;
  /** Readied for use, for systems with a preparation step. */
  prepared?: boolean;
  /**
   * Surfaced regardless of preparation. Read by the Play Dashboard's magic
   * list, but only for `type: 'spell'` rows — nothing consults it for
   * heroic-typed abilities (see {@link HeroicAbility.pinnedAsStamp}).
   */
  pinnedAsStamp?: boolean;
  /** Effect templates applied when the ability is used. */
  effects?: SpellEffect[];
  /** Values for the fields this ability type declares. */
  systemFields?: Record<string, unknown>;
}

/**
 * A spell known by the character.
 *
 * @remarks
 * A Dragonbane-shaped *view* over {@link Ability}; see `utils/abilities`.
 */
export interface Spell {
  /** Unique identifier for this spell entry. */
  id: ID;
  /** Display name of the spell. */
  name: string;
  /** Magical school the spell belongs to, e.g. "Animism", "Elementalism". */
  school: string;
  /** Power level / rank of the spell. */
  powerLevel: number;
  /** Willpower cost to cast the spell. */
  wpCost: number;
  /** Range string, e.g. "Self", "Near", "Far". */
  range: string;
  /** Duration string, e.g. "Immediate", "Round", "Stretch". */
  duration: string;
  /** Short rules summary of the spell's effect. */
  summary: string;
  /** If `true`, this spell is in the active prepared-spells slot. */
  prepared?: boolean;
  /** Advancement rank for the spell (school-specific). */
  rank?: number;
  /** List of prerequisite spell IDs or conditions. */
  requirements?: string[];
  /** When the spell can be cast. */
  castingTime?: 'action' | 'reaction' | 'ritual';
  /** Optional effect templates for auto-creating temp modifiers on cast. */
  effects?: SpellEffect[];
  /** Short descriptions of what each power level does, indexed 0=PL1, 1=PL2, 2=PL3. */
  powerScaling?: [string, string, string];
  /**
   * If `true`, this spell shows in the Play Dashboard's magic list even when
   * it is not currently `prepared` ({@link features/playDashboard/MagicModule!MagicModule | MagicModule}).
   * Useful for rituals or utility spells the player casts often but doesn't
   * want taking a prepared slot.
   */
  pinnedAsStamp?: boolean;
}

/**
 * A heroic ability unlocked by the character.
 *
 * @remarks
 * Heroic abilities are powerful special actions that typically cost WP and
 * require meeting a skill-level prerequisite.
 */
export interface HeroicAbility {
  /** Unique identifier for this heroic ability entry. */
  id: ID;
  /** Display name of the ability. */
  name: string;
  /** Short description of what the ability does. */
  summary: string;
  /** Optional WP cost to activate the ability. */
  wpCost?: number;
  /** Free-text prerequisite description. */
  requirement?: string | null;
  /** Skill ID that must meet {@link requirementSkillLevel} to unlock this ability. */
  requirementSkillId?: string | null;
  /** Minimum skill value required for {@link requirementSkillId}. */
  requirementSkillLevel?: number | null;
  /**
   * Currently read by nothing. The PC tray this pinned an ability into was
   * removed with the quick-action surface, and the Play Dashboard's magic
   * list only consults `pinnedAsStamp` for spells. Kept because it is
   * persisted on existing characters — dropping it needs a migration, not an
   * edit — but treat it as inert until a surface claims it.
   */
  pinnedAsStamp?: boolean;
}

/** Flat stat key namespace resolved by getEffectiveValue(). */
export type StatKey =
  | 'str' | 'con' | 'agl' | 'int' | 'wil' | 'cha'
  | 'armor' | 'helmet'
  | 'movement' | 'hpMax' | 'wpMax'
  | string;

/** A single stat effect within a temp modifier. */
export interface TempModifierEffect {
  stat: StatKey;
  delta: number;
}

/** A temporary stat modifier overlaid on the character's base values. */
export interface TempModifier {
  id: string;
  label: string;
  effects: TempModifierEffect[];
  /**
   * Id of a {@link features/systems/engine/types!TimeUnit | TimeUnit} from the
   * active system's `timeUnits`.
   *
   * @remarks
   * Deliberately `string`, not a closed union. It was
   * `'round' | 'stretch' | 'shift' | 'scene' | 'permanent'` — Dragonbane's
   * units — while the producer (`engine.timeUnits`) is engine data. Every
   * consumer therefore needed an `as Duration` cast, which suppressed the one
   * place the compiler could have objected, and a Savage Worlds buff stored a
   * `'stretch'` that its own engine cannot resolve. A closed union that is
   * always cast into is worse than a `string`: it gives false assurance while
   * asserting nothing. `engineContract.test.ts` now asserts the round trip.
   */
  duration: string;
  sourceSpellId?: string;
  createdAt: string;
}

/** A spell effect template used for auto-creating TempModifiers on cast. */
export interface SpellEffect {
  stat: StatKey;
  delta: number;
  duration: TempModifier['duration'];
}

/**
 * A map of derived-value keys to manual override amounts.
 *
 * When a value is `null` the override is cleared and the computed formula is
 * used instead. When a number is present, that value is shown in place of the
 * computed result.
 *
 * @example
 * ```ts
 * const overrides: DerivedOverrides = { movement: 14, hpMax: null };
 * ```
 */
export type DerivedOverrides = Record<string, number | null>;

/**
 * A user-created custom card displayed on the sheet.
 */
export interface CustomCard {
  /** Unique identifier for this card. */
  id: string;
  /** Heading text shown at the top of the card. */
  title: string;
  /** Body text / markdown content of the card. */
  body: string;
}

/**
 * Persisted UI preferences scoped to a single character.
 *
 * @remarks
 * These values are stored alongside the character record so that each
 * character can independently control panel ordering, visibility, and
 * section collapse state.
 */
export interface CharacterUiState {
  /** IDs of sections currently expanded on the sheet. */
  expandedSections: string[];
  /** Skill IDs pinned to the top of the skills list. */
  pinnedSkills?: string[];
  /** Display order of draggable cards on the sheet view. */
  sheetCardOrder?: string[];
  /** User-created custom cards for the sheet view. */
  sheetCustomCards?: CustomCard[];
  /** Visibility flags for individual panels on the sheet view; keyed by panel ID. */
  sheetPanelVisibility?: Record<string, boolean>;
  /**
   * Display order of draggable cards on the combat view.
   *
   * @deprecated Orphaned — there is no combat screen; `/combat` redirects to the
   * sheet and combat lives in the play dashboard. Kept so existing records keep
   * validating; wire it up or drop it in a future migration.
   */
  combatCardOrder?: string[];
  /**
   * Visibility flags for individual panels on the combat view, keyed by panel ID.
   *
   * @deprecated Orphaned for the same reason as {@link combatCardOrder}. The
   * Settings section that wrote this was removed because toggling it changed
   * nothing.
   */
  combatPanelVisibility?: Record<string, boolean>;
  /**
   * Per-rest-type usage marks for the play dashboard rest module.
   * `true` means the rest has been used since the last reset; the
   * Reset button clears all three back to undefined.
   */
  restsUsed?: { round?: boolean; stretch?: boolean; shift?: boolean };
}

/**
 * A tracked resource with a current and maximum value.
 *
 * @example
 * ```ts
 * const hp: CharacterResource = { current: 8, max: 12 };
 * ```
 */
export interface CharacterResource {
  /** Current (spent) value of the resource. */
  current: number;
  /** Maximum possible value of the resource. */
  max: number;
}

/**
 * The full persisted record for a player character.
 *
 * @remarks
 * This is the root document stored in IndexedDB via Dexie.  Every field
 * is serialisable to JSON.  Timestamps follow ISO 8601 format.
 */
/** One roleplay prompt: a short cue for when to reach for it, plus the beat. */
export interface StoryBeat {
  id: string;
  /** Short trigger — a tag or "use when…" ("patience", "someone has died"). */
  cue: string;
  /** The prompt itself: an anecdote title, a reminder, a line to deliver. */
  text: string;
}

export interface CharacterRecord extends Versioned, Timestamped {
  /** Unique identifier for this character. */
  id: ID;
  /** ID of the game-system definition used for attribute/skill/condition lookups (e.g. `"default"`). */
  systemId: string;
  /** Display name of the character. */
  name: string;
  /** Biographical and flavour metadata. */
  metadata: CharacterMetadata;
  /** Map of attribute ID to current attribute score. */
  attributes: Record<string, number>;
  /** Map of condition ID to active state. */
  conditions: Record<string, boolean>;
  /** Map of resource ID (e.g. `"hp"`, `"wp"`) to current/max pair. */
  resources: Record<string, CharacterResource>;
  /** Map of skill ID to skill data. */
  skills: Record<string, CharacterSkill>;
  /** All weapons carried by the character. */
  weapons: Weapon[];
  /** Equipped body armour, or `null` if none. */
  armor: ArmorPiece | null;
  /** Equipped helmet, or `null` if none. */
  helmet: ArmorPiece | null;
  /** General inventory items. */
  inventory: InventoryItem[];
  /**
   * Free-carry tiny items (do not count toward encumbrance).
   * Each entry is a plain string label.
   */
  tinyItems: string[];
  /** The character's memento item description. */
  memento: string;
  /**
   * Roleplay prompts / story-bank beats the player keeps at hand — each a short
   * cue ("when to use") and the beat itself.
   *
   * @remarks
   * System-agnostic: a cue could be a Traveller anecdote trigger or a Dragonbane
   * weakness reminder. Optional and defaulted to `[]` on read, so characters
   * saved before it existed need no migration.
   */
  storyBank?: StoryBeat[];
  /**
   * Money held, keyed by the active system's currency denomination id.
   *
   * @remarks
   * Dragonbane stores `gold`/`silver`/`copper`; Traveller stores `credits`.
   * Read and write it through `engine.currency` rather than indexing directly,
   * so screens stay system-agnostic.
   */
  wealth: Record<string, number>;
  /**
   * Every special capability the character has, of any type the active system
   * declares. Replaces the separate `spells` and `heroicAbilities` arrays, which
   * required a Traveller character to carry two empty Dragonbane collections.
   *
   * Read and write it through `utils/abilities` rather than filtering by hand.
   */
  abilities: Ability[];
  /** Manual overrides for computed derived values. */
  derivedOverrides: DerivedOverrides;
  /** Active temporary stat modifiers (overlaid on base values). */
  tempModifiers?: TempModifier[];
  /** Persisted UI preferences for this character. */
  uiState: CharacterUiState;
  /** Base64 data-URL or remote URI for the character portrait image. */
  portraitUri?: string;
  /**
   * Advancement check flags — each becomes `true` once the trigger condition
   * for that track has been met during a session.
   */
  advancementChecks?: {
    /** Combat advancement track triggered. */
    combat?: boolean;
    /** Exploration advancement track triggered. */
    explore?: boolean;
    /** Weakness advancement track triggered. */
    weakness?: boolean;
    /** Heroic ability advancement track triggered. */
    heroic?: boolean;
  };
  /** ISO datetime when this character was soft-deleted; absent while active. */
  deletedAt?: string;
  /** Transaction UUID identifying the cascade that soft-deleted this character. */
  softDeletedBy?: string;
  /**
   * Free-form data belonging to the character's game system.
   *
   * @remarks
   * Replaces the former `travellerData` bag, which named one system on the
   * shared record and meant a third ruleset would need a third field. Systems
   * own the shape; the schema validates only that values are JSON-serialisable.
   */
  systemData?: Record<string, unknown>;
  /**
   * Skills this character has that the system definition does not declare.
   *
   * @remarks
   * Traveller's Language, Profession, Art and Science are open-ended: the book
   * prints some specialities and expects players to invent the rest, so
   * "Language (Zhodani)" belongs to one character, not to the ruleset. Editing
   * the shared definition to add it would put it on every Traveller character
   * in the library.
   *
   * Merged into the system's categories on read (see
   * {@link features/characters/customSkills!resolveSkillCategories}), so every
   * surface — the skills screen, the play dashboard, the printed sheet —
   * treats them exactly like declared skills. Values still live in `skills`
   * under the same id; this array only carries the *definition*.
   */
  customSkills?: CustomSkillDefinition[];
}

/**
 * A player-authored skill, stored on the character that owns it.
 *
 * @remarks
 * `categoryId` places it in one of the system's skill categories. A category
 * that no longer exists does not lose the skill — the merge falls back to a
 * trailing "Custom" group rather than dropping it, because a skill the user
 * cannot see is a skill they cannot delete either.
 */
export interface CustomSkillDefinition {
  id: string;
  name: string;
  categoryId: string;
  linkedAttributeId?: string;
  groupId?: string;
}
