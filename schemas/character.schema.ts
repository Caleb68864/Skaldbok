import { z } from 'zod';

const characterMetadataSchema = z.object({
  kin: z.string().describe('Character kin/race'),
  profession: z.string().describe('Character profession'),
  age: z.string().describe('Character age'),
  weakness: z.string().describe('Character weakness'),
  appearance: z.string().describe('Physical appearance description'),
  notes: z.string().describe('General notes'),
});

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
});

const armorPieceSchema = z.object({
  id: z.string().min(1).describe('Unique armor id'),
  name: z.string().min(1).describe('Armor name'),
  rating: z.number().describe('Armor rating'),
  features: z.string().describe('Special features'),
  equipped: z.boolean().describe('Whether armor is equipped'),
});

const inventoryItemSchema = z.object({
  id: z.string().min(1).describe('Unique item id'),
  name: z.string().min(1).describe('Item name'),
  weight: z.number().describe('Item weight'),
  quantity: z.number().int().nonnegative().describe('Item quantity'),
  description: z.string().describe('Item description'),
});

const spellSchema = z.object({
  id: z.string().min(1).describe('Unique spell id'),
  name: z.string().min(1).describe('Spell name'),
  school: z.string().describe('Magic school'),
  powerLevel: z.number().describe('Power level'),
  wpCost: z.number().nonnegative().describe('WP cost to cast'),
  range: z.string().describe('Spell range'),
  duration: z.string().describe('Spell duration'),
  summary: z.string().describe('Spell summary'),
  powerScaling: z.tuple([z.string(), z.string(), z.string()]).optional().describe('Short descriptions for PL 1-3'),
});

const heroicAbilitySchema = z.object({
  id: z.string().min(1).describe('Unique ability id'),
  name: z.string().min(1).describe('Ability name'),
  summary: z.string().describe('Ability summary'),
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
  weapons: z.array(weaponSchema),
  armor: armorPieceSchema.nullable(),
  helmet: armorPieceSchema.nullable(),
  inventory: z.array(inventoryItemSchema),
  tinyItems: z.array(z.string()).describe('List of tiny item names'),
  memento: z.string().describe('Character memento description'),
  coins: z.object({
    gold: z.number().nonnegative(),
    silver: z.number().nonnegative(),
    copper: z.number().nonnegative(),
  }),
  spells: z.array(spellSchema),
  heroicAbilities: z.array(heroicAbilitySchema),
  derivedOverrides: z.record(z.string(), z.number().nullable()).describe('Override map for derived values'),
  uiState: z.object({
    expandedSections: z.array(z.string()),
  }),
  deletedAt: z.string().optional().describe('ISO timestamp when soft-deleted; absent when live'),
  softDeletedBy: z.string().optional().describe('Transaction UUID identifying the cascade that soft-deleted this character'),
});

export type CharacterRecordSchema = z.infer<typeof characterRecordSchema>;
