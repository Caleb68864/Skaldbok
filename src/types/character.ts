import type { ID, Timestamped, Versioned } from './common';
import type { Debt } from '../features/characters/debts';

/**
 * Biographical and flavour metadata for a character.
 *
 * @remarks
 * All fields are plain strings so they can be freely edited in the identity
 * panel without imposing validation constraints on the user.
 */
export type CharacterMetadata = Record<string, string>;

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
/**
 * A temporary adjustment to one or more stats.
 *
 * @remarks
 * There was a `sourceSpellId` here, written by `MagicScreen` for every spell
 * cast with `effects` and read by nothing. It was a second statement of a fact
 * `label` already makes — `label` *is* the spell's name, set on the same lines —
 * with no reader to keep it honest, so nothing could tell whether it was right.
 * Dropped rather than labelled, on the same grounds as
 * `surfaceLayoutSchema.layout`.
 *
 * The things an id would buy that a name does not — expiring a modifier with
 * the spell that made it, surviving a rename — are the reasons to add it back,
 * *with* the code that does them, on the day one of them is wanted.
 */
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
 * Persisted UI preferences scoped to a single character.
 *
 * @remarks
 * This interface used to promise that "each character can independently control
 * panel ordering, visibility, and section collapse state". It did none of those
 * things. Seven members were declared here, five validated by
 * `schemas/character.schema.ts`, one written on every single save — and not one
 * had a reader:
 *
 * | member | why it went |
 * |---|---|
 * | `expandedSections` | **required**, written as `[]` by `characterNormalization` on every save, read by nothing. The sheet has no collapsible sections; it has draggable panels. |
 * | `sheetCardOrder` | superseded. Panel order is persisted in *app settings* as `settings.sheetPanelOrder` (`SheetScreen.handleOrderChange`), globally rather than per character. |
 * | `sheetPanelVisibility` | superseded. Visibility is computed each render from panel availability and play/edit mode, and is never persisted. |
 * | `sheetCustomCards` | never written by anything, along with the whole `CustomCard` interface that existed only to type it. |
 * | `combatCardOrder`, `combatPanelVisibility` | already `@deprecated` here: there is no combat screen, and the Settings section that wrote them was deleted *because toggling it changed nothing*. |
 *
 * Removing them loses no stored data. `characterRecordSchema`'s `uiState` is
 * `.passthrough()`, so a record that still carries any of these keeps them, and
 * no migration drops them — they simply stop being a promise the type makes.
 *
 * What remains is what is actually read: `pinnedSkills` by `SkillModule`, and
 * `restsUsed` by `RestModule`.
 */
export interface CharacterUiState {
  /** Skill IDs pinned to the top of the skills list. */
  pinnedSkills?: string[];
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
  /**
   * The story in full, opened from the row rather than shown in it.
   *
   * @remarks
   * `text` is a title you scan down a list at the table; this is the anecdote
   * behind it, which is too long to sit in the row without burying every other
   * cue. Optional, so every beat written before this existed is still valid and
   * no migration is needed — a beat with no body simply has nothing to expand.
   */
  body?: string;
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
  /**
   * Keyed by `engine.advancement.sessionEvents[].id`.
   *
   * @remarks
   * Was four literal optional booleans — `combat`, `explore`, `weakness`,
   * `heroic` — which are Dragonbane's session events hardcoded into the
   * system-neutral character record. A ruleset with different events (or more
   * than four) could not be represented, and adding one would have been a
   * schema change rather than a `system.json` edit.
   *
   * **No code reads or writes this yet.** `engine.advancement` is likewise
   * declared, populated for Dragonbane, and consumed by nothing — the
   * advancement checklist is designed but unbuilt. The shape is corrected here
   * so that whoever builds it starts from a system-neutral one; see
   * `docs/decisions.md` for the full finding.
   */
  advancementChecks?: Record<string, boolean>;
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
  /**
   * Money owed, in either direction. See
   * {@link features/characters/debts!Debt | Debt}.
   *
   * @remarks
   * Optional and additive, so every existing record is already valid and no
   * migration rung is needed — every read path goes through `?? []`.
   */
  debts?: Debt[];
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
