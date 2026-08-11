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

const characterSkillSchema = z.object({
  value: z.number().describe('Skill value (percentage)'),
  trained: z.boolean().describe('Whether the skill has been trained'),
});

const weaponSchema = z.object({
  id: z.string().min(1).describe('Unique weapon id'),
  name: z.string().min(1).describe('Weapon name'),
  grip: z.enum(['one-handed', 'two-handed']).describe('Grip type'),
  range: z.string().describe('Weapon range'),
  damage: z.string().describe('Damage expression'),
  durability: z.number().describe('Durability rating'),
  features: z.string().describe('Special features'),
  equipped: z.boolean().describe('Whether weapon is currently equipped'),
  systemFields: z.record(z.string(), z.unknown()).optional().describe('System-declared extra fields'),
});

const armorPieceSchema = z.object({
  id: z.string().min(1).describe('Unique armor id'),
  name: z.string().min(1).describe('Armor name'),
  rating: z.number().describe('Armor rating'),
  features: z.string().describe('Special features'),
  equipped: z.boolean().describe('Whether armor is equipped'),
  systemFields: z.record(z.string(), z.unknown()).optional().describe('System-declared extra fields'),
});

const inventoryItemSchema = z.object({
  id: z.string().min(1).describe('Unique item id'),
  name: z.string().min(1).describe('Item name'),
  weight: z.number().describe('Item weight'),
  quantity: z.number().int().nonnegative().describe('Item quantity'),
  description: z.string().describe('Item description'),
  tiny: z.boolean().optional().describe('Free-carry tiny item (no weight counted)'),
  consumable: z.boolean().optional().describe('Show inline +/- in play mode'),
  capacityBonus: z.number().optional().describe('Bonus weight units added to encumbrance limit while carried'),
});

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
});

const characterResourceSchema = z.object({
  current: z.number().min(0).describe('Current resource value'),
  max: z.number().describe('Maximum resource value'),
});

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
    body: z.string().optional(),
  })).optional().describe('Roleplay prompts / story-bank beats'),
  wealth: z
    .record(z.string(), z.number().nonnegative())
    .default({})
    .describe('Money held, keyed by currency denomination id'),
  abilities: z.array(abilitySchema).default([]),
  derivedOverrides: z.record(z.string(), z.number().nullable()).default({}).describe('Override map for derived values'),
  // passthrough: uiState carries more keys than expandedSections (sheetCardOrder,
  // sheetPanelVisibility, pinnedSkills, restsUsed, ...). Keep them on import rather
  // than stripping — the card-template sheet layout lives here.
  uiState: z.object({
    expandedSections: z.array(z.string()).default([]),
  }).passthrough().default({ expandedSections: [] }),
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
    }))
    .optional()
    .describe('Player-authored skills not declared by the system definition'),
})
  // passthrough so validation-on-import (migrateCharacter) never DROPS a field the
  // CharacterRecord type carries but this schema doesn't yet enumerate (portraitUri,
  // tempModifiers, advancementChecks, ...). It still validates every known field, so
  // a malformed record is rejected — it just isn't silently narrowed.
  .passthrough();

export type CharacterRecordSchema = z.infer<typeof characterRecordSchema>;
