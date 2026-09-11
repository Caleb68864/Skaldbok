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
  /** ISO datetime when this party was soft-deleted; absent while active. */
  deletedAt: z.string().optional(),
  /** Transaction UUID identifying the cascade that soft-deleted this party. */
  softDeletedBy: z.string().optional(),
});

/**
 * Zod schema for runtime validation of party member records read from IndexedDB.
 *
 * @remarks
 * A party member links a seat in the party to either a {@link types/character!CharacterRecord | CharacterRecord}
 * (via `linkedCharacterId`) or a named NPC/placeholder (via `name`).
 *
 * There was a **required** `isActivePlayer: z.boolean()` here, documented as
 * distinguishing "PC slots from guest or inactive seats". It was hardcoded
 * `false` at both places that create a seat and read nowhere, so it could never
 * be `true` for a record this app made, and the distinction it named did not
 * exist anywhere in the interface.
 *
 * Removed rather than wired, because wiring it means inventing the feature it
 * describes — a per-seat toggle, plus something that acts on the answer — and a
 * sweep for half-wired surfaces is not the place to decide the party screen
 * wants one. Nothing is lost: Zod drops the key from an older bundle on import,
 * and it never carried information to begin with.
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
  /** ID of the {@link types/character!CharacterRecord | CharacterRecord} linked to this slot, if any. */
  linkedCharacterId: z.string().optional(),
  /** Display name override for the member (used when no character is linked). */
  name: z.string().optional(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this record was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update to this record. */
  updatedAt: z.string(),
  /** ISO datetime when this party member was soft-deleted; absent while active. */
  deletedAt: z.string().optional(),
  /** Transaction UUID identifying the cascade that soft-deleted this party member. */
  softDeletedBy: z.string().optional(),
});

/**
 * A party record inferred from {@link partySchema}.
 */
export type Party = z.infer<typeof partySchema>;

/**
 * A party member record inferred from {@link partyMemberSchema}.
 */
export type PartyMember = z.infer<typeof partyMemberSchema>;
