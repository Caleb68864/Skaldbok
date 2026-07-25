export interface AttributeDefinition {
  id: string;
  name: string;
  abbreviation: string;
  min: number;
  max: number;
  /**
   * How the stored number reads and steps. Absent = a plain numeric score
   * (today's Dragonbane/Traveller behaviour). A `die-ladder` stores die *sides*
   * (4/6/8/10/12) and steps along that ladder rather than every integer — so a
   * Savage Worlds attribute stepper offers d4→d6→d8, never d5/d7. `allowsPlus`
   * permits the `d12+1`/`d12+2` extension beyond the top rung.
   */
  scale?: { kind: 'die-ladder'; ladder: number[]; allowsPlus?: boolean };
}

/** A machine-readable penalty a condition imposes while active. */
export type ConditionEffect =
  | { scope: 'all-traits'; modifier: number }
  | { scope: 'attribute-linked'; modifier: number }
  | { scope: 'no-actions' };

export interface ConditionDefinition {
  id: string;
  name: string;
  /**
   * Dragonbane's "this condition banes skills linked to this attribute". Optional
   * because Savage Worlds conditions (Shaken, Distracted) are flat global effects
   * with no linked attribute.
   */
  linkedAttributeId?: string;
  description: string;
  /**
   * The mechanical penalty while active, for systems (Savage Worlds) whose
   * conditions are live rules rather than flavour. Absent = descriptive only.
   */
  effect?: ConditionEffect;
  /** How long the condition lasts before it clears on its own. */
  duration?: 'until-cleared' | 'end-of-next-turn' | 'scene';
  /**
   * A roll that can clear the condition (Shaken → Spirit; Fatigue → Vigor). A
   * `onCriticalFailure` string names a consequence (e.g. "take 1 wound").
   */
  recovery?: { traitId: string; targetNumber: number; onCriticalFailure?: string };
}

export interface ResourceDefinition {
  id: string;
  name: string;
  derivedFrom?: string;
  min: number;
  defaultMax: number;
  /**
   * Whether the resource *depletes* (starts at max, counts down, 0 = bad — e.g.
   * Dragonbane HP) or *accumulates* (starts at 0, counts up, `current >= max` =
   * bad — e.g. a Traveller damage track). Declared here so damage/heal code
   * reads polarity as a fact instead of proxying it off `engine.damageTrack`.
   * Defaults to `'depletes'` when unset. E2.
   */
  direction?: 'depletes' | 'accumulates';
  /**
   * When the resource resets to full. `'never'` (default) = only manual/rest
   * mechanics touch it (HP, WP); `'session'` = refreshed at the start of each
   * session (Savage Worlds Bennies); `'rest'` = a rest action restores it.
   */
  refresh?: 'never' | 'session' | 'rest';
}

export interface SkillDefinition {
  id: string;
  name: string;
  baseChance: number;
  linkedAttributeId?: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: SkillDefinition[];
}

/**
 * One system-specific field on an item, stored in the item's `systemFields` bag.
 *
 * @remarks
 * Exported so the editors that write these fields and the cards that display
 * them share a single definition — a summary line that invents its own shape is
 * how Traveller weapons ended up showing Dragonbane's grip and durability.
 */
export interface ItemFieldDef {
  id: string;
  label: string;
  type?: 'text' | 'number';
}

export interface SectionLayout {
  id: string;
  label: string;
  sections: string[];
}

/**
 * One at-the-table cheat-sheet card (task targets, the Effect table, combat
 * actions…), rendered read-only wherever the quick reference is shown.
 *
 * @remarks
 * Reference content is data, not code — a ruleset ships its own cards and any
 * screen renders them the same way, so adding a system never means editing the
 * quick-reference UI.
 */
export interface QuickRefCard {
  title: string;
  /** Optional column headers; when present the rows render as a table. */
  columns?: string[];
  /** Rows of cells. A single-cell row reads as a plain list item. */
  rows: string[][];
  /** Optional one-line note printed beneath the card. */
  note?: string;
}

export interface SystemDefinition {
  id: string;
  version: number;
  name: string;
  displayName: string;
  attributes: AttributeDefinition[];
  conditions: ConditionDefinition[];
  resources: ResourceDefinition[];
  skillCategories: SkillCategory[];
  sectionLayouts?: SectionLayout[];
  themesSupported?: string[];
  /** At-the-table cheat-sheet cards; see {@link QuickRefCard}. */
  quickReference?: QuickRefCard[];
  /**
   * Identity fields shown on the sheet's Identity panel and the print header,
   * in display order. Each `id` is a key in `CharacterRecord.metadata`.
   *
   * @remarks
   * Lets a ruleset ask for Kin and Weakness while another asks for Species and
   * Homeworld, instead of every character carrying Dragonbane's field set.
   */
  identityFields?: Array<{
    id: string;
    label: string;
    /** `text` renders a single-line input, `textarea` a multi-line one. */
    type?: 'text' | 'textarea';
  }>;
  /**
   * Extra per-item fields this system wants on weapons and armour, beyond the
   * shared core (name, damage, equipped…).
   *
   * @remarks
   * Values are stored in the item's own `systemFields` bag, so a sci-fi ruleset
   * can ask for Tech Level, Range in metres, Magazine and Traits without those
   * columns existing on every fantasy weapon. Purely additive — a system that
   * declares nothing keeps exactly the built-in fields.
   */
  itemFields?: {
    weapon?: ItemFieldDef[];
    armor?: ItemFieldDef[];
    /**
     * Built-in item fields this system does not use, by field id.
     *
     * @remarks
     * A hide-list rather than an allow-list, so omitting it shows everything and
     * a system that declares nothing is unaffected. Lets a sci-fi ruleset drop
     * Grip and Durability instead of showing fantasy melee fields next to its
     * own Magazine and Tech Level.
     *
     * Weapon ids: `range`, `damage`, `features`, `grip`, `durability`,
     * `damageType`, `strRequirement`, `isShield`, `damaged`.
     * Armour ids: `bodyPart`, `weight`, `movementPenalty`.
     * `name` and the core rating/damage fields are not hideable.
     */
    hiddenBuiltIns?: {
      weapon?: string[];
      armor?: string[];
    };
  };
  resolution?: 'd20-roll-under' | '2d6-plus' | 'trait-die-vs-tn';
  currency?: { label: string; abbr: string; mode: 'coins' | 'single' };
  /**
   * Optional overrides for system vocabulary (see `SystemTerms` in the engine).
   * Any omitted key falls back to the engine adapter's default.
   */
  terms?: Partial<{
    abilities: string;
    spells: string;
    magicResource: string;
    healthResource: string;
    roleFallback: string;
  }>;
  /**
   * Optional overrides for panel/screen titles (see `SystemLabels`).
   * `abilitiesScreen: null` hides the abilities/magic tab for this system.
   */
  labels?: Partial<{
    abilitiesScreen: string | null;
    resourcesPanel: string;
    attributesPanel: string;
    encumbrance: string;
  }>;
}
