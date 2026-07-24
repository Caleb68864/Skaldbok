import * as entityLinkRepository from '../../storage/repositories/entityLinkRepository';
import type { Note } from '../../types/note';
import { generateId } from '../../utils/ids';
import { nowISO } from '../../utils/dates';

/**
 * How to decide which encounter (if any) a new note attaches to.
 *
 * @remarks
 * `targetEncounterId` is a three-state field: an explicit id pins the note to
 * that encounter, `null` means "campaign-level, do not attach", and `undefined`
 * defers to `resolveActiveEncounterId` for the session's currently-open
 * encounter. See {@link resolveEncounterAttachmentTarget}.
 */
export interface NoteEncounterTargetOptions {
  sessionId?: string;
  targetEncounterId?: string | null;
  resolveActiveEncounterId?: (sessionId: string) => Promise<string | null>;
}

/** Fields for {@link buildNoteRecord}; the auto-generated id/timestamps/schemaVersion are added for you. */
export interface BuildNoteRecordInput {
  campaignId: string;
  sessionId?: string;
  title: string;
  type: string;
  body?: unknown;
  typeData?: unknown;
  status: Note['status'];
  pinned: boolean;
  tags?: string[];
  visibility?: Note['visibility'];
  scope?: Note['scope'];
}

/** Inputs to {@link persistCanonicalNoteLinks}: the note plus the session/encounter it belongs to. */
export interface PersistCanonicalNoteLinksInput {
  note: Pick<Note, 'id' | 'type'>;
  sessionId?: string;
  encounterId?: string | null;
}

function splitNoteContent(body: unknown, typeData: unknown): { body: unknown; storedTypeData: unknown } {
  if (body !== undefined) {
    return {
      body,
      storedTypeData: typeData ?? {},
    };
  }

  if (typeData && typeof typeData === 'object' && 'body' in (typeData as Record<string, unknown>)) {
    const source = typeData as Record<string, unknown>;
    const extractedBody = source.body ?? null;
    const { body: _omit, ...rest } = source;
    void _omit;
    return {
      body: extractedBody,
      storedTypeData: rest,
    };
  }

  return {
    body: null,
    storedTypeData: typeData ?? {},
  };
}

/**
 * Resolves the encounter a new note should attach to from the caller's options.
 *
 * @remarks
 * Encodes the three-state {@link NoteEncounterTargetOptions.targetEncounterId}:
 * an explicit id is returned as-is, `null` yields `null` (campaign-level), and
 * `undefined` falls through to the session's active encounter via
 * `resolveActiveEncounterId`.
 */
export async function resolveEncounterAttachmentTarget({
  sessionId,
  targetEncounterId,
  resolveActiveEncounterId,
}: NoteEncounterTargetOptions): Promise<string | null> {
  if (targetEncounterId === null) {
    return null;
  }

  if (typeof targetEncounterId === 'string') {
    return targetEncounterId;
  }

  if (!sessionId || !resolveActiveEncounterId) {
    return null;
  }

  return await resolveActiveEncounterId(sessionId);
}

/**
 * Builds a complete {@link Note} record from creation inputs.
 *
 * @remarks
 * Normalises where the rich-text body lives: some callers pass it as `body`,
 * others tuck it inside `typeData.body`. Either way the body is hoisted to the
 * top-level `body` field and stripped from the stored `typeData`, so downstream
 * readers have one place to look. Defaults visibility to `public` and scope to
 * `campaign`.
 */
export function buildNoteRecord(input: BuildNoteRecordInput): Note {
  const now = nowISO();
  const normalized = splitNoteContent(input.body, input.typeData);

  return {
    id: generateId(),
    campaignId: input.campaignId,
    sessionId: input.sessionId,
    title: input.title,
    body: normalized.body,
    type: input.type,
    typeData: normalized.storedTypeData,
    status: input.status,
    pinned: input.pinned,
    tags: input.tags,
    visibility: input.visibility ?? 'public',
    scope: input.scope ?? 'campaign',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureLink(
  fromEntityId: string,
  fromEntityType: string,
  toEntityId: string,
  toEntityType: string,
  relationshipType: string,
): Promise<void> {
  const existing = await entityLinkRepository.getLinksFrom(fromEntityId, relationshipType);
  const alreadyLinked = existing.some(
    (link) => link.toEntityId === toEntityId && link.toEntityType === toEntityType,
  );

  if (alreadyLinked) {
    return;
  }

  await entityLinkRepository.createLink({
    fromEntityId,
    fromEntityType,
    toEntityId,
    toEntityType,
    relationshipType,
  });
}

/**
 * Creates the canonical entity links a note needs, idempotently.
 *
 * @remarks
 * A note belongs to its session (`session --contains--> note`) and, when logged
 * inside one, its encounter. An NPC note additionally records where it was first
 * introduced (`note --introduced_in--> session`). Each edge is created only if an
 * equivalent one does not already exist, so re-saving a note never duplicates
 * links.
 */
export async function persistCanonicalNoteLinks({
  note,
  sessionId,
  encounterId,
}: PersistCanonicalNoteLinksInput): Promise<void> {
  if (sessionId) {
    await ensureLink(sessionId, 'session', note.id, 'note', 'contains');

    if (note.type === 'npc') {
      await ensureLink(note.id, 'note', sessionId, 'session', 'introduced_in');
    }
  }

  if (encounterId) {
    await ensureLink(encounterId, 'encounter', note.id, 'note', 'contains');
  }
}
