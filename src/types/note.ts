import { z } from 'zod';

/**
 * All recognised note type discriminators.
 *
 * @remarks
 * - `'generic'`     — free-form note with no structured data.
 * - `'npc'`         — NPC record with name, description, disposition.
 * - `'combat'`      — combat tracker with rounds and participant list.
 * - `'location'`    — place description.
 * - `'loot'`        — treasure / reward record.
 * - `'rumor'`       — heard rumour or piece of information.
 * - `'quote'`       — memorable quote from the session.
 * - `'skill-check'` — record of a skill roll outcome (system-generated).
 * - `'recap'`       — session recap summary (auto or manual).
 */
export const NOTE_TYPES = ['generic', 'npc', 'combat', 'location', 'loot', 'rumor', 'quote', 'skill-check', 'recap'] as const;

/**
 * Union of all valid note type strings derived from {@link NOTE_TYPES}.
 */
export type NoteType = (typeof NOTE_TYPES)[number];

/**
 * Lifecycle status of a note.
 *
 * - `'active'`   — visible in default note views.
 * - `'archived'` — hidden from default views but retained in the database.
 */
export type NoteStatus = 'active' | 'archived';

/**
 * Zod schema for runtime validation of note records read from IndexedDB.
 *
 * @remarks
 * `body` is stored as an opaque ProseMirror/Tiptap JSON document object.
 * `typeData` carries type-specific structured data (e.g. combat rounds) and
 * its shape varies per `type`.
 *
 * @example
 * ```ts
 * const result = baseNoteSchema.safeParse(rawRecord);
 * if (!result.success) console.warn(result.error);
 * ```
 */
export const baseNoteSchema = z.object({
  /** Unique identifier for the note. */
  id: z.string(),
  /** ID of the campaign this note belongs to. */
  campaignId: z.string(),
  /** Optional ID of the session during which this note was created. */
  sessionId: z.string().optional(),
  /** Display title of the note. */
  title: z.string(),
  /** ProseMirror/Tiptap JSON document body, or `null` if empty. */
  body: z.unknown(),
  /** Note type discriminator; one of the {@link NOTE_TYPES} values. */
  type: z.string(),
  /** Type-specific structured data payload (shape depends on `type`). */
  typeData: z.unknown().optional(),
  /** Lifecycle status of the note. */
  status: z.enum(['active', 'archived']),
  /** If `true`, the note is pinned to the top of note grids. */
  pinned: z.boolean(),
  /** User-applied tag strings for filtering and organisation. */
  tags: z.array(z.string()).optional(),
  /** Schema version for forward-compatibility migrations. */
  schemaVersion: z.number(),
  /** ISO datetime when this note was first created. */
  createdAt: z.string(),
  /** ISO datetime of the most recent update to this note. */
  updatedAt: z.string(),
  /**
   * Privacy visibility of the note.
   * - `'public'`  — included in default exports.
   * - `'private'` — excluded from exports unless opted in.
   * Legacy notes without this field are treated as `'public'` at runtime.
   */
  visibility: z.enum(['public', 'private']).optional(),
  /**
   * Ownership scope of the note.
   * - `'campaign'` — belongs to a specific campaign (default).
   * - `'shared'`   — shared across campaigns (e.g. migrated reference notes).
   * Legacy notes without this field default to `'campaign'`.
   */
  scope: z.enum(['campaign', 'shared']).optional(),
});

/**
 * A note record inferred from {@link baseNoteSchema}.
 *
 * @remarks
 * Use {@link baseNoteSchema} to validate raw data before casting to this type.
 */
export type Note = z.infer<typeof baseNoteSchema>;
