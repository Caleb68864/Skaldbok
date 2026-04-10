import { z } from 'zod';

/**
 * Schema for a single attack entry on a creature template.
 */
export const creatureAttackSchema = z.object({
  name: z.string(),
  damage: z.string(),
  range: z.string(),
  skill: z.string(),
  special: z.string().optional(),
});

/**
 * Schema for a single ability entry on a creature template.
 */
export const creatureAbilitySchema = z.object({
  name: z.string(),
  description: z.string(),
});

/**
 * Schema for a single skill entry on a creature template.
 */
export const creatureSkillSchema = z.object({
  name: z.string(),
  value: z.number(),
});

/**
 * Zod schema for runtime validation of creature template records.
 *
 * @remarks
 * Creature templates are campaign-scoped stat blocks used for bestiary
 * entries and encounter participants. Category discriminates between
 * monsters, NPCs, and animals.
 */
export const creatureTemplateSchema = z.object({
  /** Unique identifier for the creature template. */
  id: z.string(),
  /** ID of the campaign this template belongs to. */
  campaignId: z.string(),
  /** Display name of the creature. */
  name: z.string(),
  /** Description — Tiptap JSON or plain string. */
  description: z.any().optional(),
  /** Category discriminator. */
  category: z.enum(['monster', 'npc', 'animal']),
  /** Role or function, e.g. "Innkeeper", "Guard Captain". */
  role: z.string().optional(),
  /** Faction or group affiliation. */
  affiliation: z.string().optional(),
  /** Core combat stats. */
  stats: z.object({
    hp: z.number(),
    armor: z.number(),
    movement: z.number(),
  }),
  /** Attacks available to this creature. */
  attacks: z.array(creatureAttackSchema),
  /** Special abilities. */
  abilities: z.array(creatureAbilitySchema),
  /** Skills with roll-under values. */
  skills: z.array(creatureSkillSchema),
  /** User-applied tag strings for filtering. */
  tags: z.array(z.string()),
  /** Optional image URL for the creature portrait. */
  imageUrl: z.string().optional(),
  /** Lifecycle status. */
  status: z.enum(['active', 'archived']),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update. */
  updatedAt: z.string(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this template was soft-deleted; absent while active. */
  deletedAt: z.string().optional(),
  /** Transaction UUID identifying the cascade that soft-deleted this template. */
  softDeletedBy: z.string().optional(),
});

/**
 * A creature template record inferred from {@link creatureTemplateSchema}.
 */
export type CreatureTemplate = z.infer<typeof creatureTemplateSchema>;
