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
 * Zod schema for a single encounter segment.
 *
 * @remarks
 * Segments replace the old scalar `startedAt`/`endedAt` pair on an encounter.
 * An encounter may have multiple segments if it is paused and resumed. The
 * invariant is that at most one segment at a time may be "open" (no
 * `endedAt`). Use `encounterRepository.pushSegment` / `endActiveSegment` to
 * manipulate this list.
 */
export const segmentSchema = z.object({
  /** ISO datetime when this segment started. */
  startedAt: z.string(),
  /** ISO datetime when this segment ended; absent while the segment is open. */
  endedAt: z.string().optional(),
});

/**
 * Zod schema for a single encounter participant.
 *
 * @remarks
 * A participant's link back to a creature template or player character is
 * expressed via an `entityLink` edge of type `represents` rather than a
 * direct foreign-key column. This keeps the participant table shape
 * uniform and lets the same row represent a PC, a named NPC, or an
 * on-the-fly monster without schema churn.
 */
export const encounterParticipantSchema = z.object({
  /** Unique identifier for this participant entry. */
  id: z.string(),
  /** Display name of the participant. */
  name: z.string(),
  /** Participant type discriminator. */
  type: z.enum(['pc', 'npc', 'monster']),
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
 * track participants, linked notes, optional combat timeline data, and now
 * carry narrative fields (description / body / summary) and a `segments[]`
 * array for pause/resume lifecycle.
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
  /** Optional prep / setup notes (ProseMirror JSON). */
  description: z.any().optional(),
  /** Optional main body of narrative content (ProseMirror JSON). */
  body: z.any().optional(),
  /** Optional post-encounter wrap-up (ProseMirror JSON). */
  summary: z.any().optional(),
  /** Free-form tags for filtering and search. */
  tags: z.array(z.string()).default([]),
  /** Optional location string (room, biome, landmark). */
  location: z.string().optional(),
  /** Ordered list of segments; last entry is the current segment. */
  segments: z.array(segmentSchema).default([]),
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
  /** ISO datetime when this encounter was soft-deleted; absent while active. */
  deletedAt: z.string().optional(),
  /** Transaction UUID identifying the cascade that soft-deleted this encounter. */
  softDeletedBy: z.string().optional(),
});

/**
 * An encounter record inferred from {@link encounterSchema}.
 */
export type Encounter = z.infer<typeof encounterSchema>;

/**
 * An encounter participant inferred from {@link encounterParticipantSchema}.
 */
export type EncounterParticipant = z.infer<typeof encounterParticipantSchema>;

/**
 * A single encounter segment inferred from {@link segmentSchema}.
 */
export type Segment = z.infer<typeof segmentSchema>;
