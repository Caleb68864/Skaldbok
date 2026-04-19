import type { ID, Timestamped, Versioned } from './common';

/**
 * Biographical and flavour metadata for a character.
 *
 * @remarks
 * All fields are plain strings so they can be freely edited in the identity
 * panel without imposing validation constraints on the user.
 */
export interface CharacterMetadata {
  /** The character's kin (race / lineage), e.g. "Human", "Elf", "Dwarf". */
  kin: string;
  /** The character's profession / class, e.g. "Knight", "Hunter". */
  profession: string;
  /** Free-text age, e.g. "23" or "Middle-aged". */
  age: string;
  /** The character's personal weakness — used for advancement checks. */
  weakness: string;
  /** Physical appearance description. */
  appearance: string;
  /** Miscellaneous notes about the character. */
  notes: string;
}

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
 *
 * @remarks
 * Refer to Dragonbane core rules pp. 73-76 for weapon stat definitions.
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
}

/**
 * A piece of armour or a helmet worn by the character.
 *
 * @remarks
 * Refer to Dragonbane core rules p. 77 for armour stats.
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
}

/**
 * An item in the character's general inventory.
 *
 * @remarks
 * Weight is counted toward encumbrance (see Dragonbane p. 32).
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
}

/**
 * A spell known by the character.
 *
 * @remarks
 * Spells belong to magical schools and cost WP (willpower) to cast.
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
  duration: 'round' | 'stretch' | 'shift' | 'scene' | 'permanent';
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
  /** Display order of draggable cards on the combat view. */
  combatCardOrder?: string[];
  /** Visibility flags for individual panels on the combat view; keyed by panel ID. */
  combatPanelVisibility?: Record<string, boolean>;
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
export interface CharacterRecord extends Versioned, Timestamped {
  /** Unique identifier for this character. */
  id: ID;
  /** ID of the game-system definition used for attribute/skill/condition lookups (e.g. `"dragonbane"`). */
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
  /** Coin purse. */
  coins: {
    /** Gold coins held. */
    gold: number;
    /** Silver coins held. */
    silver: number;
    /** Copper coins held. */
    copper: number;
  };
  /** Spells known by the character. */
  spells: Spell[];
  /** Heroic abilities unlocked by the character. */
  heroicAbilities: HeroicAbility[];
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
}
