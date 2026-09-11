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
  /**
   * Stat block, keyed by the ids the active ruleset declares in
   * `SystemDefinition.creatures.statFields`.
   *
   * @remarks
   * Was a closed `{ hp, armor, movement }`: three required Dragonbane numbers a
   * Traveller animal could not use and could not extend. An open bag needs no
   * data migration — every stored creature already satisfies it, because those
   * three keys are exactly what the default declaration names.
   *
   * A stat the ruleset does not declare is **kept**, and surfaces in a trailing
   * "Other" group rather than vanishing. That is deliberately the opposite of
   * the import rule, which drops undeclared keys: a stored number is data
   * somebody already entered, while an import is untrusted input that has not
   * been accepted yet.
   */
  stats: z.record(z.string(), z.number()),
  /** Attacks available to this creature. */
  attacks: z.array(creatureAttackSchema),
  /** Special abilities. */
  abilities: z.array(creatureAbilitySchema),
  /** Skills with roll-under values. */
  skills: z.array(creatureSkillSchema),
  /** User-applied tag strings for filtering. */
  tags: z.array(z.string()),
  // There was an `imageUrl` here, with a real text input behind it
  // (`CreatureTemplateForm`, placeholder "https://…"). Nothing rendered it:
  // there is no `<img>` anywhere in `features/bestiary/`, `renderCreatureExport`
  // omits it, and its only reader was the form reading back what the form had
  // just written — verbatim the `bottomNavTabs` shape that
  // `settingsHaveReaders.test.ts` exists to name.
  //
  // Removed rather than wired, and that is the unusual direction here. Wiring it
  // means fetching user content from a third-party host on every card render, in
  // an offline-first app whose own pattern for images is a data URI
  // (`portraitUri`, `utils/import/portraitUri.ts`). "Expose it" is not
  // automatically the answer: a control that changes nothing is the defect, and
  // making this one work would have added the one thing the app deliberately
  // avoids. A creature portrait belongs on the `portraitUri` path when it comes.
  //
  // `db/client.ts`'s v6 upgrade still writes `imageUrl: undefined` — it is a
  // released migration body and is fingerprinted, so it is not edited. Writing
  // `undefined` stores nothing.
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

/** One attack on a creature. See {@link creatureAttackSchema}. */
export type CreatureAttack = z.infer<typeof creatureAttackSchema>;
/** One special ability on a creature. See {@link creatureAbilitySchema}. */
export type CreatureAbility = z.infer<typeof creatureAbilitySchema>;
/** One skill on a creature. See {@link creatureSkillSchema}. */
export type CreatureSkill = z.infer<typeof creatureSkillSchema>;
