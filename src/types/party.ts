import { z } from 'zod';

/**
 * Zod schema for runtime validation of party records read from IndexedDB.
 *
 * @remarks
 * A party groups together the characters participating in a campaign.
 * The `name` field is optional — campaigns may choose a party name or leave it blank.
 *
 * @example
 * ```ts
 * const result = partySchema.safeParse(rawRecord);
 * if (!result.success) console.warn(result.error);
 * ```
 */
export const partySchema = z.object({
  /** Unique identifier for the party. */
  id: z.string(),
  /** ID of the campaign this party belongs to. */
  campaignId: z.string(),
  /** Optional display name for the party, e.g. "The Iron Circle". */
  name: z.string().optional(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update to this record. */
  updatedAt: z.string(),
});

/**
 * Zod schema for runtime validation of party member records read from IndexedDB.
 *
 * @remarks
 * A party member links a seat in the party to either a {@link CharacterRecord}
 * (via `linkedCharacterId`) or a named NPC/placeholder (via `name`).
 * `isActivePlayer` distinguishes PC slots from guest or inactive seats.
 *
 * @example
 * ```ts
 * const result = partyMemberSchema.safeParse(rawRecord);
 * if (!result.success) console.warn(result.error);
 * ```
 */
export const partyMemberSchema = z.object({
  /** Unique identifier for the party member entry. */
  id: z.string(),
  /** ID of the {@link Party} this member belongs to. */
  partyId: z.string(),
  /** ID of the {@link CharacterRecord} linked to this slot, if any. */
  linkedCharacterId: z.string().optional(),
  /** Display name override for the member (used when no character is linked). */
  name: z.string().optional(),
  /** If `true`, this slot represents an active player character at the table. */
  isActivePlayer: z.boolean(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update to this record. */
  updatedAt: z.string(),
});

/**
 * A party record inferred from {@link partySchema}.
 */
export type Party = z.infer<typeof partySchema>;

/**
 * A party member record inferred from {@link partyMemberSchema}.
 */
export type PartyMember = z.infer<typeof partyMemberSchema>;
