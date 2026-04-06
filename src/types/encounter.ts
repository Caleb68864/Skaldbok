import { z } from 'zod';

/**
 * Zod schema for a single encounter participant's instance state.
 *
 * @remarks
 * Instance state tracks mutable per-encounter values (current HP,
 * conditions, notes) that differ from the creature template's base stats.
 */
export const participantInstanceStateSchema = z.object({
  currentHp: z.number().optional(),
  conditions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

/**
 * Zod schema for a single encounter participant.
 *
 * @remarks
 * A participant links to either a creature template (via `linkedCreatureId`)
 * or a player character (via `linkedCharacterId`). The `type` discriminator
 * identifies whether the participant is a PC, NPC, or monster.
 */
export const encounterParticipantSchema = z.object({
  /** Unique identifier for this participant entry. */
  id: z.string(),
  /** Display name of the participant. */
  name: z.string(),
  /** Participant type discriminator. */
  type: z.enum(['pc', 'npc', 'monster']),
  /** ID of the linked creature template, if any. */
  linkedCreatureId: z.string().optional(),
  /** ID of the linked player character, if any. */
  linkedCharacterId: z.string().optional(),
  /** Mutable per-encounter state for this participant. */
  instanceState: participantInstanceStateSchema,
  /** Sort order for display in participant lists. */
  sortOrder: z.number(),
});

/**
 * Zod schema for combat-specific encounter data.
 */
export const combatDataSchema = z.object({
  currentRound: z.number(),
  events: z.array(z.any()),
});

/**
 * Zod schema for runtime validation of encounter records.
 *
 * @remarks
 * Encounters are session-scoped events (combat, social, exploration) that
 * track participants, linked notes, and optional combat timeline data.
 */
export const encounterSchema = z.object({
  /** Unique identifier for the encounter. */
  id: z.string(),
  /** ID of the session this encounter belongs to. */
  sessionId: z.string(),
  /** ID of the campaign this encounter belongs to. */
  campaignId: z.string(),
  /** Display title of the encounter. */
  title: z.string(),
  /** Encounter type discriminator. */
  type: z.enum(['combat', 'social', 'exploration']),
  /** Lifecycle status. */
  status: z.enum(['active', 'ended']),
  /** ISO datetime when the encounter started. */
  startedAt: z.string(),
  /** ISO datetime when the encounter ended; absent while still active. */
  endedAt: z.string().optional(),
  /** List of participants in this encounter. */
  participants: z.array(encounterParticipantSchema),
  /** Combat-specific data (rounds, events); present only for combat encounters. */
  combatData: combatDataSchema.optional(),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update. */
  updatedAt: z.string(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
});

/**
 * An encounter record inferred from {@link encounterSchema}.
 */
export type Encounter = z.infer<typeof encounterSchema>;

/**
 * An encounter participant inferred from {@link encounterParticipantSchema}.
 */
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;
