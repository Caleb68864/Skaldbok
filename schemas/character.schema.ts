import { z } from 'zod';

/**
 * Identity fields are declared per-system (`SystemDefinition.identityFields`),
 * so metadata is an open string map rather than a fixed set. This lets a
 * Traveller character carry Species/Homeworld without also carrying Dragonbane's
 * required Kin and Weakness.
 */
const characterMetadataSchema = z
  .record(z.string(), z.string())
  .default({})
  .describe('System-declared identity fields, keyed by field id');

/**
 * Why every object in this file is `.passthrough()`.
 *
 * @remarks
 * `characterRecordSchema` has been a passthrough at the top level since early on,
 * and its comment explains why: `migrateCharacter` — the import path — returns
 * Zod's *output*, so any key the schema does not enumerate is **deleted from the
 * user's record** on the way in.
 *
 * That reasoning was never applied one level down, and Zod strips per object, not
 * per document. So eleven fields the TypeScript types declare, the UI writes and
 * live code reads — `CharacterSkill.dragonMarked`/`demonMarked`,
 * `Weapon.metal`/`damageType`/`strRequirement`/`damaged`/`isShield`,
 * `ArmorPiece.weight`/`bodyPart`/`movementPenalty`/`metal` — vanished on every
 * single import. Measured before the fix: 12 of 13 probed sub-fields lost, the
 * survivor being the one (`StoryBeat.body`) that had been enumerated here after
 * the same bug was found and fixed in that one place without generalising.
 *
 * This is data loss, not a schema nicety. The user's browser holds the only copy,
 * and a bundle re-imported onto a new device comes back with every shield
 * demoted to a weapon and every set of chainmail weightless.
 *
 * Two changes, both needed. The declared sub-fields below are now **enumerated**,
 * so they are validated rather than merely tolerated. And every object is
 * `.passthrough()`, so the *next* field added to a type and forgotten here
 * survives anyway. `characterSchemaRoundTrip.test.ts` asserts both: that no
 * object reachable from the record strips, and that every member the types
 * declare survives a real import.
 */
const characterSkillSchema = z.object({
  value: z.number().describe('Skill value (percentage)'),
  trained: z.boolean().describe('Whether the skill has been trained'),
  dragonMarked: z.boolean().optional().describe('Dragon-marked after a successful roll this session'),
  demonMarked: z.boolean().optional().describe('Demon-marked (corruption/advancement variant)'),
}).passthrough();

const weaponSchema = z.object({
  id: z.string().min(1).describe('Unique weapon id'),
  name: z.string().min(1).describe('Weapon name'),
  grip: z.enum(['one-handed', 'two-handed']).describe('Grip type'),
  range: z.string().describe('Weapon range'),
  damage: z.string().describe('Damage expression'),
  durability: z.number().describe('Durability rating'),
  features: z.string().describe('Special features'),
  equipped: z.boolean().describe('Whether weapon is currently equipped'),
  metal: z.boolean().optional().describe('Made of metal (relevant to some magic interactions)'),
  damageType: z
    .enum(['bludgeoning', 'slashing', 'piercing'])
    .nullable()
    .optional()
    .describe('Damage type used for armour penetration or special condition rules'),
  strRequirement: z.number().nullable().optional().describe('Minimum STR to wield without penalty'),
  damaged: z.boolean().optional().describe('Damaged; must be repaired before use'),
  isShield: z.boolean().optional().describe('This entry is a shield rather than an offensive weapon'),
  systemFields: z.record(z.string(), z.unknown()).optional().describe('System-declared extra fields'),
}).passthrough();

const armorPieceSchema = z.object({
  id: z.string().min(1).describe('Unique armor id'),
  name: z.string().min(1).describe('Armor name'),
  rating: z.number().describe('Armor rating'),
  features: z.string().describe('Special features'),
  equipped: z.boolean().describe('Whether armor is equipped'),
  weight: z.number().optional().describe('Weight contributing toward the encumbrance limit'),
  bodyPart: z.string().optional().describe('Body area covered'),
  movementPenalty: z.number().optional().describe('Movement reduction while worn'),
  metal: z.boolean().optional().describe('Made of metal'),
  systemFields: z.record(z.string(), z.unknown()).optional().describe('System-declared extra fields'),
}).passthrough();

const inventoryItemSchema = z.object({
  id: z.string().min(1).describe('Unique item id'),
  name: z.string().min(1).describe('Item name'),
  weight: z.number().describe('Item weight'),
  quantity: z.number().int().nonnegative().describe('Item quantity'),
  description: z.string().describe('Item description'),
  tiny: z.boolean().optional().describe('Free-carry tiny item (no weight counted)'),
  consumable: z.boolean().optional().describe('Show inline +/- in play mode'),
  capacityBonus: z.number().optional().describe('Bonus weight units added to encumbrance limit while carried'),
}).passthrough();

/**
 * One unified collection for spells, heroic abilities, talents and anything
 * else a ruleset calls a special capability. Ruleset-specific fields live in
 * `systemFields`, so no system's vocabulary is baked into the shared schema.
 */
const abilitySchema = z.object({
  id: z.string().min(1).describe('Unique ability id'),
  type: z.string().min(1).describe('Ability type id declared by the system'),
  name: z.string().min(1).describe('Ability name'),
  summary: z.string().default('').describe('Ability summary'),
  cost: z.record(z.string(), z.number()).optional().describe('Cost keyed by resource id'),
  prepared: z.boolean().optional(),
  pinnedAsStamp: z.boolean().optional(),
  effects: z.array(z.unknown()).optional(),
  systemFields: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const characterResourceSchema = z.object({
  current: z.number().min(0).describe('Current resource value'),
  max: z.number().describe('Maximum resource value'),
}).passthrough();

export const characterRecordSchema = z.object({
  id: z.string().min(1).describe('Unique character id'),
  schemaVersion: z.number().int().positive().describe('Schema version for migration'),
  systemId: z.string().min(1).describe('System this character uses'),
  name: z.string().describe('Character name'),
  createdAt: z.string().describe('ISO 8601 creation timestamp'),
  updatedAt: z.string().describe('ISO 8601 last updated timestamp'),
  metadata: characterMetadataSchema,
  attributes: z.record(z.string(), z.number()).describe('Attribute id to value map'),
  conditions: z.record(z.string(), z.boolean()).describe('Condition id to active state map'),
  resources: z.record(z.string(), characterResourceSchema).describe('Resource id to current/max map'),
  skills: z.record(z.string(), characterSkillSchema).describe('Skill id to value/trained map'),
  // Collections default to empty so a record from a system that has no such
  // concept (Traveller has no spells or heroic abilities) still validates,
  // while parsed output keeps the non-optional shape consumers rely on.
  weapons: z.array(weaponSchema).default([]),
  armor: armorPieceSchema.nullable().default(null),
  helmet: armorPieceSchema.nullable().default(null),
  inventory: z.array(inventoryItemSchema).default([]),
  tinyItems: z.array(z.string()).default([]).describe('List of tiny item names'),
  memento: z.string().default('').describe('Character memento description'),
  storyBank: z.array(z.object({
    id: z.string(),
    cue: z.string(),
    text: z.string(),
    // Optional, and listed here as well as on the type: Zod strips unknown keys,
    // so a field added to `StoryBeat` alone would survive for locally-created
    // beats and silently vanish for imported ones.
    //
    // This was the one place that reasoning had been applied. It is why `body`
    // was the sole survivor of the thirteen sub-fields probed before this change,
    // and why the instance was fixed here while eleven siblings kept vanishing:
    // the comment states the rule and the rule was never generalised.
    body: z.string().optional(),
  }).passthrough()).optional().describe('Roleplay prompts / story-bank beats'),
  wealth: z
    .record(z.string(), z.number().nonnegative())
    .default({})
    .describe('Money held, keyed by currency denomination id'),
  abilities: z.array(abilitySchema).default([]),
  derivedOverrides: z.record(z.string(), z.number().nullable()).default({}).describe('Override map for derived values'),
  // passthrough, and now with nothing enumerated at all.
  //
  // This comment used to justify the passthrough by naming "sheetCardOrder,
  // sheetPanelVisibility, pinnedSkills, restsUsed" and adding "the card-template
  // sheet layout lives here". Two of those four had readers and two did not, and
  // the sheet layout does not live here — it lives in app settings, as
  // `settings.sheetPanelOrder`. The three unread ones are gone from
  // `CharacterUiState`; `expandedSections` went with them, which is why nothing
  // is listed above any more.
  //
  // The passthrough itself is still right, and is the reason removing those
  // members costs a user nothing: a record that carries them keeps them, and no
  // migration strips them. It is also what lets `pinnedSkills` and `restsUsed`
  // survive an import without being restated here.
  uiState: z.object({}).passthrough().default({}),
  deletedAt: z.string().optional().describe('ISO timestamp when soft-deleted; absent when live'),
  softDeletedBy: z.string().optional().describe('Transaction UUID identifying the cascade that soft-deleted this character'),
  systemData: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Free-form data owned by the character game system'),
  // Enumerated rather than left to passthrough: these definitions are merged
  // into the system's categories and rendered like declared skills, so a
  // malformed entry would reach the UI as a nameless row.
  customSkills: z
    .array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      categoryId: z.string().min(1),
      linkedAttributeId: z.string().optional(),
      groupId: z.string().optional(),
    }).passthrough())
    .optional()
    .describe('Player-authored skills not declared by the system definition'),
})
  // passthrough so validation-on-import (migrateCharacter) never DROPS a field the
  // CharacterRecord type carries but this schema doesn't yet enumerate (portraitUri,
  // tempModifiers, advancementChecks, ...). It still validates every known field, so
  // a malformed record is rejected — it just isn't silently narrowed.
  .passthrough();

export type CharacterRecordSchema = z.infer<typeof characterRecordSchema>;
